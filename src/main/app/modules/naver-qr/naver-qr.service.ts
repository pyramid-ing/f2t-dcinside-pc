import { Injectable, Logger } from '@nestjs/common'
import { Browser, Page } from 'playwright'
import * as XLSX from 'xlsx'
import { BrowserManagerService } from '@main/app/modules/util/browser-manager.service'
import { CreateNaverQRDto, NaverQRResultDto, NaverQRBatchRequestDto, NaverQRBatchResultDto } from './dto/naver-qr.dto'

@Injectable()
export class NaverQRService {
  private readonly logger = new Logger(NaverQRService.name)

  constructor(private readonly browserManager: BrowserManagerService) {}

  async createQRCodeWithBrowser(dto: CreateNaverQRDto): Promise<NaverQRResultDto> {
    const browserId = `naver-qr-${Date.now()}`
    let browser: Browser | null = null

    try {
      // 브라우저 실행 (헤드리스 모드 비활성화)
      browser = await this.browserManager.getOrCreateBrowser(browserId, {
        headless: false,
      })

      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      })

      const page = await context.newPage()

      const result = await this.createQRCode(dto, page, true)

      return result
    } catch (error) {
      this.logger.error(`QR 코드 생성 실패: ${error.message}`)
      throw error
    } finally {
      // 브라우저 종료
      if (browserId) {
        await this.browserManager.closeManagedBrowser(browserId)
      }
    }
  }

  async createBatchQRCodes(dto: NaverQRBatchRequestDto): Promise<NaverQRBatchResultDto> {
    const browserId = `naver-qr-batch-${Date.now()}`
    let browser: Browser | null = null
    const results: NaverQRResultDto[] = []
    const failedItems: { title: string; url: string; error: string }[] = []

    try {
      // 브라우저 실행 (헤드리스 모드 비활성화)
      this.logger.log('브라우저 실행 중...')
      browser = await this.browserManager.getOrCreateBrowser(browserId, {
        headless: false,
      })

      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      })

      const page = await context.newPage()

      // 여러 개의 QR 코드를 for 루프로 처리
      for (let i = 0; i < dto.items.length; i++) {
        const item = dto.items[i]
        this.logger.log(`[${i + 1}/${dto.items.length}] 처리 중: ${item.title}`)

        try {
          // 첫 번째 항목에만 로그인 체크
          const result = await this.createQRCode(item, page, i === 0)
          results.push(result)
          this.logger.log(`[${i + 1}/${dto.items.length}] 성공: ${item.title}`)
        } catch (error) {
          this.logger.error(`[${i + 1}/${dto.items.length}] 실패: ${item.title} - ${error.message}`)
          failedItems.push({
            title: item.title,
            url: item.url,
            error: error.message,
          })
        }

        // 다음 항목 처리를 위해 잠시 대기
        if (i < dto.items.length - 1) {
          await page.waitForTimeout(1000)
        }
      }

      this.logger.log(`배치 처리 완료: 성공 ${results.length}개, 실패 ${failedItems.length}개`)

      return {
        results,
        failedItems,
      }
    } catch (error) {
      this.logger.error(`배치 처리 실패: ${error.message}`)
      throw error
    } finally {
      // 브라우저 종료
      if (browserId) {
        await this.browserManager.closeManagedBrowser(browserId)
      }
    }
  }

  async createQRCode(dto: CreateNaverQRDto, page: Page, checkLogin: boolean = false): Promise<NaverQRResultDto> {
    try {
      // 1. 네이버 QR 코드 생성 페이지 접속
      this.logger.log(`QR 코드 생성 시작: ${dto.title}`)
      await page.goto('https://qr.naver.com/create', { waitUntil: 'networkidle' })
      await page.waitForTimeout(1000)

      // 2. 로그인 여부 체크 (필요한 경우만)
      if (checkLogin) {
        const isLoggedIn = await this.checkLoginStatus(page)

        if (!isLoggedIn) {
          this.logger.warn('로그인되지 않았습니다. 30초 대기 중...')
          await page.waitForTimeout(30000)
        }
      }

      // 3. "다음" 버튼 2번 클릭
      this.logger.log('다음 버튼 클릭 중...')
      const nextButton = page.locator('button[data-testid="form-sumbit-btn"]')

      // 첫 번째 다음 버튼 클릭
      await nextButton.click()
      await page.waitForTimeout(1000)

      // 두 번째 다음 버튼 클릭
      await nextButton.click()
      await page.waitForTimeout(1000)

      // 4. 제목 및 링크 입력
      this.logger.log('제목 및 링크 입력 중...')

      // 페이지 제목 입력
      const titleInput = page.locator('input[name="sections[0].title"]')
      await titleInput.fill(dto.title)
      await page.waitForTimeout(500)

      // URL 입력
      const urlInput = page.locator('input[name="sections[1].url"]')
      await urlInput.fill(dto.url)
      await page.waitForTimeout(500)

      // 링크첨부 버튼 클릭
      const attachButton = page.locator('button:has-text("링크첨부")')
      await attachButton.click()
      await page.waitForTimeout(1000)

      // 5. 다음 버튼 다시 클릭
      this.logger.log('최종 다음 버튼 클릭 중...')
      await nextButton.click()

      // 6. 성공 페이지로 이동 대기
      this.logger.log('성공 페이지 대기 중...')
      await page.waitForURL(/https:\/\/qr\.naver\.com\/success-qr\/.*/, { timeout: 30000 })

      // 7. 단축 URL 추출
      const shortUrl = await this.extractShortUrl(page)

      this.logger.log(`QR 코드 생성 완료: ${shortUrl}`)

      return {
        title: dto.title,
        url: dto.url,
        shortUrl,
      }
    } catch (error) {
      this.logger.error(`QR 코드 생성 실패: ${error.message}`)
      throw error
    }
  }

  private async checkLoginStatus(page: Page): Promise<boolean> {
    try {
      // 로그인 폼이 보이는지 확인
      const loginForm = page.locator('form').first()
      await loginForm.waitFor({ timeout: 5000 })
      return true
    } catch (error) {
      // 로그인 폼이 없으면 로그인 페이지로 리디렉션된 것으로 판단
      const currentUrl = page.url()
      if (currentUrl.includes('nid.naver.com/nidlogin.login')) {
        return false
      }
      return false
    }
  }

  private async extractShortUrl(page: Page): Promise<string> {
    try {
      // 단축 URL 추출
      const linkElement = page.locator('.SuccessQR_qr-info__5FTN6 a[target="_blank"]')
      await linkElement.waitFor({ timeout: 10000 })
      const shortUrl = await linkElement.getAttribute('href')
      return shortUrl || ''
    } catch (error) {
      this.logger.error(`단축 URL 추출 실패: ${error.message}`)
      throw new Error('단축 URL을 추출할 수 없습니다')
    }
  }

  async processExcelFile(file: any): Promise<NaverQRBatchResultDto> {
    try {
      // 엑셀 파일 파싱
      this.logger.log('엑셀 파일 파싱 중...')
      this.logger.log(
        `파일 정보: ${file.originalname}, 크기: ${file.size}, 버퍼: ${file.buffer ? file.buffer.length : 'undefined'}`,
      )

      if (!file.buffer) {
        throw new Error('파일 버퍼가 없습니다.')
      }

      const workbook = XLSX.read(file.buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet) as { 제목?: string; URL?: string; url?: string }[]

      const items = data
        .map(row => ({
          title: row.제목 || '',
          url: row.URL || row.url || '',
        }))
        .filter(item => item.title && item.url)

      if (items.length === 0) {
        throw new Error('엑셀 파일에 제목과 URL이 없습니다.')
      }

      this.logger.log(`엑셀 파일 파싱 완료: ${items.length}개 항목 발견`)

      // 배치 처리
      return this.createBatchQRCodes({ items })
    } catch (error) {
      this.logger.error(`엑셀 파일 처리 실패: ${error.message}`)
      throw error
    }
  }
}
