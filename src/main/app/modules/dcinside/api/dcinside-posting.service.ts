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
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { getProxyByMethod } from '@main/app/modules/util/browser-manager.service'
import { IpMode } from '@main/app/modules/settings/settings.types'

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
    throw new CustomHttpException(ErrorCode.POST_PARAM_INVALID, { message: errorMessage })
  }
}

function assertValidGalleryUrl(url: string): asserts url is string {
  const urlMatch = url.match(/[?&]id=([^&]+)/)
  if (!urlMatch) {
    throw new CustomHttpException(ErrorCode.POST_PARAM_INVALID, { message: '갤러리 주소에서 id를 추출할 수 없습니다.' })
  }
}

function assertOpenAIResponse(response: any): asserts response is { answer: string } {
  if (!response?.answer || typeof response.answer !== 'string') {
    throw new CustomHttpException(ErrorCode.POST_PARAM_INVALID, {
      message: 'OpenAI 응답에서 answer 필드를 찾을 수 없습니다.',
    })
  }
}

function assertValidPopupPage(popupPage: any): asserts popupPage is Page {
  if (!popupPage) {
    throw new CustomHttpException(ErrorCode.IMAGE_UPLOAD_FAILED, { message: '이미지 팝업 윈도우를 찾을 수 없습니다.' })
  }
}

function assertRetrySuccess(success: boolean, errorMessage: string): asserts success is true {
  if (!success) {
    throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, { message: errorMessage })
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

// reCAPTCHA(리캡챠) 감지 함수: 모든 프레임에서 검사
async function detectRecaptcha(page: Page): Promise<boolean> {
  for (const frame of page.frames()) {
    if (await frame.$('#rc-anchor-container')) {
      return true
    }
  }
  return false
}

@Injectable()
export class DcinsidePostingService {
  private readonly logger = new Logger(DcinsidePostingService.name)
  constructor(
    private readonly settingsService: SettingsService,
    private readonly cookieService: CookieService,
    private readonly jobLogsService: JobLogsService,
  ) {}

  async launch() {
    let proxyArg = undefined
    let proxyAuth = undefined
    let lastError = null
    let proxyInfo = null

    const settings = await this.settingsService.getSettings()

    // ipMode가 proxy일 때만 프록시 적용
    if (settings?.ipMode === IpMode.PROXY && settings?.proxies && settings.proxies.length > 0) {
      const method = settings.proxyChangeMethod || 'random'
      const { proxy } = getProxyByMethod(settings.proxies, method)
      if (proxy) {
        proxyArg = `--proxy-server=${proxy.ip}:${proxy.port}`
        proxyAuth = {
          server: `${proxy.ip}:${proxy.port}`,
          ...(proxy.id ? { username: proxy.id } : {}),
          ...(proxy.pw ? { password: proxy.pw } : {}),
        }
        proxyInfo = { ip: proxy.ip, port: proxy.port, id: proxy.id, pw: proxy.pw }
        try {
          const browser = await chromium.launch({
            headless: !settings.showBrowserWindow,
            executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
            args: [proxyArg],
          })
          const context = await browser.newContext({
            viewport: { width: 1200, height: 1142 },
            userAgent: new UserAgent({ deviceCategory: 'desktop' }).toString(),
            proxy: proxyAuth,
          })
          await context.addInitScript(() => {
            window.sessionStorage.clear()
          })
          return { browser, context, proxyInfo }
        } catch (err) {
          this.logger.warn(`프록시 브라우저 실행 실패: ${err.message}`)
          lastError = err
        }
      }
    }
    // fallback: 프록시 없이 재시도
    const browser = await chromium.launch({
      headless: !settings.showBrowserWindow,
      executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH,
    })
    const context = await browser.newContext({
      viewport: { width: 1200, height: 1142 },
      userAgent: new UserAgent({ deviceCategory: 'desktop' }).toString(),
    })
    await context.addInitScript(() => {
      window.sessionStorage.clear()
    })
    if (lastError) this.logger.warn('프록시 모드 실패 또는 미적용으로 프록시 없이 브라우저를 재시도합니다.')
    return { browser, context, proxyInfo: null }
  }

  async login(page: Page, params: { id: string; password: string }): Promise<{ success: boolean; message: string }> {
    try {
      await page.goto('https://dcinside.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 })

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
      // 현재 페이지에서 #login_box가 이미 존재하는지 확인
      const loginBoxExists = await page.$('#login_box')

      if (!loginBoxExists) {
        // #login_box가 없으면 메인 페이지로 이동
        await page.goto('https://dcinside.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await page.waitForSelector('#login_box', { timeout: 10000 })
      }

      // 로그인 여부 확인 (user_name이 있으면 로그인된 상태)
      const userName = await page.waitForSelector('#login_box .user_name', { timeout: 5000 })
      return !!userName
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
        throw new CustomHttpException(ErrorCode.POST_PARAM_INVALID, {
          message: `포스팅 파라미터 검증 실패: ${zodErrors.join(', ')}`,
        })
      }
      throw new CustomHttpException(ErrorCode.POST_PARAM_INVALID, {
        message: `포스팅 파라미터 검증 실패: ${error.message}`,
      })
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
        throw new CustomHttpException(ErrorCode.GALLERY_TYPE_UNSUPPORTED, { type })
    }
  }

  private async solveCapcha(page: Page): Promise<void> {
    const captchaImg = page.locator('#kcaptcha')
    const captchaCount = await captchaImg.count()
    if (captchaCount === 0) return
    // 캡챠 클릭해서 리프레쉬
    await captchaImg.click()
    await sleep(2000)

    const captchaBase64 = await captchaImg.screenshot({ type: 'png' })
    const captchaBase64String = captchaBase64.toString('base64')
    const settings = await this.settingsService.getSettings()
    const openAIApiKey = settings.openAIApiKey
    if (!openAIApiKey) throw new CustomHttpException(ErrorCode.OPENAI_APIKEY_REQUIRED)

    const openai = new OpenAI({ apiKey: openAIApiKey })

    // OpenAI 호출 재시도 로직 (최대 3회)
    const answer = await retry(
      async () => {
        const response = await openai.chat.completions.create({
          model: 'gpt-5-mini',
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
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'captcha_schema',
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  answer: { type: 'string' },
                },
                required: ['answer'],
              },
              strict: true,
            },
          },
        })

        const responseContent = response.choices[0]?.message?.content
        if (!responseContent) {
          throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, { message: 'OpenAI 응답이 비어있습니다.' })
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

  async deleteArticleByResultUrl(post: PostJob, page: Page, jobId: string, isMember?: boolean): Promise<void> {
    const idMatch = post.galleryUrl.match(/[?&]id=([^&]+)/)
    const galleryId = idMatch ? idMatch[1] : null
    let galleryType: 'board' | 'mgallery' | 'mini' | 'person' = 'board'
    if (post.galleryUrl.includes('/mgallery/')) galleryType = 'mgallery'
    else if (post.galleryUrl.includes('/mini/')) galleryType = 'mini'
    else if (post.galleryUrl.includes('/person/')) galleryType = 'person'

    if (!galleryId) {
      throw new CustomHttpException(ErrorCode.POST_PARAM_INVALID, { message: '갤러리 ID를 추출할 수 없습니다.' })
    }

    const noMatch = post.resultUrl.match(/[?&]no=(\d+)/)
    const postNo = noMatch ? noMatch[1] : null
    if (!postNo) {
      throw new CustomHttpException(ErrorCode.POST_PARAM_INVALID, { message: '게시글 ID(no)를 추출할 수 없습니다.' })
    }

    const deletePath = galleryType === 'board' ? 'board/delete' : `${galleryType}/board/delete`
    const deleteUrl = `https://gall.dcinside.com/${deletePath}/?id=${galleryId}&no=${postNo}`
    await this.jobLogsService.createJobLog(jobId, `삭제 페이지 이동: ${deleteUrl}`)
    await page.goto(deleteUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    await sleep(2000) // 2초 고정 딜레이

    // 비정상 페이지(이미 삭제/존재하지 않음 등) 문구 감지 시: 해당 문구를 에러 메시지로 예외 처리
    const abnormalText = await page.evaluate(() => {
      const el = document.querySelector('.box_infotxt.delet strong') as HTMLElement | null
      return el?.textContent?.trim() || null
    })
    if (abnormalText) {
      throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, { message: abnormalText })
    }

    // 삭제 버튼 클릭 후, dialog(확인 → 알림) 순서대로 처리
    let confirmMessage = ''
    let alertMessage = ''
    // 상위에서 로그인 시도 여부 반영: true면 회원, 아니면 비회원 처리
    if (!isMember) {
      if (!post.password) {
        throw new CustomHttpException(ErrorCode.POST_PARAM_INVALID, {
          message: '삭제 비밀번호가 설정되지 않았습니다.',
        })
      }
      const pwInput = page.locator('#password')
      await pwInput.fill(post.password)
      await sleep(2000) // 2초 고정 딜레이
    }

    const dialogHandler = async (dialog: any) => {
      try {
        await sleep(1000)

        const type = dialog.type?.() || 'unknown'
        const msg = dialog.message?.() || ''
        switch (type) {
          case 'confirm':
            confirmMessage = msg
            break
          case 'alert':
            alertMessage = msg
            break
        }
        await dialog.accept()

        await sleep(1000)
      } catch (_) {}
    }
    page.on('dialog', dialogHandler)

    // 삭제 버튼 한 번만 클릭
    await page
      .locator('.btn_ok')
      .click({ timeout: 5000 })
      .catch(() => {})
    await sleep(2000)

    // 다이얼로그 처리 대기: alertMessage가 채워지면 즉시 진행, 최대 30초 대기
    {
      const start = Date.now()
      while (!alertMessage && Date.now() - start < 30_000) {
        await sleep(200)
      }
    }

    // 리스너 해제
    page.off('dialog', dialogHandler)

    // alert 메시지 우선으로 결과 판정 (없으면 빈 문자열)
    if (alertMessage.includes('게시물이 삭제 되었습니다')) {
      await this.jobLogsService.createJobLog(jobId, '삭제 성공: 게시물이 삭제되었습니다.')
      return
    }
    // 비밀번호 오류
    if (alertMessage.includes('비밀번호가 맞지 않습니다')) {
      throw new CustomHttpException(ErrorCode.POST_PARAM_INVALID, { message: '삭제 실패: 비밀번호가 맞지 않습니다.' })
    }

    // confirm만 떴고 alert가 없을 수 있으므로, confirm 메시지는 정보성으로 로그
    if (confirmMessage) {
      this.logger.warn(`삭제 confirm 메시지: ${confirmMessage}`)
    }

    // 최종 성공 alert를 받지 못한 경우 실패로 간주
    throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, {
      message: '게시물 삭제 확인 메시지를 받지 못했습니다. 삭제가 결과를 모릅니다.',
    })
  }

  private async waitForCustomPopup(page: Page): Promise<{ isCustomPopup: true; message: string } | null> {
    // UI 기반 팝업 대기 (커스텀 팝업 - 창 형태)
    try {
      // 커스텀 팝업이 나타날 때까지 대기 (최대 8초)
      await page.waitForSelector('.pop_wrap[style*="display: block"]', { timeout: 60_000 })

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
    const passwordExists = await page.waitForSelector('#password', { timeout: 60_000 })
    if (passwordExists) {
      await page.fill('#password', password.trim().toString())
    }
  }

  private async inputTitle(page: Page, title: string): Promise<void> {
    await page.waitForSelector('#subject', { timeout: 60_000 })
    await page.fill('#subject', title)
  }

  private async selectHeadtext(page: Page, headtext: string): Promise<void> {
    try {
      await page.waitForSelector('.write_subject .subject_list li', { timeout: 60_000 })
      await sleep(500)
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
      await sleep(500)

      if (!found) {
        this.logger.warn(`말머리 "${headtext}"를 찾을 수 없습니다.`)
        throw new CustomHttpException(ErrorCode.POST_PARAM_INVALID, {
          message: `말머리 "${headtext}"를 찾을 수 없습니다.`,
        })
      }

      this.logger.log(`말머리 "${headtext}" 선택 완료`)
      await sleep(1000)
    } catch (error: any) {
      if (error.name === 'TimeoutError' || (error.message && error.message.includes('Timeout'))) {
        const msg = `말머리 목록을 60초 내에 불러오지 못했습니다. (타임아웃)`
        this.logger.warn(msg)
        throw new CustomHttpException(ErrorCode.POST_PARAM_INVALID, { message: msg })
      }
      if (error.message && error.message.includes('말머리')) {
        throw error // 말머리 오류는 그대로 전파
      }
      this.logger.warn(`말머리 선택 중 오류 (무시하고 계속): ${error.message}`)
    }
  }

  private async inputContent(page: Page, contentHtml: string): Promise<void> {
    // HTML 모드 체크박스 활성화
    await page.waitForSelector('#chk_html', { timeout: 60_000 })

    const htmlChecked = await page.locator('#chk_html').isChecked()
    if (!htmlChecked) {
      await page.click('#chk_html')
    }

    // HTML 코드 입력
    await page.waitForSelector('.note-editor .note-codable', { timeout: 60_000 })
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
    const appSettings = await this.settingsService.getSettings()

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
          throw new CustomHttpException(ErrorCode.IMAGE_UPLOAD_FAILED, { message: errorMessage })
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

    const maxWaitTime = 60_000 // 최대 60초 대기
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
        await popup.waitForSelector('.btn_apply', { timeout: 60_000 })
        await popup.click('.btn_apply')
        // 클릭 후 팝업 닫힘 확인 (1초 대기)
        await sleep(1000)
        if (popup.isClosed()) {
          this.logger.log('팝업이 닫혔습니다. 이미지 업로드 완료.')
          return true
        }
        throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, { message: '팝업이 아직 닫히지 않았습니다.' })
      },
      1000,
      10,
      'linear',
    )
  }

  private async inputNickname(page: Page, nickname: string): Promise<void> {
    // 기본닉네임 해제(X 버튼) - 존재할 때만 클릭 (없으면 무시)
    try {
      const xBtnLocator = page.locator('#btn_gall_nick_name_x:visible')
      const hasXButton = (await xBtnLocator.count()) > 0
      this.logger.log(`갤닉 X 버튼 존재 여부: ${hasXButton}`)
      if (hasXButton) {
        await xBtnLocator.click()
        await sleep(500)
      }
    } catch (_) {
      // X 버튼이 없거나 클릭 실패 시 무시하고 계속 진행
    }

    // 실제 입력 대상만 가시화 대기
    await page.waitForSelector('#name', { state: 'visible', timeout: 60_000 })
    await page.evaluate(_nickname => {
      const nicknameInput = document.querySelector('#name') as HTMLInputElement | HTMLTextAreaElement | null
      if (nicknameInput) {
        nicknameInput.value = _nickname
        nicknameInput.dispatchEvent(new Event('input', { bubbles: true }))
        nicknameInput.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }, nickname)

    this.logger.log(`닉네임 입력 완료: ${nickname}`)
  }

  private async submitPostAndHandleErrors(page: Page): Promise<void> {
    const captchaErrorMessages = ['자동입력 방지코드가 일치하지 않습니다.', 'code은(는) 영문-숫자 조합이어야 합니다.']
    let captchaTryCount = 0

    while (true) {
      // 리캡챠 감지: 등록 시도 전 검사 (모든 프레임)
      if (await detectRecaptcha(page)) {
        throw new CustomHttpException(ErrorCode.RECAPTCHA_NOT_SUPPORTED, {
          message: '리캡챠는 현재 지원하지 않습니다.',
        })
      }
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

        const timeoutPromise: Promise<null> = new Promise(resolve => {
          timeoutId = setTimeout(() => {
            resolve(null)
          }, 60_000)
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
            .waitForURL(/\/lists/, { timeout: 60_000 })
            .then(() => null)
            .catch(() => null),
        ])

        // 커스텀 팝업 결과 처리
        if (result && typeof result === 'object' && 'isCustomPopup' in result) {
          throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, { message: `글 등록 실패: ${result.message}` })
        }

        const dialogMessage = result

        // 알림창이 떴을 경우 처리
        if (dialogMessage) {
          // 캡챠 오류 메시지일 경우에만 재시도
          if (captchaErrorMessages.some(m => dialogMessage.includes(m))) {
            captchaTryCount += 1
            if (captchaTryCount >= 3) throw new CustomHttpException(ErrorCode.CAPTCHA_FAILED)

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
            throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, { message: `글 등록 실패: ${dialogMessage}` })
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
    // 목록 테이블에서 제목이 일치하는 첫 번째 글의 a href 추출
    await page.waitForSelector('table.gall_list', { timeout: 60_000 })
    let postUrl = await page.evaluate(title => {
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

    if (postUrl) {
      if (postUrl.startsWith('/')) {
        return `https://gall.dcinside.com${postUrl}`
      } else {
        return postUrl
      }
    } else {
      // 제목 추출 실패 시 에러 처리
      throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, {
        message:
          '등록은 되었으나 알수 없는 이유로 게시글을 찾을수 없습니다. 링크 등 제목,내용이 부적절 할 경우가 의심됩니다.',
      })
    }
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
          { timeout: 60_000 },
        ),

        // 2. 게시글 목록 테이블이 나타날 때까지 대기
        page.waitForSelector('table.gall_list', { timeout: 60_000 }),

        // 3. 네비게이션 이벤트 대기
        page.waitForURL(/\/lists/, { timeout: 60_000 }),
      ])

      this.logger.log('게시글 목록 페이지로 이동 완료')
    } catch (error: any) {
      if (error.name === 'TimeoutError' || (error.message && error.message.includes('Timeout'))) {
        const msg = '게시글 목록 페이지로 60초 내에 이동하지 못했습니다. (타임아웃)'
        this.logger.warn(msg)
        throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, { message: msg })
      }
      this.logger.warn(`목록 페이지 이동 대기 중 타임아웃: ${error.message}`)
      throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, {
        message: '글 등록 후 목록 페이지 이동 실패 - 글 등록이 정상적으로 완료되지 않았습니다.',
      })
    }
  }

  private async navigateToWritePage(page: Page, galleryInfo: GalleryInfo): Promise<void> {
    const success = await retry(
      async () => {
        const listUrl = this.buildGalleryUrl(galleryInfo)
        this.logger.log(`글쓰기 페이지 이동 시도: ${listUrl} (${galleryInfo.type} 갤러리)`)
        try {
          await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        } catch (error: any) {
          if (error.name === 'TimeoutError' || (error.message && error.message.includes('Timeout'))) {
            const msg = '갤러리 목록 페이지를 60초 내에 불러오지 못했습니다. (타임아웃)'
            this.logger.warn(msg)
            throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, { message: msg })
          }
          throw error
        }
        // 글쓰기 버튼 클릭 (goWrite)
        try {
          await page.waitForSelector('a.btn_write.txt', { timeout: 60_000 })
        } catch (error: any) {
          if (error.name === 'TimeoutError' || (error.message && error.message.includes('Timeout'))) {
            const msg = '글쓰기 버튼을 60초 내에 찾지 못했습니다. (타임아웃)'
            this.logger.warn(msg)
            throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, { message: msg })
          }
          throw error
        }
        await page.click('a.btn_write.txt')
        await sleep(4000)
        // 글쓰기 페이지로 정상 이동했는지 확인
        const currentUrl = page.url()
        if (currentUrl.includes('/write')) {
          this.logger.log('글쓰기 페이지 이동 성공')
          return true
        } else {
          this.logger.warn('글쓰기 페이지로 이동하지 못했습니다.')
          return false
        }
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
    isMember?: boolean,
  ): Promise<{ success: boolean; message: string; url?: string }> {
    // 0. PostJob 데이터 파싱
    const parsedPostJob = this.parsePostJobData(postJob)
    await this.jobLogsService.createJobLog(jobId, 'PostJob 데이터 파싱 완료')

    // 0-1. 앱 설정 가져오기 (이미지 업로드 실패 처리 방식)
    const appSettings = await this.settingsService.getSettings()
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

    if (!isMember && parsedPostJob.nickname) {
      await this.inputNickname(page, parsedPostJob.nickname)
      await this.jobLogsService.createJobLog(jobId, `닉네임 입력 완료: "${parsedPostJob.nickname}"`)
      await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환
    }

    if (!isMember && parsedPostJob.password) {
      await this.inputPassword(page, parsedPostJob.password)
      await this.jobLogsService.createJobLog(jobId, '비밀번호 입력 완료')
      await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환
    }

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
  }
}
