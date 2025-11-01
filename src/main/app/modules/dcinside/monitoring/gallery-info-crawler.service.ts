import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import * as cheerio from 'cheerio'

export interface GalleryInfo {
  galleryId: string
  galleryName: string
}

@Injectable()
export class GalleryInfoCrawlerService {
  private readonly _logger = new Logger(GalleryInfoCrawlerService.name)

  constructor(private readonly _httpService: HttpService) {}

  /**
   * 갤러리 URL에서 갤러리 ID와 이름을 자동으로 파싱합니다.
   */
  async crawlGalleryInfo(galleryUrl: string): Promise<GalleryInfo> {
    try {
      // 1. URL에서 갤러리 ID 추출
      const galleryId = this._parseGalleryIdFromUrl(galleryUrl)

      // 2. 갤러리 페이지에서 갤러리 이름 크롤링
      const galleryName = await this._crawlGalleryName(galleryUrl)

      return {
        galleryId,
        galleryName,
      }
    } catch (error) {
      this._logger.error(`갤러리 정보 크롤링 실패: ${galleryUrl}`, error)
      throw new BadRequestException('갤러리 정보를 가져오는데 실패했습니다.')
    }
  }

  /**
   * URL에서 갤러리 ID를 파싱합니다.
   * 모바일 URL: https://m.dcinside.com/board/skin → id: skin
   * PC URL: https://gall.dcinside.com/mgallery/board/lists/?id=skin → id: skin
   */
  private _parseGalleryIdFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)

      // 모바일 URL 패턴: m.dcinside.com/board/{id}
      if (urlObj.hostname === 'm.dcinside.com') {
        const match = urlObj.pathname.match(/\/board\/([^/]+)/)
        if (match && match[1]) {
          return match[1]
        }
      }

      // PC URL 패턴: gall.dcinside.com/.../lists/?id={id}
      if (urlObj.hostname === 'gall.dcinside.com') {
        const idParam = urlObj.searchParams.get('id')
        if (idParam) {
          return idParam
        }
      }

      throw new Error('갤러리 ID를 찾을 수 없습니다.')
    } catch (error) {
      this._logger.error(`갤러리 ID 파싱 실패: ${url}`, error)
      throw new BadRequestException('유효하지 않은 갤러리 URL입니다.')
    }
  }

  /**
   * 갤러리 페이지에서 갤러리 이름을 크롤링합니다.
   */
  private async _crawlGalleryName(url: string): Promise<string> {
    try {
      // PC 갤러리 URL로 변환 (크롤링이 더 안정적)
      const urlObj = new URL(url)
      let targetUrl = url

      // 모바일 URL인 경우 PC URL로 변환
      if (urlObj.hostname === 'm.dcinside.com') {
        const galleryId = this._parseGalleryIdFromUrl(url)
        targetUrl = `https://gall.dcinside.com/board/lists/?id=${galleryId}`
      }

      this._logger.log(`갤러리 이름 크롤링 시작: ${targetUrl}`)

      // HTTP 요청
      const response = await firstValueFrom(
        this._httpService.get(targetUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          },
          timeout: 10000,
        }),
      )

      // HTML 파싱
      const $ = cheerio.load(response.data)

      // 갤러리 이름 추출
      // <h2><a href="...">돌고래밥 갤러리<div class="pagehead_titicon ngall sp_img">...</div></a></h2>
      let galleryName = ''

      // 방법 1: .page_head h2 > a에서 텍스트 추출
      const h2Link = $('.page_head h2 > a')
      if (h2Link.length > 0) {
        // <a> 태그의 텍스트만 추출 (자식 요소 제거)
        const clonedLink = h2Link.clone()
        clonedLink.find('.pagehead_titicon').remove() // 아이콘 제거
        galleryName = clonedLink.text().trim()
      }

      // 방법 2: meta 태그에서 추출 (fallback)
      if (!galleryName) {
        const ogTitle = $('meta[property="og:title"]').attr('content')
        if (ogTitle) {
          // "돌고래밥 갤러리 - 디시인사이드" 형식에서 갤러리 이름만 추출
          galleryName = ogTitle.replace(/\s*-\s*디시인사이드.*$/, '').trim()
        }
      }

      // 방법 3: title 태그에서 추출 (fallback)
      if (!galleryName) {
        const title = $('title').text()
        if (title) {
          // "돌고래밥 갤러리 - 디시인사이드" 형식에서 갤러리 이름만 추출
          galleryName = title.replace(/\s*-\s*디시인사이드.*$/, '').trim()
        }
      }

      if (!galleryName) {
        throw new Error('갤러리 이름을 찾을 수 없습니다.')
      }

      this._logger.log(`갤러리 이름 크롤링 완료: ${galleryName}`)
      return galleryName
    } catch (error) {
      this._logger.error(`갤러리 이름 크롤링 실패: ${url}`, error)
      throw new BadRequestException('갤러리 이름을 가져오는데 실패했습니다. 유효한 갤러리 URL인지 확인해주세요.')
    }
  }
}
