import { Injectable, Logger } from '@nestjs/common'
import { MonitoringService } from './monitoring.service'
import { MonitoringSearchCrawlerService } from './monitoring-search-crawler.service'
import { CookieService } from '@main/app/modules/util/cookie.service'
import { getProxyByMethod } from '@main/app/modules/util/browser-manager.service'
import { IpMode } from '@main/app/modules/settings/settings.types'
import UserAgent from 'user-agents'
import axios, { AxiosInstance } from 'axios'
import * as cheerio from 'cheerio'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { orderBy } from 'lodash'
import { SettingsService } from '@main/app/modules/settings/settings.service'

@Injectable()
export class MonitoringCrawlerService {
  private readonly logger = new Logger(MonitoringCrawlerService.name)
  private isRunning = false
  private crawlerLoop: Promise<void> | null = null

  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly settingsService: SettingsService,
    private readonly cookieService: CookieService,
    private readonly searchCrawler: MonitoringSearchCrawlerService,
  ) {}

  /**
   * 크롤링 시작
   */
  async startCrawling(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('크롤링이 이미 실행 중입니다.')
      return
    }

    this.isRunning = true
    this.logger.log('크롤링을 시작합니다.')

    // 백그라운드에서 무한 루프 실행
    this.crawlerLoop = this.runCrawlerLoop()
  }

  /**
   * 크롤링 중지
   */
  stopCrawling(): void {
    if (!this.isRunning) {
      this.logger.warn('크롤링이 실행 중이 아닙니다.')
      return
    }

    this.isRunning = false
    this.logger.log('크롤링을 중지합니다.')
  }

  /**
   * 크롤러 무한 루프
   */
  private async runCrawlerLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        this.logger.log('크롤링 사이클 시작')

        // 모든 활성 갤러리 가져오기
        const galleries = await this.monitoringService.getAllGalleries()
        const activeGalleries = galleries.filter(g => g.isActive)

        if (activeGalleries.length === 0) {
          this.logger.warn('활성화된 갤러리가 없습니다.')
        } else {
          this.logger.log(`${activeGalleries.length}개의 활성 갤러리를 크롤링합니다.`)

          // 각 갤러리/검색 크롤링
          for (const gallery of activeGalleries) {
            if (!this.isRunning) {
              this.logger.log('크롤링이 중지되었습니다.')
              break
            }

            try {
              // 타입에 따라 다른 크롤링 메서드 호출
              if (gallery.type === 'search') {
                await this.crawlSearch(gallery.id)
              } else {
                await this.crawlGallery(gallery.id)
              }
            } catch (error) {
              this.logger.error(`크롤링 실패: ${gallery.galleryUrl}`, error)
            }

            // 갤러리 간 짧은 대기 (3초)
            await this.sleep(3000)
          }
        }

        this.logger.log('크롤링 사이클 완료. 1분 대기...')

        // 1분 대기 (60초)
        await this.sleep(60000)
      } catch (error) {
        this.logger.error('크롤러 루프 오류:', error)
        // 오류 발생 시에도 1분 대기
        await this.sleep(60000)
      }
    }

    this.logger.log('크롤러 루프 종료')
  }

  /**
   * 특정 갤러리 크롤링
   */
  async crawlGallery(galleryId: string): Promise<number> {
    this.logger.log(`갤러리 크롤링 시작: ${galleryId}`)

    const gallery = await this.monitoringService.getGalleryById(galleryId)

    // 블랙리스트 체크
    const isBlacklisted = await this.monitoringService.isGalleryBlacklisted(gallery.galleryId)
    if (isBlacklisted) {
      this.logger.warn(`갤러리가 블랙리스트에 등록되어 있습니다. 크롤링을 건너뜁니다: ${gallery.galleryId}`)
      return 0
    }

    let newPostCount = 0

    // Axios 인스턴스 생성
    const axiosInstance = await this.createAxiosInstance(gallery.loginId)

    // 갤러리 페이지 HTML 가져오기
    const response = await axiosInstance.get(gallery.galleryUrl, {
      timeout: 30000,
    })

    // Cheerio로 HTML 파싱
    const $ = cheerio.load(response.data)

    // 1. 게시글 전체 가져오기
    const allPosts: Array<{
      postUrl: string
      postTitle: string
      postId: string
      authorName: string | null
      headtext: string | null
      gallNum: string
    }> = []

    $('.gall_list tbody tr.ub-content').each((_, element) => {
      try {
        const $row = $(element)

        const gallNum = $row.find('.gall_num').text().trim()
        const gallSubject = $row.find('.gall_subject').text().trim()
        const $titleElement = $row.find('.gall_tit a')
        const $authorElement = $row.find('.gall_writer')

        if ($titleElement.length === 0) return

        const postUrl = $titleElement.attr('href')
        const postTitle = $titleElement.text().trim() || ''
        const authorName = $authorElement.text().trim() || null

        // URL에서 포스트 ID 추출
        const urlMatch = postUrl?.match(/no=(\d+)/)
        const postId = urlMatch ? urlMatch[1] : ''

        if (!postUrl || !postId) return

        // 절대 URL로 변환
        const fullUrl = postUrl.startsWith('http') ? postUrl : `https://gall.dcinside.com${postUrl}`

        allPosts.push({
          postUrl: fullUrl,
          postTitle,
          postId,
          authorName,
          headtext: gallSubject || null,
          gallNum,
        })
      } catch (error) {
        this.logger.warn(`게시글 파싱 오류:`, error)
      }
    })

    // 2. 필터링 (번호가 없거나 AD, 설문, 공지 제외)
    const excludeSubjects = ['AD', '설문', '공지']
    const posts = allPosts
      .filter(post => {
        // 게시글 번호가 "-"인 경우 제외
        if (post.gallNum === '-') {
          return false
        }
        // AD, 설문, 공지 제외
        if (post.headtext && excludeSubjects.includes(post.headtext)) {
          return false
        }
        return true
      })
      .map(({ gallNum, ...post }) => post) // gallNum 제거

    this.logger.log(
      `전체 ${allPosts.length}개 중 ${posts.length}개의 유효한 게시글을 발견했습니다. (AD/설문/공지 제외)`,
    )

    // postId 기준으로 내림차순 정렬 (최신 게시글이 먼저 오도록)
    const sortedPosts = orderBy(posts, [post => parseInt(post.postId, 10)], ['desc'])

    // 최신 게시글부터 DB에 저장
    for (const post of sortedPosts) {
      try {
        await this.monitoringService.createPost({
          postUrl: post.postUrl,
          postTitle: post.postTitle,
          postId: post.postId,
          authorName: post.authorName,
          headtext: post.headtext,
          galleryId: gallery.id,
        })
        newPostCount++

        // AI 검사는 monitoring.processor에서 별도로 처리
      } catch (error) {
        // 중복 게시글은 무시
      }
    }

    this.logger.log(`갤러리 크롤링 완료: ${gallery.galleryUrl}, 새 게시글: ${newPostCount}개`)
    this.logger.log(`AI 검사 및 자동 작업 생성은 monitoring.processor에서 별도로 처리됩니다.`)

    return newPostCount
  }

  /**
   * 검색 기반 크롤링
   */
  async crawlSearch(monitorId: string): Promise<number> {
    this.logger.log(`검색 크롤링 시작: ${monitorId}`)

    const monitor = await this.monitoringService.getGalleryById(monitorId)
    let newPostCount = 0

    if (!monitor.searchKeyword) {
      this.logger.warn(`검색 키워드가 없습니다: ${monitorId}`)
      return 0
    }

    // 블랙리스트 체크 (검색 타입은 블랙리스트 체크 안 함)
    // 검색 결과에서 각 게시글의 갤러리를 개별적으로 체크할 수도 있지만,
    // 현재는 검색 타입 자체를 블랙리스트 체크에서 제외

    // 검색 크롤링 수행
    const searchResults = await this.searchCrawler.crawlSearchResults(
      monitor.searchKeyword,
      monitor.searchSort || 'latest',
    )

    // 검색 결과를 DB에 저장
    for (const result of searchResults) {
      // 게시글이 속한 갤러리가 블랙리스트에 있는지 확인
      // result에 galleryId 정보가 있다면 체크, 없다면 패스
      if (result.galleryId) {
        const isBlacklisted = await this.monitoringService.isGalleryBlacklisted(result.galleryId)
        if (isBlacklisted) {
          this.logger.log(
            `검색 결과 게시글의 갤러리가 블랙리스트에 있습니다. 건너뜁니다: ${result.postTitle} (${result.galleryId})`,
          )
          continue
        }
      }

      await this.monitoringService.createPost({
        postUrl: result.postUrl,
        postTitle: result.postTitle,
        postId: result.postId,
        authorName: result.authorName,
        headtext: result.headtext,
        galleryId: monitor.id,
      })
      newPostCount++
    }

    this.logger.log(`검색 크롤링 완료: ${monitor.searchKeyword}, 새 게시글: ${newPostCount}개`)
    this.logger.log(`AI 검사 및 자동 작업 생성은 monitoring.processor에서 별도로 처리됩니다.`)

    return newPostCount
  }

  /**
   * 크롤링 상태 조회
   */
  getStatus(): { isRunning: boolean } {
    return {
      isRunning: this.isRunning,
    }
  }

  /**
   * Axios 인스턴스 생성 (프록시 및 쿠키 지원)
   */
  private async createAxiosInstance(loginId?: string | null): Promise<AxiosInstance> {
    const settings = await this.settingsService.getSettings()
    const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString()

    // 기본 헤더 설정
    const headers: any = {
      'User-Agent': userAgent,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    }

    // 쿠키 로드 및 적용 (로그인 정보가 있는 경우)
    if (loginId) {
      const cookies = this.cookieService.loadCookies('dcinside', loginId)
      if (cookies && cookies.length > 0) {
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ')
        headers.Cookie = cookieString
        this.logger.log(`저장된 쿠키를 적용합니다: ${loginId}`)
      }
    }

    // Axios 설정
    const axiosConfig: any = {
      headers,
      maxRedirects: 5,
      validateStatus: status => status < 500, // 500 미만은 모두 성공으로 처리
    }

    // 프록시 설정 (ipMode가 PROXY일 때만)
    if (settings?.ipMode === IpMode.PROXY && settings?.proxies && settings.proxies.length > 0) {
      const method = settings.proxyChangeMethod || 'random'
      const { proxy } = getProxyByMethod(settings.proxies, method)

      if (proxy) {
        const proxyUrl =
          proxy.id && proxy.pw
            ? `http://${proxy.id}:${proxy.pw}@${proxy.ip}:${proxy.port}`
            : `http://${proxy.ip}:${proxy.port}`

        axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl)
        axiosConfig.proxy = false // axios의 기본 프록시 설정 비활성화

        this.logger.log(`프록시 적용: ${proxy.ip}:${proxy.port}`)
      }
    }

    return axios.create(axiosConfig)
  }

  /**
   * 갤러리 수동 크롤링 (단일 또는 일괄)
   */
  async crawlGalleriesManually(ids: string[]): Promise<{
    successCount: number
    failedCount: number
    results: Array<{ id: string; success: boolean; newPostCount?: number; error?: string }>
  }> {
    this.logger.log(`수동 크롤링 시작: ${ids.length}개`)

    const results: Array<{ id: string; success: boolean; newPostCount?: number; error?: string }> = []
    let successCount = 0
    let failedCount = 0

    for (const id of ids) {
      try {
        const gallery = await this.monitoringService.getGalleryById(id)

        let newPostCount = 0

        // 타입에 따라 다른 크롤링 메서드 호출
        if (gallery.type === 'search') {
          newPostCount = await this.crawlSearch(id)
        } else {
          newPostCount = await this.crawlGallery(id)
        }

        // 마지막 체크 시간 업데이트
        await this.monitoringService.updateGalleryLastChecked(id)

        this.logger.log(`크롤링 완료 - ${gallery.galleryName || gallery.galleryId}: 새 게시글 ${newPostCount}개`)
        results.push({ id, success: true, newPostCount })
        successCount++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
        this.logger.error(`갤러리 크롤링 실패 (ID: ${id})`, error)
        results.push({ id, success: false, error: errorMessage })
        failedCount++
      }
    }

    this.logger.log(`수동 크롤링 완료: 성공 ${successCount}개, 실패 ${failedCount}개`)

    return {
      successCount,
      failedCount,
      results,
    }
  }

  /**
   * 대기 함수
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
