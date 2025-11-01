import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import axios from 'axios'
import * as cheerio from 'cheerio'
import {
  DcinsidePostData,
  DcinsidePostingCrawlerOptions,
} from '@main/app/modules/dcinside/crawler/dcinside-posting-crawler.types'
import { EnvConfig } from '@main/config/env.config'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { CookieService } from '@main/app/modules/util/cookie.service'
import { TwoCaptchaService } from '@main/app/modules/util/two-captcha.service'
import { DcCaptchaSolverService } from '@main/app/modules/dcinside/util/dc-captcha-solver.service'
import { BrowserManagerService } from '@main/app/modules/util/browser-manager.service'
import { TetheringService } from '@main/app/modules/util/tethering.service'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { DcinsideBaseService } from '@main/app/modules/dcinside/base/dcinside-base.service'
import { retry } from '@main/app/utils/retry'
import { JobContextService } from '@main/app/modules/common/job-context/job-context.service'

// 타입 가드 assert 함수
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

// DcinsidePostingCrawlerError 클래스 정의
export class DcinsidePostingCrawlerErrorClass extends Error {
  constructor(
    public readonly errorInfo: {
      code: string
      message: string
      details?: any
    },
  ) {
    super(errorInfo.message)
    this.name = 'DcinsidePostingCrawlerError'
  }
}

@Injectable()
export class DcinsidePostingCrawlerService extends DcinsideBaseService {
  constructor(
    settingsService: SettingsService,
    cookieService: CookieService,
    twoCaptchaService: TwoCaptchaService,
    dcCaptchaSolverService: DcCaptchaSolverService,
    browserManagerService: BrowserManagerService,
    tetheringService: TetheringService,
    jobLogsService: JobLogsService,
    jobContext: JobContextService,
  ) {
    super(
      settingsService,
      cookieService,
      twoCaptchaService,
      dcCaptchaSolverService,
      browserManagerService,
      tetheringService,
      jobLogsService,
      jobContext,
    )
  }

  /**
   * 디시인사이드 포스팅 정보 크롤링
   */
  public async crawlPostData(postUrl: string, options: DcinsidePostingCrawlerOptions = {}): Promise<DcinsidePostData> {
    try {
      // 최대 3회 재시도
      const result = await retry(
        async () => {
          const html = await this._fetchHtml(postUrl)
          const $ = cheerio.load(html)

          const title = this._extractPostTitle($)
          const content = this._extractPostContent($)
          const imageUrls = this._extractPostImages($)
          const galleryName = this._extractGalleryName($, postUrl)

          let localImagePaths: string[] = []
          if (options.downloadImages !== false) {
            localImagePaths = await this._downloadImages(imageUrls, postUrl, options.imageDirectory)
          }

          return {
            title,
            content,
            imageUrls,
            localImagePaths,
            galleryName,
            originalUrl: postUrl,
          }
        },
        1000,
        3,
        'exponential',
      )

      return result
    } catch (error) {
      this.logger.error('디시인사이드 포스팅 크롤링 실패:', error)
      if (error instanceof DcinsidePostingCrawlerErrorClass) {
        throw error
      }
      throw new DcinsidePostingCrawlerErrorClass({
        code: 'CRAWLING_FAILED',
        message: `디시인사이드 포스팅 크롤링에 실패했습니다. ${error.message}`,
        details: error,
      })
    }
  }

  /**
   * axios로 HTML 가져오기
   */
  private async _fetchHtml(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        timeout: 60000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
      })

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`)
      }

      return response.data
    } catch (error) {
      this.logger.error(`HTML 가져오기 실패 (${url}):`, error)
      throw new DcinsidePostingCrawlerErrorClass({
        code: 'FETCH_HTML_FAILED',
        message: 'HTML을 가져오는데 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 포스팅 제목을 추출합니다.
   * DOM 구조: .gallview_head .title .title_subject
   */
  private _extractPostTitle($: cheerio.CheerioAPI): string {
    try {
      const title = $('.title_subject').text().trim()

      if (title) {
        return title
      }

      throw new Error('포스팅 제목을 찾을 수 없습니다.')
    } catch (error) {
      this.logger.warn('포스팅 제목 추출 실패:', error)
      return '제목 없음'
    }
  }

  /**
   * 포스팅 본문 내용을 추출합니다.
   * DOM 구조: .writing_view_box > .write_div
   */
  private _extractPostContent($: cheerio.CheerioAPI): string {
    try {
      const writeDiv = $('.write_div')

      if (writeDiv.length === 0) {
        throw new Error('포스팅 본문을 찾을 수 없습니다.')
      }

      // 복사본 만들어서 불필요한 요소 제거
      const clone = writeDiv.clone()

      // 이미지 영역, 광고, dcappfooter 등 제거
      clone.find('.img_area').remove()
      clone.find('#zzbang_div').remove()
      clone.find('#dcappfooter').remove()
      clone.find('img').remove()
      clone.find('video').remove()

      const content = clone.text().trim()

      if (content) {
        return content
      }

      throw new Error('포스팅 본문을 찾을 수 없습니다.')
    } catch (error) {
      this.logger.warn('포스팅 본문 추출 실패:', error)
      return '본문 없음'
    }
  }

  /**
   * 포스팅 이미지를 추출합니다.
   * DOM 구조: .writing_view_box .write_div .img_area .imgwrap img
   */
  private _extractPostImages($: cheerio.CheerioAPI): string[] {
    try {
      const images = $('.write_div img')
      const collected: string[] = []

      images.each((_, element) => {
        const src = $(element).attr('src')
        if (!src) return

        let imageUrl = src

        // 상대 경로 처리
        if (imageUrl.startsWith('//')) {
          imageUrl = `https:${imageUrl}`
        } else if (!imageUrl.startsWith('http')) {
          imageUrl = `https:${imageUrl}`
        }

        // 중복 제거 및 아이콘/이모티콘 제외
        if (
          !collected.includes(imageUrl) &&
          !imageUrl.includes('icon') &&
          !imageUrl.includes('emoticon') &&
          !imageUrl.includes('nstatic.dcinside.com')
        ) {
          collected.push(imageUrl)
        }
      })

      if (collected.length === 0) {
        this.logger.log('이미지가 없는 게시물입니다.')
      }

      return collected
    } catch (error) {
      this.logger.warn('포스팅 이미지 추출 실패:', error)
      return []
    }
  }

  /**
   * 갤러리 이름을 추출합니다.
   * DOM 구조: .page_head h2 a (예: "편의점 갤러리")
   */
  private _extractGalleryName($: cheerio.CheerioAPI, url: string): string {
    try {
      const galleryLink = $('.page_head h2 a')
      if (galleryLink.length > 0) {
        const text = galleryLink.text().trim()
        if (text) {
          // "편의점 갤러리"에서 "갤러리" 제거
          return text.replace(/\s*갤러리$/, '')
        }
      }

      // 갤러리 이름을 찾지 못한 경우 URL에서 추출
      const match = url.match(/[?&]id=([^&]+)/)
      if (match) {
        return match[1]
      }

      return '알 수 없는 갤러리'
    } catch (error) {
      this.logger.warn('갤러리 이름 추출 실패:', error)
      return '알 수 없는 갤러리'
    }
  }

  /**
   * 이미지들을 다운로드합니다.
   */
  private async _downloadImages(imageUrls: string[], postUrl: string, imageDirectory?: string): Promise<string[]> {
    if (imageUrls.length === 0) {
      return []
    }

    const tempDir = imageDirectory || path.join(EnvConfig.tempDir, 'dcinside-images')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const downloadedPaths: string[] = []

    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const imagePath = await this._downloadImage(imageUrls[i], postUrl, tempDir, i)
        downloadedPaths.push(imagePath)
      } catch (error) {
        this.logger.warn(`이미지 다운로드 실패 (${i + 1}/${imageUrls.length}):`, error)
      }
    }

    return downloadedPaths
  }

  /**
   * 단일 이미지를 다운로드합니다.
   * DC인사이드는 Referer 체크를 하므로 원본 포스팅 URL을 Referer로 전달합니다.
   */
  private async _downloadImage(imageUrl: string, postUrl: string, directory: string, index: number): Promise<string> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: postUrl,
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'cross-site',
        },
      })

      assert(response.status === 200, `이미지 다운로드 실패: ${response.status}`)

      // 파일 확장자 추출 및 검증
      let extension = '.jpg' // 기본값

      try {
        const urlPath = new URL(imageUrl).pathname
        const extractedExt = path.extname(urlPath).toLowerCase()

        // 유효한 이미지 확장자인지 확인
        const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']
        if (validImageExtensions.includes(extractedExt)) {
          extension = extractedExt
        } else {
          // Content-Type 헤더에서 확장자 추출 시도
          const contentType = response.headers['content-type']
          if (contentType) {
            if (contentType.includes('image/jpeg')) {
              extension = '.jpg'
            } else if (contentType.includes('image/png')) {
              extension = '.png'
            } else if (contentType.includes('image/gif')) {
              extension = '.gif'
            } else if (contentType.includes('image/webp')) {
              extension = '.webp'
            } else if (contentType.includes('image/bmp')) {
              extension = '.bmp'
            } else if (contentType.includes('image/svg')) {
              extension = '.svg'
            }
          }
        }
      } catch (error) {
        this.logger.warn(`확장자 추출 실패, 기본값 사용: ${extension}`)
      }

      // 파일명 생성
      const timestamp = Date.now()
      const filename = `dcinside_${timestamp}_${index}${extension}`
      const filepath = path.join(directory, filename)

      // 파일 저장
      fs.writeFileSync(filepath, response.data)

      this.logger.log(`이미지 다운로드 성공: ${filename}`)
      return filepath
    } catch (error) {
      this.logger.error(`이미지 다운로드 실패 (${imageUrl}):`, error)
      throw new DcinsidePostingCrawlerErrorClass({
        code: 'IMAGE_DOWNLOAD_FAILED',
        message: '이미지 다운로드에 실패했습니다.',
        details: error,
      })
    }
  }
}
