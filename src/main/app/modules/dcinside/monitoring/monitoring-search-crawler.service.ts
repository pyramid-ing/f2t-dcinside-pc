import { Injectable, Logger } from '@nestjs/common'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { CookieService } from '@main/app/modules/util/cookie.service'
import { getProxyByMethod } from '@main/app/modules/util/browser-manager.service'
import { IpMode } from '@main/app/modules/settings/settings.types'
import UserAgent from 'user-agents'
import axios, { AxiosInstance } from 'axios'
import * as cheerio from 'cheerio'
import { HttpsProxyAgent } from 'https-proxy-agent'

export interface SearchCrawlResult {
  postUrl: string
  postTitle: string
  postId: string
  galleryUrl: string
  galleryName: string
  galleryId: string
  headtext: string | null
  authorName: string | null
}

@Injectable()
export class MonitoringSearchCrawlerService {
  private readonly logger = new Logger(MonitoringSearchCrawlerService.name)

  constructor(
    private readonly settingsService: SettingsService,
    private readonly cookieService: CookieService,
  ) {}

  /**
   * 디시인사이드 검색 결과 크롤링
   */
  async crawlSearchResults(keyword: string, sort: string = 'latest'): Promise<SearchCrawlResult[]> {
    this.logger.log(`검색 크롤링 시작: ${keyword} (정렬: ${sort})`)

    try {
      // Axios 인스턴스 생성
      const axiosInstance = await this.createAxiosInstance()

      // 검색 URL 생성
      const encodedKeyword = encodeURIComponent(keyword)
      const sortParam = sort === 'accuracy' ? 'accuracy' : 'latest'
      const searchUrl = `https://search.dcinside.com/post/p/1/q/${encodedKeyword}?sort=${sortParam}`

      this.logger.log(`검색 URL: ${searchUrl}`)

      // 검색 페이지 HTML 가져오기
      const response = await axiosInstance.get(searchUrl, {
        timeout: 30000,
      })

      // Cheerio로 HTML 파싱
      const $ = cheerio.load(response.data)

      const results: SearchCrawlResult[] = []

      // 검색 결과 파싱
      $('.sch_result_list li').each((_, element) => {
        try {
          const $item = $(element)

          // 제목 및 URL
          const $titleLink = $item.find('a.tit_txt')
          const postUrl = $titleLink.attr('href')
          const postTitle = $titleLink.text().trim()

          if (!postUrl || !postTitle) return

          // 갤러리 정보
          const $galleryLink = $item.find('p.link_dsc_txt.dsc_sub a.sub_txt')
          const galleryUrl = $galleryLink.attr('href')
          const galleryName = $galleryLink.text().trim()

          if (!galleryUrl || !galleryName) return

          // 갤러리 ID 추출
          // URL 형식: https://gall.dcinside.com/board/lists?id=programming
          // 또는: https://gall.dcinside.com/mgallery/board/lists?id=programming
          const galleryIdMatch = galleryUrl.match(/[?&]id=([^&]+)/)
          const galleryId = galleryIdMatch ? galleryIdMatch[1] : ''

          if (!galleryId) return

          // 포스트 ID 추출
          // URL 형식: https://gall.dcinside.com/board/view/?id=programming&no=123456
          const postIdMatch = postUrl.match(/[?&]no=(\d+)/)
          const postId = postIdMatch ? postIdMatch[1] : ''

          if (!postId) return

          // 작성자 (검색 결과에는 없을 수 있음)
          const authorName = null

          // 말머리 추출 (제목에서 대괄호 안의 내용)
          const headtextMatch = postTitle.match(/^\[([^\]]+)\]/)
          const headtext = headtextMatch ? headtextMatch[1] : null

          results.push({
            postUrl,
            postTitle,
            postId,
            galleryUrl,
            galleryName,
            galleryId,
            headtext,
            authorName,
          })
        } catch (error) {
          this.logger.warn(`검색 결과 항목 파싱 오류:`, error)
        }
      })

      this.logger.log(`검색 결과 ${results.length}개 발견`)

      return results
    } catch (error) {
      this.logger.error(`검색 크롤링 오류: ${keyword}`, error)
      throw error
    }
  }

  /**
   * Axios 인스턴스 생성 (프록시 지원)
   */
  private async createAxiosInstance(): Promise<AxiosInstance> {
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

    // Axios 설정
    const axiosConfig: any = {
      headers,
      maxRedirects: 5,
      validateStatus: status => status < 500,
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
        axiosConfig.proxy = false

        this.logger.log(`프록시 적용: ${proxy.ip}:${proxy.port}`)
      }
    }

    return axios.create(axiosConfig)
  }
}
