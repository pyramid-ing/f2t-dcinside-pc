import type { DcinsidePostDto } from '@main/app/modules/dcinside/api/dto/dcinside-post.dto'
import { DcinsidePostSchema } from '@main/app/modules/dcinside/api/dto/dcinside-post.schema'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { sleep } from '@main/app/utils/sleep'
import { retry } from '@main/app/utils/retry'
import { Injectable, Logger } from '@nestjs/common'
import { OpenAI } from 'openai'
import { BrowserContext, chromium, Page } from 'playwright'
import { ZodError } from 'zod/v4'
import { CookieService } from '@main/app/modules/util/cookie.service'
import { PostJob } from '@prisma/client'
import UserAgent from 'user-agents'

type GalleryType = 'board' | 'mgallery' | 'mini' | 'person'

interface GalleryInfo {
  id: string
  type: GalleryType
}

interface ParsedPostJob {
  id: string
  title: string
  contentHtml: string
  galleryUrl: string
  headtext?: string | null
  nickname?: string | null
  password?: string | null
  imagePaths?: string[]
  imagePosition?: '상단' | '하단' | null
}

// Assertion functions
function assertElementExists<T>(element: T | null, errorMessage: string): asserts element is T {
  if (!element) {
    throw new Error(errorMessage)
  }
}

function assertValidGalleryUrl(url: string): asserts url is string {
  const urlMatch = url.match(/[?&]id=([^&]+)/)
  if (!urlMatch) {
    throw new Error('갤러리 주소에서 id를 추출할 수 없습니다.')
  }
}

function assertOpenAIResponse(response: any): asserts response is { answer: string } {
  if (!response?.answer || typeof response.answer !== 'string') {
    throw new Error('OpenAI 응답에서 answer 필드를 찾을 수 없습니다.')
  }
}

function assertValidPopupPage(popupPage: any): asserts popupPage is Page {
  if (!popupPage) {
    throw new Error('이미지 팝업 윈도우를 찾을 수 없습니다.')
  }
}

function assertRetrySuccess(success: boolean, errorMessage: string): asserts success is true {
  if (!success) {
    throw new Error(errorMessage)
  }
}

// 커서를 이동하는 함수
async function moveCursorToPosition(page: any, position: '상단' | '하단') {
  await page.evaluate(pos => {
    const editor = document.querySelector('.note-editor .note-editable') as HTMLElement
    if (editor) {
      editor.focus()

      const selection = window.getSelection()
      if (!selection) return

      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(pos === '상단') // 시작 또는 끝 위치로 커서 이동

      selection.removeAllRanges()
      selection.addRange(range)
    }
  }, position)
}

@Injectable()
export class DcinsidePostingService {
  private readonly logger = new Logger(DcinsidePostingService.name)
  constructor(
    private readonly settingsService: SettingsService,
    private readonly cookieService: CookieService,
    private readonly jobLogsService: JobLogsService,
  ) {}

  async launch(headless: boolean) {
    const browser = await chromium.launch({
      headless,
      executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
    })

    const context = await browser.newContext({
      viewport: { width: 1200, height: 1142 },
      userAgent: new UserAgent({ deviceCategory: 'desktop' }).toString(),
    })
    // 세션 스토리지 초기화
    await context.addInitScript(() => {
      window.sessionStorage.clear()
    })

    return { browser, context }
  }

  async login(page: Page, params: { id: string; password: string }): Promise<{ success: boolean; message: string }> {
    try {
      await page.goto('https://dcinside.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })

      // 로그인 폼 입력 및 로그인 버튼 클릭
      await page.fill('#user_id', params.id)
      await page.fill('#pw', params.password)
      await page.click('#login_ok')
      await sleep(2000)

      // 로그인 체크
      const isLoggedIn = await this.isLogin(page)
      if (isLoggedIn) {
        // 쿠키 저장
        const context = page.context()
        const cookies = await context.cookies()
        this.cookieService.saveCookies('dcinside', params.id, cookies)
        return { success: true, message: '로그인 성공' }
      } else {
        return { success: false, message: '로그인 실패' }
      }
    } catch (e) {
      this.logger.error(`페이지 로그인 실패: ${e.message}`)
      return { success: false, message: e.message }
    }
  }

  async isLogin(page: Page): Promise<boolean> {
    try {
      await page.goto('https://dcinside.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForSelector('#login_box', { timeout: 10000 })
      const userNameExists = (await page.locator('#login_box .user_name').count()) > 0
      return userNameExists
    } catch {
      return false
    }
  }

  private validateParams(rawParams: any): DcinsidePostDto {
    try {
      return DcinsidePostSchema.parse(rawParams)
    } catch (error) {
      if (error instanceof ZodError) {
        const zodErrors = error.issues.map(err => `${err.path.join('.')}: ${err.message}`)
        throw new Error(`포스팅 파라미터 검증 실패: ${zodErrors.join(', ')}`)
      }
      throw new Error(`포스팅 파라미터 검증 실패: ${error.message}`)
    }
  }

  private parsePostJobData(postJob: PostJob): ParsedPostJob {
    let imagePaths: string[] = []

    // imagePaths JSON 문자열 파싱
    if (postJob.imagePaths) {
      try {
        const parsed = JSON.parse(postJob.imagePaths)
        if (Array.isArray(parsed)) {
          imagePaths = parsed.filter(path => typeof path === 'string')
        }
      } catch (error) {
        this.logger.warn(`imagePaths 파싱 실패: ${error.message}`)
      }
    }

    return {
      id: postJob.id,
      title: postJob.title,
      contentHtml: postJob.contentHtml,
      galleryUrl: postJob.galleryUrl,
      headtext: postJob.headtext,
      nickname: postJob.nickname,
      password: postJob.password,
      imagePaths,
      imagePosition: postJob.imagePosition as '상단' | '하단' | null,
    }
  }

  private extractGalleryInfo(galleryUrl: string): GalleryInfo {
    // URL에서 id 파라미터 추출
    assertValidGalleryUrl(galleryUrl)
    const urlMatch = galleryUrl.match(/[?&]id=([^&]+)/)!
    const id = urlMatch[1]

    // 갤러리 타입 판별
    let type: GalleryType
    if (galleryUrl.includes('/mgallery/')) {
      type = 'mgallery'
    } else if (galleryUrl.includes('/mini/')) {
      type = 'mini'
    } else if (galleryUrl.includes('/person/')) {
      type = 'person'
    } else {
      type = 'board' // 일반갤러리
    }

    this.logger.log(`갤러리 정보 추출: ID=${id}, Type=${type}`)
    return { id, type }
  }

  private buildGalleryUrl(galleryInfo: GalleryInfo): string {
    const { id, type } = galleryInfo

    switch (type) {
      case 'board':
        return `https://gall.dcinside.com/board/lists/?id=${id}`
      case 'mgallery':
        return `https://gall.dcinside.com/mgallery/board/lists/?id=${id}`
      case 'mini':
        return `https://gall.dcinside.com/mini/board/lists/?id=${id}`
      case 'person':
        return `https://gall.dcinside.com/person/board/lists/?id=${id}`
      default:
        throw new Error(`지원하지 않는 갤러리 타입: ${type}`)
    }
  }

  private async solveCapcha(page: Page): Promise<void> {
    const captchaImg = page.locator('#kcaptcha')
    const captchaCount = await captchaImg.count()
    if (captchaCount === 0) return

    const captchaBase64 = await captchaImg.screenshot({ type: 'png' })
    const captchaBase64String = captchaBase64.toString('base64')
    const globalSettings = await this.settingsService.findByKey('global')
    const openAIApiKey = (globalSettings?.data as any)?.openAIApiKey
    if (!openAIApiKey) throw new Error('OpenAI API 키가 설정되어 있지 않습니다.')

    const openai = new OpenAI({ apiKey: openAIApiKey })

    // OpenAI 호출 재시도 로직 (최대 3회)
    const answer = await retry(
      async () => {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content:
                'You are a CAPTCHA solver that ONLY responds with JSON format: { "answer": "captcha_text" }. Never provide explanations or additional text.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `이 이미지는 CAPTCHA입니다. 
규칙:
- 캡챠는 영어 소문자(a-z)와 숫자(0-9)로만 구성됩니다
- 대문자는 절대 포함되지 않습니다
- 특수문자나 공백은 없습니다
- 보통 4-6자리입니다

이미지를 정확히 읽고 반드시 다음 JSON 형식으로만 응답하세요:
{ "answer": "정답" }

정답은 이미지에 보이는 문자를 정확히 입력하세요.`,
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/png;base64,${captchaBase64String}` },
                },
              ],
            },
          ],
          temperature: 0,
          max_completion_tokens: 50,
        })

        const responseContent = response.choices[0]?.message?.content
        if (!responseContent) {
          throw new Error('OpenAI 응답이 비어있습니다.')
        }

        const parsed = JSON.parse(responseContent)
        assertOpenAIResponse(parsed)
        return parsed.answer
      },
      1000,
      3,
      'linear',
    )

    // 기존 입력값을 지우고 새로 입력
    await page.evaluate(() => {
      const el = document.querySelector('input[name=kcaptcha_code]') as HTMLInputElement | null
      if (el) el.value = ''
    })
    await page.fill('input[name=kcaptcha_code]', answer)
  }

  private async waitForCustomPopup(page: Page): Promise<{ isCustomPopup: true; message: string } | null> {
    // UI 기반 팝업 대기 (커스텀 팝업 - 창 형태)
    try {
      // 커스텀 팝업이 나타날 때까지 대기 (최대 8초)
      await page.waitForSelector('.pop_wrap[style*="display: block"]', { timeout: 8000 })

      // 팝업 내용 추출
      const popupContent = await page.evaluate(() => {
        const popup = document.querySelector('.pop_wrap[style*="display: block"]')
        return popup ? popup.textContent?.trim() || '' : ''
      })

      // 팝업이 존재하면 메시지와 함께 반환
      this.logger.warn(`커스텀 팝업 발견: ${popupContent}`)
      return {
        isCustomPopup: true,
        message: popupContent,
      }
    } catch {
      // 팝업이 나타나지 않으면 null 반환 (정상 상황)
      return null
    }
  }

  private async inputPassword(page: Page, password: string): Promise<void> {
    const passwordExists = (await page.locator('#password').count()) > 0
    if (passwordExists) {
      await page.fill('#password', password.toString())
    }
  }

  private async inputTitle(page: Page, title: string): Promise<void> {
    await page.waitForSelector('#subject', { timeout: 10000 })
    await page.fill('#subject', title)
  }

  private async selectHeadtext(page: Page, headtext: string): Promise<void> {
    try {
      await page.waitForSelector('.write_subject .subject_list li', { timeout: 5000 })
      // 말머리 리스트에서 일치하는 항목 찾아서 클릭
      const found = await page.evaluate(headtext => {
        const items = Array.from(document.querySelectorAll('.write_subject .subject_list li'))
        for (const item of items) {
          const anchor = item.querySelector('a')
          if (anchor && anchor.textContent?.trim() === headtext) {
            ;(anchor as HTMLElement).click()
            return true
          }
        }
        return false
      }, headtext)

      if (!found) {
        this.logger.warn(`말머리 "${headtext}"를 찾을 수 없습니다.`)
        throw new Error(`말머리 "${headtext}"를 찾을 수 없습니다.`)
      }

      this.logger.log(`말머리 "${headtext}" 선택 완료`)
      await sleep(1000)
    } catch (error) {
      if (error.message.includes('말머리')) {
        throw error // 말머리 오류는 그대로 전파
      }
      this.logger.warn(`말머리 선택 중 오류 (무시하고 계속): ${error.message}`)
    }
  }

  private async inputContent(page: Page, contentHtml: string): Promise<void> {
    // HTML 모드 체크박스 활성화
    await page.waitForSelector('#chk_html', { timeout: 10000 })

    const htmlChecked = await page.locator('#chk_html').isChecked()
    if (!htmlChecked) {
      await page.click('#chk_html')
    }

    // HTML 코드 입력
    await page.waitForSelector('.note-editor .note-codable', { timeout: 5000 })
    await page.evaluate(html => {
      const textarea = document.querySelector('.note-editor .note-codable') as HTMLTextAreaElement
      if (textarea) {
        textarea.value = html
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
        textarea.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }, contentHtml)

    // HTML 모드 다시 해제 (일반 에디터로 전환하여 내용 확인)
    await sleep(500)
    const htmlChecked2 = await page.locator('#chk_html').isChecked()
    if (htmlChecked2) {
      await page.click('#chk_html')
    }
  }

  private async uploadImages(
    page: Page,
    browserContext: BrowserContext,
    imagePaths: string[],
    imagePosition: '상단' | '하단',
  ): Promise<void> {
    // 이미지가 없으면 바로 리턴
    if (!imagePaths || imagePaths.length === 0) {
      return
    }
    await moveCursorToPosition(page, imagePosition)

    // 앱 설정 가져오기 (이미지 업로드 실패 처리 방식)
    const appSettings = await this.settingsService.getAppSettings()

    try {
      await this.performImageUpload(page, browserContext, imagePaths)
      this.logger.log('이미지 업로드 성공')
    } catch (imageUploadError) {
      const errorMessage = `이미지 업로드 실패: ${imageUploadError.message}`
      this.logger.warn(errorMessage)

      // 설정에 따른 처리
      const imageFailureAction = appSettings.imageUploadFailureAction || 'fail'

      switch (imageFailureAction) {
        case 'fail':
          // 작업 실패 - 전체 포스팅 중단
          throw new Error(errorMessage)
        case 'skip':
          this.logger.log('이미지 업로드 실패하였으나 설정에 따라 이미지 없이 포스팅을 진행합니다.')
          break
      }
    }
  }

  private async performImageUpload(page: Page, browserContext: BrowserContext, imagePaths: string[]): Promise<void> {
    // 이미지 업로드 다이얼로그 처리
    const handleImageUploadDialog = (dialog: any) => {
      const message = dialog.message()
      this.logger.log(`이미지 업로드 다이얼로그: ${message}`)

      // 파일 업로드 다이얼로그인 경우 파일 선택
      if (dialog.type() === 'beforeunload' || message.includes('업로드')) {
        // 파일 경로들을 한 번에 설정
        if (imagePaths && imagePaths.length > 0) {
          // Playwright에서는 setInputFiles 사용
          dialog.accept()
        }
      } else {
        dialog.accept()
      }
    }

    let popupPage: Page | null = null
    try {
      // 팝업이 열릴 때까지 대기하는 Promise 생성
      const popupPromise = browserContext.waitForEvent('page')

      // 다이얼로그 이벤트 리스너 등록
      page.on('dialog', handleImageUploadDialog)

      // 이미지 버튼 클릭하여 팝업 열기
      await page.click('button[aria-label="이미지"]')

      // 팝업 페이지 대기
      popupPage = await popupPromise
      assertValidPopupPage(popupPage)

      await popupPage.waitForLoadState('domcontentloaded')
      this.logger.log('이미지 업로드 팝업 열림')

      // 팝업에서 파일 업로드 처리
      const fileInput = popupPage.locator('input[type="file"]')
      await fileInput.setInputFiles(imagePaths)

      // 업로드 완료 대기
      await this.waitForImageUploadComplete(popupPage, imagePaths.length)

      // '적용' 버튼 클릭
      await this.clickApplyButtonSafely(popupPage)

      this.logger.log('이미지 업로드 및 적용 완료')
    } catch (error) {
      this.logger.error(`이미지 업로드 중 오류: ${error.message}`)
      throw error
    } finally {
      // 이벤트 리스너 제거
      page.removeListener('dialog', handleImageUploadDialog)

      // 팝업 닫기
      if (popupPage && !popupPage.isClosed()) {
        await popupPage.close()
      }
    }
  }

  private async waitForImageUploadComplete(popup: Page, expectedImageCount: number): Promise<void> {
    this.logger.log('이미지 업로드 완료 대기 중...')

    const maxWaitTime = 60000 // 최대 60초 대기
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // 로딩 박스가 있는지 확인
        const loadingBox = await popup.$('.loding_box')
        if (loadingBox) {
          this.logger.log('이미지 업로드 진행 중...')
          await sleep(2000)
          continue
        }

        // 업로드된 이미지 리스트 확인
        const uploadedImages = await popup.$$('ul#sortable li[data-key]')
        this.logger.log(`업로드된 이미지 수: ${uploadedImages.length}/${expectedImageCount}`)

        if (uploadedImages.length >= expectedImageCount) {
          // 모든 이미지가 data-key를 가지고 있는지 확인
          const allHaveDataKey = await popup.evaluate(() => {
            const items = document.querySelectorAll('ul#sortable li')
            return Array.from(items).every(item => item.hasAttribute('data-key'))
          })

          if (allHaveDataKey) {
            this.logger.log('모든 이미지 업로드 완료!')
            break
          }
        }

        await sleep(1000)
      } catch (error) {
        this.logger.warn(`업로드 상태 확인 중 오류: ${error.message}`)
        await sleep(1000)
      }
    }

    // 추가 안정화 대기
    await sleep(2000)
  }

  private async clickApplyButtonSafely(popup: Page): Promise<void> {
    this.logger.log('적용 버튼 클릭 시도...')

    await retry(
      async () => {
        // 적용 버튼 존재 확인
        await popup.waitForSelector('.btn_apply', { timeout: 5000 })
        await popup.click('.btn_apply')
        // 클릭 후 팝업 닫힘 확인 (1초 대기)
        await sleep(1000)
        if (popup.isClosed()) {
          this.logger.log('팝업이 닫혔습니다. 이미지 업로드 완료.')
          return true
        }
        throw new Error('팝업이 아직 닫히지 않았습니다.')
      },
      1000,
      10,
      'linear',
    )
  }

  private async inputNickname(page: Page, nickname: string): Promise<void> {
    try {
      // 닉네임 입력 영역이 표시될 때까지 대기
      await page.waitForSelector('#gall_nick_name', { state: 'visible', timeout: 10000 })

      // 닉네임 입력창 X 버튼이 있으면 클릭하여 활성화
      const xBtnExists = (await page.locator('#btn_gall_nick_name_x').count()) > 0
      if (xBtnExists) {
        await page.click('#btn_gall_nick_name_x')
        await sleep(500)
      }

      // 닉네임 입력 필드 대기 및 활성화
      await page.waitForSelector('#name')
      const nameElementExists = (await page.locator('#name').count()) > 0
      if (nameElementExists) {
        await page.click('#name')
        // 기존 내용 삭제 후 새 닉네임 입력
        await page.locator('#name').evaluate((el: HTMLInputElement, nickname: string) => {
          el.value = ''
          el.value = nickname
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }, nickname)

        this.logger.log(`닉네임 입력 완료: ${nickname}`)
      }
    } catch (error) {
      this.logger.warn(`닉네임 입력 중 오류 (무시하고 계속): ${error.message}`)
    }
  }

  private async submitPostAndHandleErrors(page: Page): Promise<void> {
    const captchaErrorMessages = ['자동입력 방지코드가 일치하지 않습니다.', 'code은(는) 영문-숫자 조합이어야 합니다.']
    let captchaTryCount = 0

    while (true) {
      await this.solveCapcha(page)

      let dialogHandler: ((dialog: any) => Promise<void>) | null = null
      let timeoutId: NodeJS.Timeout | null = null

      try {
        // dialog(알림창) 대기 프로미스
        const dialogPromise: Promise<string | null> = new Promise(resolve => {
          let dialogHandled = false // 다이얼로그 처리 여부 플래그

          dialogHandler = async (dialog: any) => {
            if (dialogHandled) {
              this.logger.warn('다이얼로그가 이미 처리되었습니다.')
              resolve(null)
              return
            }

            try {
              dialogHandled = true
              const msg = dialog.message()

              // dialog가 이미 처리되었는지 확인 (Puppeteer 내부 상태)
              if (!dialog._handled) {
                await dialog.accept()
              } else {
                this.logger.warn('다이얼로그가 이미 처리된 상태입니다.')
              }

              resolve(msg)
            } catch (error) {
              // "Cannot accept dialog which is already handled!" 오류는 무시
              if (error.message.includes('already handled')) {
                this.logger.warn('다이얼로그가 이미 처리된 상태에서 accept 시도됨 (무시)')
                resolve(null)
              } else {
                this.logger.warn(`다이얼로그 처리 중 오류: ${error.message}`)
                resolve(null)
              }
            }
          }

          page.once('dialog', dialogHandler)
        })

        // 타임아웃 프로미스 (8초)
        const timeoutPromise: Promise<null> = new Promise(resolve => {
          timeoutId = setTimeout(() => {
            resolve(null)
          }, 8000)
        })

        // 등록 버튼 클릭 후, alert 또는 정상 이동 여부 확인
        await page.click('button.btn_svc.write')

        // 커스텀 팝업 대기 프로미스
        const customPopupPromise = this.waitForCustomPopup(page)

        // dialog, timeout, navigation, custom popup 중 먼저 완료되는 것을 대기
        const result = await Promise.race([
          dialogPromise,
          timeoutPromise,
          customPopupPromise,
          page
            .waitForURL(/\/lists/, { timeout: 10000 })
            .then(() => null)
            .catch(() => null),
        ])

        // 커스텀 팝업 결과 처리
        if (result && typeof result === 'object' && 'isCustomPopup' in result) {
          throw new Error(`글 등록 실패: ${result.message}`)
        }

        const dialogMessage = result

        // 알림창이 떴을 경우 처리
        if (dialogMessage) {
          // 캡챠 오류 메시지일 경우에만 재시도
          if (captchaErrorMessages.some(m => dialogMessage.includes(m))) {
            captchaTryCount += 1
            if (captchaTryCount >= 3) throw new Error('캡챠 해제 실패(3회 시도)')

            // 새 캡챠 이미지를 로드하기 위해 이미지 클릭
            try {
              await page.evaluate(() => {
                const img = document.getElementById('kcaptcha') as HTMLImageElement | null
                if (img) img.click()
              })
            } catch {}

            await sleep(1000)
            continue // while – 다시 등록 버튼 클릭 시도
          } else {
            // 캡챠 오류가 아닌 다른 오류 (IP 블락, 권한 없음 등) - 즉시 실패 처리
            throw new Error(`글 등록 실패: ${dialogMessage}`)
          }
        }

        // dialog가 없으면 성공으로 간주하고 루프 탈출
        break
      } finally {
        // 다이얼로그 이벤트 리스너와 타이머 정리
        if (dialogHandler) {
          page.removeListener('dialog', dialogHandler)
        }
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    }
  }

  private async extractPostUrl(page: Page, title: string): Promise<string> {
    const currentUrl = page.url()
    let postUrl = null
    try {
      // 목록 테이블에서 제목이 일치하는 첫 번째 글의 a href 추출
      await page.waitForSelector('table.gall_list', { timeout: 10000 })
      postUrl = await page.evaluate(title => {
        const rows = Array.from(document.querySelectorAll('table.gall_list tbody tr.ub-content'))
        for (const row of rows) {
          const titTd = row.querySelector('td.gall_tit.ub-word')
          if (!titTd) continue
          const a = titTd.querySelector('a')
          if (!a) continue
          // 제목 텍스트 추출 (em, b 등 태그 포함 가능)
          const text = a.textContent?.replace(/\s+/g, ' ').trim()
          if (text === title) {
            return a.getAttribute('href')
          }
        }
        return null
      }, title)
    } catch {}

    if (postUrl) {
      if (postUrl.startsWith('/')) {
        return `https://gall.dcinside.com${postUrl}`
      } else {
        return postUrl
      }
    }
    return currentUrl
  }

  private async waitForListPageNavigation(page: Page, galleryInfo: GalleryInfo): Promise<void> {
    this.logger.log('게시글 목록으로 이동 대기 중...')

    try {
      // URL 변경 또는 특정 요소 나타날 때까지 대기
      await Promise.race([
        // 1. URL이 목록 페이지로 변경되길 대기
        page.waitForFunction(
          expectedUrl => {
            return window.location.href.includes('/lists') || window.location.href.includes(expectedUrl)
          },
          this.buildGalleryUrl(galleryInfo),
          { timeout: 15000 },
        ),

        // 2. 게시글 목록 테이블이 나타날 때까지 대기
        page.waitForSelector('table.gall_list', { timeout: 15000 }),

        // 3. 네비게이션 이벤트 대기
        page.waitForURL(/\/lists/, { timeout: 15000 }),
      ])

      this.logger.log('게시글 목록 페이지로 이동 완료')
    } catch (error) {
      this.logger.warn(`목록 페이지 이동 대기 중 타임아웃: ${error.message}`)
      throw new Error('글 등록 후 목록 페이지 이동 실패 - 글 등록이 정상적으로 완료되지 않았습니다.')
    }
  }

  private async navigateToWritePage(page: Page, galleryInfo: GalleryInfo): Promise<void> {
    const success = await retry(
      async () => {
        const listUrl = this.buildGalleryUrl(galleryInfo)
        this.logger.log(`글쓰기 페이지 이동 시도: ${listUrl} (${galleryInfo.type} 갤러리)`)
        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
        // 글쓰기 버튼 클릭 (goWrite)
        await page.waitForSelector('a.btn_write.txt', { timeout: 10000 })
        await page.click('a.btn_write.txt')
        await sleep(4000)
        // 글쓰기 페이지로 정상 이동했는지 확인
        const currentUrl = page.url()
        if (!currentUrl.includes('/write')) {
          this.logger.warn('글쓰기 페이지로 이동하지 못했습니다.')
          return false
        }
        this.logger.log('글쓰기 페이지 이동 성공')
        return true
      },
      1000,
      3,
      'linear',
    )
    assertRetrySuccess(success, '글쓰기 페이지 이동 실패 (3회 시도)')
  }

  async postArticle(
    postJob: PostJob,
    browserContext: BrowserContext,
    page: Page,
    jobId: string,
  ): Promise<{ success: boolean; message: string; url?: string }> {
    try {
      // 0. PostJob 데이터 파싱
      const parsedPostJob = this.parsePostJobData(postJob)
      await this.jobLogsService.createJobLog(jobId, 'PostJob 데이터 파싱 완료')

      // 0-1. 앱 설정 가져오기 (이미지 업로드 실패 처리 방식)
      const appSettings = await this.settingsService.getAppSettings()
      await this.jobLogsService.createJobLog(jobId, '앱 설정 가져오기 완료')

      // 1. 갤러리 정보 추출 (id와 타입)
      const galleryInfo = this.extractGalleryInfo(parsedPostJob.galleryUrl)
      await this.jobLogsService.createJobLog(
        jobId,
        `갤러리 정보 추출 완료: ${galleryInfo.type} 갤러리 (${galleryInfo.id})`,
      )

      await this.jobLogsService.createJobLog(jobId, '페이지 생성 완료')

      // 2. 글쓰기 페이지 이동 (리스트 → 글쓰기 버튼 클릭)
      await this.navigateToWritePage(page, galleryInfo)
      await this.jobLogsService.createJobLog(jobId, '글쓰기 페이지 이동 완료')
      await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환

      // 3. 입력폼 채우기
      await this.inputTitle(page, parsedPostJob.title)
      await this.jobLogsService.createJobLog(jobId, `제목 입력 완료: "${parsedPostJob.title}"`)
      await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환

      if (parsedPostJob.headtext) {
        await this.selectHeadtext(page, parsedPostJob.headtext)
        await this.jobLogsService.createJobLog(jobId, `말머리 선택 완료: "${parsedPostJob.headtext}"`)
        await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환
      }

      if (parsedPostJob.nickname) {
        await this.inputNickname(page, parsedPostJob.nickname)
        await this.jobLogsService.createJobLog(jobId, `닉네임 입력 완료: "${parsedPostJob.nickname}"`)
        await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환
      }

      if (parsedPostJob.password) {
        await this.inputPassword(page, parsedPostJob.password)
        await this.jobLogsService.createJobLog(jobId, '비밀번호 입력 완료')
        await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환
      }

      await this.inputContent(page, parsedPostJob.contentHtml)
      await this.jobLogsService.createJobLog(jobId, '글 내용 입력 완료')
      await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환

      // 이미지 등록 (imagePaths, 팝업 윈도우 방식)
      if (parsedPostJob.imagePaths && parsedPostJob.imagePaths.length > 0) {
        await this.jobLogsService.createJobLog(jobId, `이미지 업로드 시작: ${parsedPostJob.imagePaths.length}개 이미지`)
        await this.uploadImages(page, browserContext, parsedPostJob.imagePaths, parsedPostJob.imagePosition)
        await this.jobLogsService.createJobLog(jobId, '이미지 업로드 완료')
      }
      await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환

      // 캡챠(자동등록방지) 처리 및 등록 버튼 클릭을 최대 3회 재시도
      await this.jobLogsService.createJobLog(jobId, '캡챠 처리 및 글 등록 시작')
      await this.submitPostAndHandleErrors(page)
      await this.jobLogsService.createJobLog(jobId, '글 등록 완료')

      // 글 등록 완료 후 목록 페이지로 이동 대기
      await this.waitForListPageNavigation(page, galleryInfo)
      await this.jobLogsService.createJobLog(jobId, '목록 페이지 이동 완료')

      // 글 등록이 성공하여 목록으로 이동했을 시점
      // 글 목록으로 이동 후, 최신글 URL 추출 시도
      const finalUrl = await this.extractPostUrl(page, parsedPostJob.title)
      await this.jobLogsService.createJobLog(jobId, `최종 URL 추출 완료: ${finalUrl}`)

      return { success: true, message: '글 등록 성공', url: finalUrl }
    } catch (e) {
      this.logger.error(`디시인사이드 글 등록 실패: ${e.message}`)
      await this.jobLogsService.createJobLog(jobId, `포스팅 실패: ${e.message}`)
      throw new Error(e.message)
    } finally {
      // 브라우저는 외부에서 관리되므로 여기서 종료하지 않음
    }
  }
}
