import * as cheerio from 'cheerio'
import axios from 'axios'

/**
 * URL에서 HTML title을 추출하는 유틸리티 함수
 */
export class HtmlTitleExtractor {
  /**
   * URL에서 HTML title을 가져옵니다
   * @param url 게시물 URL
   * @returns 게시물 제목 또는 기본값
   */
  static async extractTitle(url: string): Promise<string> {
    try {
      // URL 유효성 검사
      if (!url || !this.isValidUrl(url)) {
        return '알 수 없는 제목'
      }

      // HTTP 요청으로 HTML 가져오기
      const response = await axios.get(url, {
        timeout: 10000, // 10초 타임아웃
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      })

      if (response.status !== 200) {
        return '알 수 없는 제목'
      }

      // Cheerio로 HTML 파싱
      const $ = cheerio.load(response.data)

      // title 태그에서 제목 추출
      let title = $('title').text().trim()

      // title이 비어있거나 기본값인 경우 다른 선택자 시도
      if (!title || title === 'DCinside' || title === '갤러리') {
        // DCinside 특화 선택자들
        title =
          $('.title_subject').text().trim() ||
          $('.gallview-tit-box .title').text().trim() ||
          $('.view_content_wrap .title').text().trim() ||
          $('h3.title').text().trim() ||
          $('.view_title').text().trim()
      }

      // 제목이 여전히 비어있으면 기본값 반환
      if (!title || title.length === 0) {
        return '알 수 없는 제목'
      }

      // 제목 길이 제한 (너무 긴 제목은 잘라내기)
      if (title.length > 100) {
        title = title.substring(0, 100) + '...'
      }

      return title
    } catch (error) {
      console.error('HTML title 추출 실패:', error)
      return '알 수 없는 제목'
    }
  }

  /**
   * URL 유효성 검사
   * @param url 검사할 URL
   * @returns 유효한 URL인지 여부
   */
  private static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  /**
   * 여러 URL의 제목을 병렬로 가져옵니다
   * @param urls URL 배열
   * @returns 제목 배열
   */
  static async extractTitles(urls: string[]): Promise<string[]> {
    const promises = urls.map(url => this.extractTitle(url))
    return Promise.all(promises)
  }
}
