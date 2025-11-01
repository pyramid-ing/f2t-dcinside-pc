import { Injectable, Logger } from '@nestjs/common'
import { Browser, BrowserContext, chromium, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import axios from 'axios'
import { CoupangProductData, CoupangReview, CoupangCrawlerOptions } from './coupang-crawler.types'
import { EnvConfig } from '@main/config/env.config'
import { retry } from '@main/app/utils/retry'

// 타입 가드 assert 함수
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

// CoupangCrawlerError 클래스 정의
export class CoupangCrawlerErrorClass extends Error {
  constructor(
    public readonly errorInfo: {
      code: string
      message: string
      details?: any
    },
  ) {
    super(errorInfo.message)
    this.name = 'CoupangCrawlerError'
  }
}

@Injectable()
export class CoupangCrawlerService {
  private readonly logger = new Logger(CoupangCrawlerService.name)
  private browser: Browser | null = null
  private context: BrowserContext | null = null

  constructor() {}

  /**
   * 상품 정보 크롤링
   */
  public async crawlProductInfo(coupangUrl: string, options: CoupangCrawlerOptions = {}): Promise<CoupangProductData> {
    let page: Page | null = null
    try {
      page = await this._createPage()

      // 최대 3회 페이지 갱신 기반 재시도 (util.retry 사용)
      let isFirstAttempt = true
      try {
        const result = await retry(
          async () => {
            if (isFirstAttempt) {
              await page.goto(coupangUrl, { waitUntil: 'domcontentloaded' })
              isFirstAttempt = false
            } else {
              this.logger.warn('페이지 새로고침 재시도')
              await page.reload({ waitUntil: 'domcontentloaded' })
            }

            const title = await this._extractProductTitle(page)
            const price = await this._extractProductPrice(page)
            const images = await this._extractProductImages(page)
            const reviews = await this._extractProductReviews(page)

            let processedImages: string[] = []
            if (options.processImages !== false) {
              processedImages = await this._processImages(images)
            }

            return {
              title,
              price,
              originalUrl: coupangUrl,
              affiliateUrl: '',
              originImageUrls: images,
              images: processedImages.length > 0 ? processedImages : images,
              reviews,
            }
          },
          1000,
          3,
          'exponential',
        )

        return result
      } catch (retryError) {
        throw new CoupangCrawlerErrorClass({
          code: 'CRAWLING_RETRY_EXHAUSTED',
          message: '페이지 새로고침 재시도 후에도 필수 데이터를 가져오지 못했습니다.',
          details: retryError,
        })
      }
    } catch (error) {
      this.logger.error('상품 정보 크롤링 실패:', error)
      if (error instanceof CoupangCrawlerErrorClass) {
        throw error
      }
      throw new CoupangCrawlerErrorClass({
        code: 'CRAWLING_FAILED',
        message: `상품 정보 크롤링에 실패했습니다. ${error.message}`,
        details: error,
      })
    } finally {
      if (page) {
        await page.close()
      }
    }
  }

  /**
   * 쿠팡 검색 결과 리스트 크롤링 (키워드 기반)
   */
  public async crawlProductList(
    keyword: string,
    limit: number = 5,
  ): Promise<
    {
      rank: number
      title: string
      price: number
      isRocket: boolean
      rocketBadgeUrl: string
      url: string
      image: string
      reviewCount: number
    }[]
  > {
    let page: Page | null = null
    try {
      const query = encodeURIComponent(keyword)
      const url = `https://www.coupang.com/np/search?q=${query}&channel=user`
      page = await this._createPage()
      await page.goto(url, { waitUntil: 'load' })

      // retry 로직으로 목록 추출 (최대 3회 시도)
      const items = await retry(
        async () => {
          await page.reload({ waitUntil: 'load' })

          // 상품 리스트 요소 대기
          await page.waitForSelector('#product-list', { timeout: 5000 })

          const extractedItems = await page.$$eval(
            'li[class^="ProductUnit_productUnit"]',
            (nodes, max) => {
              const results: {
                rank: number
                title: string
                price: number
                isRocket: boolean
                rocketBadgeUrl: string
                url: string
                image: string
                reviewCount: number
              }[] = []

              for (const li of nodes as HTMLElement[]) {
                // 광고 표시 제외: 내부에 class^=AdMark_ 요소가 있으면 skip
                const hasAd = !!li.querySelector('[class^="AdMark_"]')
                if (hasAd) continue

                const anchor = li.querySelector('a') as HTMLAnchorElement | null
                const nameEl = li.querySelector('[class^="ProductUnit_productName"]') as HTMLElement | null
                const priceEls = li.querySelectorAll(
                  '[class^="PriceArea_priceArea"] .fw-font-bold',
                ) as NodeListOf<HTMLElement>
                const rocketBedgeEl = li.querySelector('[class^="ImageBadge_default"] img') as HTMLImageElement | null
                const imageEl = li.querySelector('[class^="ProductUnit_productImage"] img') as HTMLImageElement | null
                const reviewCountEl = li.querySelector('[class^="ProductRating_ratingCount"]') as HTMLElement | null

                // 로켓배송 이미지 URL 추출
                let rocketBadgeUrl = ''
                if (rocketBedgeEl) {
                  rocketBadgeUrl = rocketBedgeEl.getAttribute('src') || ''
                }

                const title = (nameEl?.textContent || '').trim()

                // 가격 요소들을 순회하며 정규표현식에 매칭되는 첫 번째 가격 추출
                let price = 0
                for (const priceEl of Array.from(priceEls)) {
                  const priceText = priceEl.textContent || ''
                  const priceMatch = priceText.match(/\d{1,3}(,\d{3})*원/)
                  if (priceMatch) {
                    price = parseInt(priceMatch[0].replace(/[^\d]/g, ''), 10)
                    break
                  }
                }

                // 리뷰 수 추출 (예: "(397)" 형태)
                const reviewCountText = reviewCountEl?.textContent || ''
                const reviewCountMatch = reviewCountText.match(/\d+/)
                const reviewCount = reviewCountMatch ? parseInt(reviewCountMatch[0], 10) : 0
                let href = anchor?.getAttribute('href') || ''
                if (href && href.startsWith('//')) href = `https:${href}`
                else if (href && href.startsWith('/')) href = `https://www.coupang.com${href}`

                let imageUrl = ''
                if (imageEl) {
                  imageUrl = imageEl.getAttribute('src') || imageEl.getAttribute('data-src') || ''
                  if (imageUrl) {
                    // 320x320ex를 1000x1000ex로 변경하여 고해상도 이미지 가져오기
                    imageUrl = imageUrl.replace(/320x320ex/g, '1000x1000ex')
                  }
                }

                if (!title || !href) continue

                const rank = results.length + 1
                results.push({
                  rank,
                  title,
                  price,
                  isRocket: !!rocketBedgeEl,
                  rocketBadgeUrl,
                  url: href,
                  image: imageUrl,
                  reviewCount,
                })
                if (results.length >= (max as number)) break
              }

              return results
            },
            Math.max(1, limit),
          )

          // 결과가 비어있으면 에러 발생시켜 재시도
          if (extractedItems.length === 0) {
            throw new Error('상품 목록이 추출되지 않았습니다. 재시도합니다.')
          }

          return extractedItems
        },
        2000, // 2초 간격
        3, // 최대 3회 시도
        'linear',
      )

      return items
    } catch (error) {
      this.logger.error('검색 결과 크롤링 실패:', error)
      throw new CoupangCrawlerErrorClass({
        code: 'SEARCH_CRAWLING_FAILED',
        message: '검색 결과 크롤링에 실패했습니다.',
        details: error,
      })
    } finally {
      if (page) await page.close()
    }
  }

  /**
   * 브라우저 인스턴스를 가져옵니다.
   */
  private async _getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: false,
        // Use system Chrome channel and harden flags to avoid HTTP/2 issues in headless
        channel: 'chrome',
        args: [
          '--disable-quic',
          '--disable-http2',
          '--use-spdy=off',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-features=NetworkService',
          '--disable-blink-features=AutomationControlled',
          '--disable-background-networking',
          '--disable-features=VizDisplayCompositor',
        ],
      })
    }
    return this.browser
  }

  /**
   * 브라우저 컨텍스트를 가져옵니다.
   */
  private async _getContext(): Promise<BrowserContext> {
    if (!this.context) {
      const browser = await this._getBrowser()
      this.context = await browser.newContext()
    }
    return this.context
  }

  /**
   * 새로운 페이지를 생성합니다.
   */
  private async _createPage(): Promise<Page> {
    const context = await this._getContext()
    const page = await context.newPage()

    return page
  }

  /**
   * 이미지를 다운로드하고 WebP로 변환합니다.
   */
  private async _downloadAndConvertImage(imageUrl: string, index: number): Promise<string> {
    try {
      // 임시 디렉토리 생성

      const tempDir = path.join(EnvConfig.tempDir, 'coupang-images')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      assert(fs.existsSync(tempDir), '임시 디렉토리 생성에 실패했습니다')

      // 이미지 다운로드
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
      })

      assert(response.status === 200, `이미지 다운로드 실패: ${response.status}`)

      if (response.status !== 200) {
        throw new Error(`이미지 다운로드 실패: ${response.status}`)
      }

      // 이미지 처리 및 WebP 변환
      const imageBuffer = Buffer.from(response.data)
      const processedImageBuffer = await sharp(imageBuffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()

      // 파일명 생성 (타임스탬프 + 인덱스)
      const timestamp = Date.now()
      const filename = `coupang_${timestamp}_${index}.webp`
      const filepath = path.join(tempDir, filename)

      // 파일 저장
      fs.writeFileSync(filepath, processedImageBuffer)

      return filepath
    } catch (error) {
      this.logger.error(`이미지 처리 실패 (${imageUrl}):`, error)
      throw new CoupangCrawlerErrorClass({
        code: 'IMAGE_PROCESSING_FAILED',
        message: '이미지 처리에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 이미지들을 다운로드하고 WebP로 변환합니다.
   */
  private async _processImages(imageUrls: string[]): Promise<string[]> {
    const processedImages: string[] = []

    assert(imageUrls.length > 0, '처리할 이미지가 없습니다')

    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const processedPath = await this._downloadAndConvertImage(imageUrls[i], i)
        processedImages.push(processedPath)
      } catch (error) {
        this.logger.warn(`이미지 처리 실패 (${i + 1}/${imageUrls.length}):`, error)
        processedImages.push(imageUrls[i]) // 실패 시 원본 URL 사용
      }
    }

    return processedImages
  }

  /**
   * 상품 제목을 추출합니다.
   */
  private async _extractProductTitle(page: Page): Promise<string> {
    try {
      // 쿠팡 실제 제목 선택자
      await page.waitForSelector('h1.product-title')
      const titleElement = await page.$('h1.product-title')

      assert(titleElement, '상품 제목 요소를 찾을 수 없습니다')

      if (titleElement) {
        const title = await titleElement.textContent()

        assert(title, '상품 제목 텍스트를 가져올 수 없습니다')

        if (title && title.trim()) {
          return title.trim()
        }
      }

      throw new Error('상품 제목을 찾을 수 없습니다.')
    } catch (error) {
      this.logger.warn('상품 제목 추출 실패:', error)
      return '상품 제목'
    }
  }

  /**
   * 상품 가격을 추출합니다.
   */
  private async _extractProductPrice(page: Page): Promise<number> {
    try {
      // 쿠팡 실제 가격 선택자
      const priceElement = await page.$('.final-price-amount')

      assert(priceElement, '상품 가격 요소를 찾을 수 없습니다')

      if (priceElement) {
        const priceText = await priceElement.textContent()

        assert(priceText, '상품 가격 텍스트를 가져올 수 없습니다')

        if (priceText) {
          // 숫자만 추출
          const price = priceText.replace(/[^\d]/g, '')
          if (price) {
            return parseInt(price, 10)
          }
        }
      }

      throw new Error('상품 가격을 찾을 수 없습니다.')
    } catch (error) {
      this.logger.warn('상품 가격 추출 실패:', error)
      return 0
    }
  }

  /**
   * 상품 이미지를 추출합니다.
   */
  private async _extractProductImages(page: Page): Promise<string[]> {
    try {
      // 요소 대기 후 단일 시도로 추출
      await page.waitForSelector('.product-image li img', { timeout: 5000 })
      const imageElements = await page.$$('.product-image li img')
      assert(imageElements.length > 0, '상품 이미지를 찾을 수 없습니다')

      const collected: string[] = []
      for (const element of imageElements) {
        const src = await element.getAttribute('src')
        if (src) {
          let processedSrc = src
          if (src.startsWith('//')) {
            processedSrc = `https:${src}`
          } else if (!src.startsWith('http')) {
            processedSrc = `https://${src}`
          }

          const highResSrc = processedSrc.replace(/48x48ex/g, '1000x1000ex')
          if (!collected.includes(highResSrc)) {
            collected.push(highResSrc)
          }
        }
      }

      if (collected.length === 0) {
        throw new Error('상품 이미지 URL을 추출하지 못했습니다')
      }

      return collected
    } catch (error) {
      this.logger.warn('상품 이미지 추출 실패:', error)
      throw new CoupangCrawlerErrorClass({
        code: 'IMAGES_NOT_FOUND',
        message: '상품 이미지를 찾을 수 없습니다.',
        details: error,
      })
    }
  }

  /**
   * 상품 리뷰를 추출합니다.
   */
  private async _extractProductReviews(page: Page): Promise<{
    positive: CoupangReview[]
  }> {
    try {
      // 리뷰 섹션으로 스크롤 시도
      await page.evaluate(() => {
        const reviewSection = document.querySelector('.js_reviewArticleReviewList')
        if (reviewSection) {
          reviewSection.scrollIntoView({ behavior: 'smooth' })
        }
      })

      // 요소 대기 후 단일 시도로 추출
      await page.waitForSelector('.sdp-review__article__list.js_reviewArticleReviewList', { timeout: 5000 })
      const reviews = await this._extractReviewsByFilter(page)
      if (!reviews || reviews.length === 0) {
        throw new Error('리뷰가 아직 로드되지 않았습니다')
      }

      return { positive: reviews.slice(0, 5) }
    } catch (error) {
      this.logger.warn('리뷰 추출 실패:', error)
      throw new CoupangCrawlerErrorClass({
        code: 'REVIEWS_NOT_FOUND',
        message: '리뷰를 가져오지 못했습니다.',
        details: error,
      })
    }
  }

  /**
   * 필터를 클릭하고 해당 리뷰들을 추출합니다.
   */
  private async _extractReviewsByFilter(page: Page): Promise<CoupangReview[]> {
    // 리뷰 데이터 추출
    return await page.$$eval('.sdp-review__article__list.js_reviewArticleReviewList', nodes =>
      nodes.map(node => ({
        author: node.querySelector('.sdp-review__article__list__info__user__name')?.textContent?.trim() || '익명',
        date: node.querySelector('.sdp-review__article__list__info__product-info__reg-date')?.textContent?.trim() || '',
        content: node.querySelector('.sdp-review__article__list__review')?.textContent?.trim() || '리뷰 내용',
        rating: parseInt(
          node
            .querySelector('.sdp-review__article__list__info__product-info__star-orange')
            ?.getAttribute('data-rating'),
          10,
        ),
      })),
    )
  }
}
