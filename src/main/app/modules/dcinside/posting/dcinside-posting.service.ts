import type { DcinsidePostDto } from '@main/app/modules/dcinside/posting/dto/dcinside-post.dto'
import { DcinsidePostSchema } from '@main/app/modules/dcinside/posting/dto/dcinside-post.schema'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { Injectable } from '@nestjs/common'
import { BrowserContext, Page } from 'playwright'
import { ZodError } from 'zod/v4'
import { PostJob } from '@prisma/client'
import { DcinsideAutomationError } from '@main/common/errors/dcinside-automation.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import {
  DcinsideBaseService,
  detectRecaptcha,
  assertValidGalleryUrl,
  assertValidPopupPage,
  assertRetrySuccess,
} from '@main/app/modules/dcinside/base/dcinside-base.service'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { CookieService } from '@main/app/modules/util/cookie.service'
import { TwoCaptchaService } from '@main/app/modules/util/two-captcha.service'
import { DcCaptchaSolverService } from '@main/app/modules/dcinside/util/dc-captcha-solver.service'
import { BrowserManagerService } from '@main/app/modules/util/browser-manager.service'
import { TetheringService } from '@main/app/modules/util/tethering.service'
import { sleep } from '@main/app/utils/sleep'
import { retry } from '@main/app/utils/retry'
import { IpMode, Settings } from '@main/app/modules/settings/settings.types'

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
export class DcinsidePostingService extends DcinsideBaseService {
  // 브라우저 ID 상수
  private static readonly BROWSER_IDS = {
    DCINSIDE_REUSE: 'dcinside',
    POST_JOB_NEW: (jobId: string) => `post-job-new-${jobId}`,
    DELETE_JOB_NEW: (jobId: string) => `delete-job-new-${jobId}`,
    PROXY: 'dcinside-posting-proxy',
    FALLBACK: 'dcinside-posting-fallback',
  } as const

  constructor(
    settingsService: SettingsService,
    cookieService: CookieService,
    twoCaptchaService: TwoCaptchaService,
    dcCaptchaSolverService: DcCaptchaSolverService,
    browserManagerService: BrowserManagerService,
    tetheringService: TetheringService,
    jobLogsService: JobLogsService,
  ) {
    super(
      settingsService,
      cookieService,
      twoCaptchaService,
      dcCaptchaSolverService,
      browserManagerService,
      tetheringService,
      jobLogsService,
    )
  }

  // Public methods

  // 통합된 삭제 로직 (브라우저 관리 및 로그인 처리 포함)
  public async deleteArticleByResultUrl(post: PostJob, jobId: string, browserManager: any): Promise<void> {
    await this.jobLogsService.createJobLog(jobId, '통합된 삭제 로직 시작')

    const maxRetries = 5
    const retryInterval = 10 * 1_000

    await this.jobLogsService.createJobLog(
      jobId,
      `삭제 재시도 설정: 최대 ${maxRetries}회, 간격 ${retryInterval / 1000}초`,
    )

    let attemptCount = 0
    await retry(
      async () => {
        attemptCount++
        await this.jobLogsService.createJobLog(jobId, `삭제 시도 ${attemptCount}/${maxRetries}`)

        // 통합된 삭제 처리 (브라우저 모드 + IP 모드 + 로그인 포함)
        await this.deleteArticle(jobId, post)

        await this.jobLogsService.createJobLog(jobId, `삭제 시도 ${attemptCount} 성공`)
      },
      retryInterval,
      maxRetries,
      'linear',
    )
  }

  /**
   * 통합된 포스팅 처리 (순차적 함수 호출로 가독성 향상)
   */
  public async postArticle(jobId: string, postJob: any): Promise<{ url: string }> {
    const settings = await this.settingsService.getSettings()

    // 1. 페이지 켜기 (브라우저 생성)
    const { context, page, browserId } = await this._launchBrowser(jobId, settings, 'post')

    try {
      // 2. IP 변경 처리
      await this._handleIpChange(jobId, settings)

      // 3. 로그인 처리
      const isMember = await this._handleLogin(jobId, context, page, postJob)

      // 4. 작업 간 딜레이
      await this.applyTaskDelay(jobId, settings)

      // 5. 글쓰기 실행
      // 0. PostJob 데이터 파싱
      const parsedPostJob = this._parsePostJobData(postJob)
      await this.jobLogsService.createJobLog(jobId, 'PostJob 데이터 파싱 완료')

      // 0-1. 앱 설정 가져오기 (이미지 업로드 실패 처리 방식)
      const appSettings = await this.settingsService.getSettings()
      await this.jobLogsService.createJobLog(jobId, '앱 설정 가져오기 완료')

      // 1. 갤러리 정보 추출 (id와 타입)
      const galleryInfo = this._extractGalleryInfo(parsedPostJob.galleryUrl)
      await this.jobLogsService.createJobLog(
        jobId,
        `갤러리 정보 추출 완료: ${galleryInfo.type} 갤러리 (${galleryInfo.id})`,
      )

      await this.jobLogsService.createJobLog(jobId, '페이지 생성 완료')

      // 2. 글쓰기 페이지 이동 (리스트 → 글쓰기 버튼 클릭)
      await this._navigateToWritePage(page, galleryInfo)
      await this.jobLogsService.createJobLog(jobId, '글쓰기 페이지 이동 완료')
      await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환

      // 3. 입력폼 채우기
      await this._inputTitle(page, parsedPostJob.title)
      await this.jobLogsService.createJobLog(jobId, `제목 입력 완료: "${parsedPostJob.title}"`)
      await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환

      if (parsedPostJob.headtext) {
        await this._selectHeadtext(page, parsedPostJob.headtext)
        await this.jobLogsService.createJobLog(jobId, `말머리 선택 완료: "${parsedPostJob.headtext}"`)
        await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환
      }

      await this._inputContent(page, parsedPostJob.contentHtml)
      await this.jobLogsService.createJobLog(jobId, '글 내용 입력 완료')
      await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환

      // 이미지 등록 (imagePaths, 팝업 윈도우 방식)
      if (parsedPostJob.imagePaths && parsedPostJob.imagePaths.length > 0) {
        await this.jobLogsService.createJobLog(jobId, `이미지 업로드 시작: ${parsedPostJob.imagePaths.length}개 이미지`)
        await this._uploadImages(page, context, parsedPostJob.imagePaths, parsedPostJob.imagePosition)
        await this.jobLogsService.createJobLog(jobId, '이미지 업로드 완료')
      }
      await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환

      if (!isMember && parsedPostJob.nickname) {
        await this._inputNickname(page, parsedPostJob.nickname)
        await this.jobLogsService.createJobLog(jobId, `닉네임 입력 완료: "${parsedPostJob.nickname}"`)
        await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환
      }

      if (!isMember && parsedPostJob.password) {
        await this._inputPassword(page, parsedPostJob.password)
        await this.jobLogsService.createJobLog(jobId, '비밀번호 입력 완료')
        await sleep(appSettings.actionDelay * 1000) // 초를 밀리초로 변환
      }

      // 캡챠(자동등록방지) 처리 및 등록 버튼 클릭을 최대 3회 재시도
      await this.jobLogsService.createJobLog(jobId, '캡챠 처리 및 글 등록 시작')
      await this._submitPostAndHandleErrors(page, jobId)
      await this.jobLogsService.createJobLog(jobId, '글 등록 완료')

      // 글 등록 완료 후 목록 페이지로 이동 대기
      await this._waitForListPageNavigation(page, galleryInfo)
      await this.jobLogsService.createJobLog(jobId, '목록 페이지 이동 완료')

      // 글 등록이 성공하여 목록으로 이동했을 시점
      // 글 목록으로 이동 후, 최신글 URL 추출 시도
      const finalUrl = await this._extractPostUrl(page, parsedPostJob.title)
      await this.jobLogsService.createJobLog(jobId, `최종 URL 추출 완료: ${finalUrl}`)

      return { url: finalUrl }
    } finally {
      // 브라우저 종료 (신규 생성 모드일 때만)
      if (!settings.reuseWindowBetweenTasks) {
        await this._closeBrowser(jobId, browserId)
      }
    }
  }

  /**
   * 통합된 삭제 처리 (순차적 함수 호출로 가독성 향상)
   */
  public async deleteArticle(jobId: string, postJob: any): Promise<void> {
    const settings = await this.settingsService.getSettings()

    // 1. 페이지 켜기 (브라우저 생성)
    const { context, page, browserId } = await this._launchBrowser(jobId, settings, 'delete')

    try {
      // 2. IP 변경 처리
      await this._handleIpChange(jobId, settings)

      // 3. 로그인 처리
      const isMember = await this._handleLogin(jobId, context, page, postJob)

      // 4. 작업 간 딜레이
      await this.applyTaskDelay(jobId, settings)

      // 5. 삭제 실행
      // 1. 글쓰기 페이지 이동
      await this._navigateToPostPage(page, postJob, jobId)

      // 2. 비정상 페이지 체크
      const isAbnormalPage = await this.checkAbnormalPage(page)
      if (isAbnormalPage) {
        await this.jobLogsService.createJobLog(jobId, '이미 삭제된 게시물로 판단되어 성공 처리')
        return // 이미 삭제된 경우 성공으로 처리
      }

      // 3. 삭제 버튼 찾기
      await this._findAndClickDeleteButton(page, jobId)

      // 4. 인증 처리 (회원/비회원) 및 비밀번호 체크
      await this._handleAuthentication(page, postJob, jobId, isMember)

      // 5. 삭제 버튼 클릭 및 삭제 처리
      const alertMessage = await this._executeDeleteButtonClick(page, jobId)

      // 6. 성공 여부 체크
      await this._verifyDeleteSuccess(alertMessage, jobId)
    } finally {
      // 브라우저 종료 (신규 생성 모드일 때만)
      if (!settings.reuseWindowBetweenTasks) {
        await this._closeBrowser(jobId, browserId)
      }
    }
  }

  /**
   * 1. 페이지 켜기 (브라우저 생성)
   */
  private async _launchBrowser(
    jobId: string,
    settings: Settings,
    operationType: 'post' | 'delete',
  ): Promise<{ context: BrowserContext; page: Page; browserId: string }> {
    // 브라우저 ID 생성 (재사용 모드에 따라 결정)
    const browserId = settings.reuseWindowBetweenTasks
      ? DcinsidePostingService.BROWSER_IDS.DCINSIDE_REUSE
      : operationType === 'post'
        ? DcinsidePostingService.BROWSER_IDS.POST_JOB_NEW(jobId)
        : DcinsidePostingService.BROWSER_IDS.DELETE_JOB_NEW(jobId)

    // IP 모드에 따른 브라우저 실행
    switch (settings?.ipMode) {
      case IpMode.PROXY:
        const { context, page } = await this.handleProxyMode(jobId, settings, browserId)
        return { context, page, browserId }

      case IpMode.TETHERING:
      case IpMode.NONE:
      default:
        if (settings.reuseWindowBetweenTasks) {
          const { context, page } = await this.handleBrowserReuseMode(jobId, settings, browserId)
          return { context, page, browserId }
        } else {
          const { context, page } = await this.handleBrowserNewMode(jobId, settings, browserId)
          return { context, page, browserId }
        }
    }
  }

  /**
   * 2. IP 변경 처리
   */
  private async _handleIpChange(jobId: string, settings: Settings): Promise<void> {
    if (settings?.ipMode === IpMode.TETHERING) {
      await this.handleTetheringMode(jobId, settings)
    }
    // 프록시 모드는 브라우저 생성 시 이미 처리됨
  }

  /**
   * 3. 로그인 처리
   */
  private async _handleLogin(jobId: string, context: BrowserContext, page: Page, postJob: any): Promise<boolean> {
    let isMember = false
    if (postJob.loginId && postJob.loginPassword) {
      await this.jobLogsService.createJobLog(jobId, `로그인 시도: ${postJob.loginId}`)
      await this.handleBrowserLogin(context, page, postJob.loginId, postJob.loginPassword)
      await this.jobLogsService.createJobLog(jobId, '로그인 성공')
      isMember = true
    } else {
      this.logger.log(`비로그인 모드로 진행`)
      await this.jobLogsService.createJobLog(jobId, '비로그인 모드로 진행')
    }
    return isMember
  }

  /**
   * 브라우저 종료
   */
  private async _closeBrowser(jobId: string, browserId: string): Promise<void> {
    try {
      await this.browserManagerService.closeManagedBrowser(browserId)
      await this.jobLogsService.createJobLog(jobId, '브라우저 창 종료 완료')
    } catch (error) {
      this.logger.warn(`브라우저 종료 중 오류: ${error.message}`)
    }
  }

  // 1. 글쓰기 페이지 이동
  private async _navigateToPostPage(page: Page, post: PostJob, jobId: string): Promise<void> {
    await this.jobLogsService.createJobLog(jobId, `글 페이지 이동: ${post.resultUrl}`)

    await page.goto(post.resultUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    await sleep(2000)

    await this.jobLogsService.createJobLog(jobId, '글 페이지 이동 완료')
  }

  // 3. 삭제 버튼 찾기
  private async _findAndClickDeleteButton(page: Page, jobId: string): Promise<void> {
    await this.jobLogsService.createJobLog(jobId, '삭제 버튼 찾는 중...')

    try {
      await page.waitForSelector('button.btn_grey.cancle', { timeout: 60_000 })
      await this.jobLogsService.createJobLog(jobId, '삭제 버튼 발견, 클릭 시도')

      await page.click('button.btn_grey.cancle')
      await sleep(2000)

      await this.jobLogsService.createJobLog(jobId, '삭제 버튼 클릭 완료, 삭제 페이지로 이동 대기')
    } catch (error) {
      const errorMessage = `삭제 버튼을 찾을 수 없습니다: ${error.message}`
      this.logger.warn(errorMessage)
      await this.jobLogsService.createJobLog(jobId, errorMessage)
      throw new DcinsideAutomationError(ErrorCode.POST_SUBMIT_FAILED, { message: errorMessage })
    }
  }

  // 4. 인증 처리 (회원/비회원) 및 비밀번호 체크
  private async _handleAuthentication(page: Page, post: PostJob, jobId: string, isMember?: boolean): Promise<void> {
    // 비회원인 경우 비밀번호 입력
    if (!isMember) {
      if (!post.password) {
        throw new DcinsideAutomationError(ErrorCode.POST_PARAM_INVALID, {
          message: '삭제 비밀번호가 설정되지 않았습니다.',
        })
      }

      await page.waitForSelector('#password', { timeout: 60_000 })
      await page.fill('#password', post.password)
      await sleep(1000)

      await this.jobLogsService.createJobLog(jobId, '삭제 비밀번호 입력 완료')
    }
  }

  // 5. 삭제 버튼 클릭 및 삭제 처리
  private async _executeDeleteButtonClick(page: Page, jobId: string): Promise<string> {
    // 다이얼로그 처리
    let alertMessage = ''

    const dialogHandler = async (dialog: any) => {
      try {
        const type = dialog.type?.() || 'unknown'
        const msg = dialog.message?.() || ''

        if (type === 'alert') {
          alertMessage = msg
        }

        await sleep(1000)
        await dialog.accept()
      } catch (_) {}
    }

    page.on('dialog', dialogHandler)

    try {
      // 삭제 버튼 클릭
      await page.locator('.btn_ok').click({ timeout: 5000 })

      // 다이얼로그 처리 대기: alertMessage가 채워지면 즉시 진행, 최대 30초 대기
      const start = Date.now()
      while (!alertMessage && Date.now() - start < 30_000) {
        await sleep(200)
      }

      await this.jobLogsService.createJobLog(jobId, `삭제 처리 완료, 알림 메시지: ${alertMessage}`)
      return alertMessage
    } finally {
      page.off('dialog', dialogHandler)
    }
  }

  // 6. 성공 여부 체크
  private async _verifyDeleteSuccess(alertMessage: string, jobId: string): Promise<void> {
    // alertMessage에서 성공 여부 확인
    if (alertMessage.includes('게시물이 삭제 되었습니다')) {
      await this.jobLogsService.createJobLog(jobId, '삭제 성공: 게시물이 삭제되었습니다.')
      return
    }

    // 비밀번호 오류
    if (alertMessage.includes('비밀번호가 맞지 않습니다')) {
      throw new DcinsideAutomationError(ErrorCode.POST_PARAM_INVALID, {
        message: '삭제 실패: 비밀번호가 맞지 않습니다.',
      })
    }

    // 기타 오류
    if (alertMessage) {
      throw new DcinsideAutomationError(ErrorCode.POST_SUBMIT_FAILED, {
        message: `삭제 실패: ${alertMessage}`,
      })
    }

    // 알림 메시지가 없는 경우도 성공으로 처리
    await this.jobLogsService.createJobLog(jobId, '삭제 성공: 알림 메시지 없이 완료됨')
  }

  private async _inputPassword(page: Page, password: string): Promise<void> {
    const passwordExists = await page.waitForSelector('#password', { timeout: 60_000 })
    if (passwordExists) {
      await page.fill('#password', password.trim().toString())
    }
  }

  private async _inputTitle(page: Page, title: string): Promise<void> {
    await page.waitForSelector('#subject', { timeout: 60_000 })
    await page.fill('#subject', title)
  }

  private async _selectHeadtext(page: Page, headtext: string): Promise<void> {
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
        throw new DcinsideAutomationError(ErrorCode.POST_PARAM_INVALID, {
          message: `말머리 "${headtext}"를 찾을 수 없습니다.`,
        })
      }

      this.logger.log(`말머리 "${headtext}" 선택 완료`)
      await sleep(1000)
    } catch (error: any) {
      if (error.name === 'TimeoutError' || (error.message && error.message.includes('Timeout'))) {
        const msg = `말머리 목록을 60초 내에 불러오지 못했습니다. (타임아웃)`
        this.logger.warn(msg)
        throw new DcinsideAutomationError(ErrorCode.POST_PARAM_INVALID, { message: msg })
      }
      if (error.message && error.message.includes('말머리')) {
        throw error // 말머리 오류는 그대로 전파
      }
      this.logger.warn(`말머리 선택 중 오류 (무시하고 계속): ${error.message}`)
    }
  }

  private async _inputContent(page: Page, contentHtml: string): Promise<void> {
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

  private async _uploadImages(
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
      await this._performImageUpload(page, browserContext, imagePaths)
      this.logger.log('이미지 업로드 성공')
    } catch (imageUploadError) {
      const errorMessage = `이미지 업로드 실패: ${imageUploadError.message}`
      this.logger.warn(errorMessage)

      // 설정에 따른 처리
      const imageFailureAction = appSettings.imageUploadFailureAction || 'fail'

      switch (imageFailureAction) {
        case 'fail':
          // 작업 실패 - 전체 포스팅 중단
          throw new DcinsideAutomationError(ErrorCode.IMAGE_UPLOAD_FAILED, { message: errorMessage })
        case 'skip':
          this.logger.log('이미지 업로드 실패하였으나 설정에 따라 이미지 없이 포스팅을 진행합니다.')
          break
      }
    }
  }

  private async _performImageUpload(page: Page, browserContext: BrowserContext, imagePaths: string[]): Promise<void> {
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
      await this._waitForImageUploadComplete(popupPage, imagePaths.length)

      // '적용' 버튼 클릭
      await this._clickApplyButtonSafely(popupPage)

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

  private async _waitForImageUploadComplete(popup: Page, expectedImageCount: number): Promise<void> {
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

  private async _clickApplyButtonSafely(popup: Page): Promise<void> {
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
        throw new DcinsideAutomationError(ErrorCode.POST_SUBMIT_FAILED, { message: '팝업이 아직 닫히지 않았습니다.' })
      },
      1000,
      10,
      'linear',
    )
  }

  private async _inputNickname(page: Page, nickname: string): Promise<void> {
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

  private async _submitPostAndHandleErrors(page: Page, jobId?: string): Promise<void> {
    const captchaErrorMessages = ['자동입력 방지코드가 일치하지 않습니다.', 'code은(는) 영문-숫자 조합이어야 합니다.']
    let captchaTryCount = 0

    while (true) {
      // 1. 리캡챠 감지 및 처리: 등록 시도 전 검사 (모든 프레임)
      const recaptchaResult = await detectRecaptcha(page)
      if (recaptchaResult.found) {
        if (!recaptchaResult.siteKey) {
          throw new DcinsideAutomationError(ErrorCode.RECAPTCHA_NOT_SUPPORTED, {
            message: 'reCAPTCHA 사이트 키를 찾을 수 없습니다.',
          })
        }

        const settings = await this.settingsService.getSettings()
        if (!settings.twoCaptchaApiKey) {
          throw new DcinsideAutomationError(ErrorCode.RECAPTCHA_NOT_SUPPORTED, {
            message: 'reCAPTCHA가 감지되었지만 2captcha API 키가 설정되지 않았습니다.',
          })
        }

        // 2captcha를 이용한 reCAPTCHA 해결
        await this.solveRecaptchaWith2Captcha(page, recaptchaResult.siteKey, jobId)
      }

      // 2. DC 일반 캡챠 감지 및 처리 (리캡챠와 독립적으로 확인)
      // 리캡챠와 일반 캡챠가 동시에 존재할 수 있으므로 둘 다 처리
      const captchaImg = page.locator('#kcaptcha')
      const captchaCount = await captchaImg.count()

      if (captchaCount > 0) {
        this.logger.log('글쓰기용 문자 캡차 감지됨, 해결 시작')

        try {
          // 캡차 이미지 추출 (글쓰기용 selector)
          const captchaImageBase64 = await this.dcCaptchaSolverService.extractCaptchaImageBase64(page, '#kcaptcha')

          // 캡차 해결
          const answer = await this.dcCaptchaSolverService.solveDcCaptcha(captchaImageBase64)

          // 캡차 입력 필드에 답안 입력
          const captchaInput = page.locator('input[name=kcaptcha_code]')
          if ((await captchaInput.count()) > 0) {
            await captchaInput.fill(answer)
            this.logger.log(`글쓰기용 캡차 답안 입력 완료: ${answer}`)
          }
        } catch (error) {
          throw new DcinsideAutomationError(ErrorCode.CAPTCHA_FAILED, { message: error.message })
        }
      } else {
        this.logger.log('글쓰기용 캡차가 존재하지 않음')
      }

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
          throw new DcinsideAutomationError(ErrorCode.POST_SUBMIT_FAILED, {
            message: `글 등록 실패: ${result.message}`,
          })
        }

        const dialogMessage = result

        // 알림창이 떴을 경우 처리
        if (dialogMessage) {
          // 캡챠 오류 메시지일 경우에만 재시도
          if (captchaErrorMessages.some(m => dialogMessage.includes(m))) {
            captchaTryCount += 1
            if (captchaTryCount >= 3) throw new DcinsideAutomationError(ErrorCode.CAPTCHA_FAILED)

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
            throw new DcinsideAutomationError(ErrorCode.POST_SUBMIT_FAILED, {
              message: `글 등록 실패: ${dialogMessage}`,
            })
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

  private async _extractPostUrl(page: Page, title: string): Promise<string> {
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
      throw new DcinsideAutomationError(ErrorCode.POST_SUBMIT_FAILED, {
        message:
          '등록은 되었으나 알수 없는 이유로 게시글을 찾을수 없습니다. 링크 등 제목,내용이 부적절 할 경우가 의심됩니다.',
      })
    }
  }

  private async _waitForListPageNavigation(page: Page, galleryInfo: GalleryInfo): Promise<void> {
    this.logger.log('게시글 목록으로 이동 대기 중...')

    try {
      // URL 변경 또는 특정 요소 나타날 때까지 대기
      await Promise.race([
        // 1. URL이 목록 페이지로 변경되길 대기
        page.waitForFunction(
          expectedUrl => {
            return window.location.href.includes('/lists') || window.location.href.includes(expectedUrl)
          },
          this._buildGalleryUrl(galleryInfo),
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
        throw new DcinsideAutomationError(ErrorCode.POST_SUBMIT_FAILED, { message: msg })
      }
      this.logger.warn(`목록 페이지 이동 대기 중 타임아웃: ${error.message}`)
      throw new DcinsideAutomationError(ErrorCode.POST_SUBMIT_FAILED, {
        message: '글 등록 후 목록 페이지 이동 실패 - 글 등록이 정상적으로 완료되지 않았습니다.',
      })
    }
  }

  private async _navigateToWritePage(page: Page, galleryInfo: GalleryInfo): Promise<void> {
    const success = await retry(
      async () => {
        const listUrl = this._buildGalleryUrl(galleryInfo)
        this.logger.log(`글쓰기 페이지 이동 시도: ${listUrl} (${galleryInfo.type} 갤러리)`)
        try {
          await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        } catch (error: any) {
          if (error.name === 'TimeoutError' || (error.message && error.message.includes('Timeout'))) {
            const msg = '갤러리 목록 페이지를 60초 내에 불러오지 못했습니다. (타임아웃)'
            this.logger.warn(msg)
            throw new DcinsideAutomationError(ErrorCode.POST_SUBMIT_FAILED, { message: msg })
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
            throw new DcinsideAutomationError(ErrorCode.POST_SUBMIT_FAILED, { message: msg })
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

  // Private methods
  private _validateParams(rawParams: any): DcinsidePostDto {
    try {
      return DcinsidePostSchema.parse(rawParams)
    } catch (error) {
      if (error instanceof ZodError) {
        const zodErrors = error.issues.map(err => `${err.path.join('.')}: ${err.message}`)
        throw new DcinsideAutomationError(ErrorCode.POST_PARAM_INVALID, {
          message: `포스팅 파라미터 검증 실패: ${zodErrors.join(', ')}`,
        })
      }
      throw new DcinsideAutomationError(ErrorCode.POST_PARAM_INVALID, {
        message: `포스팅 파라미터 검증 실패: ${error.message}`,
      })
    }
  }

  private _parsePostJobData(postJob: PostJob): ParsedPostJob {
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

  private _extractGalleryInfo(galleryUrl: string): GalleryInfo {
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

  private _buildGalleryUrl(galleryInfo: GalleryInfo): string {
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
        throw new DcinsideAutomationError(ErrorCode.GALLERY_TYPE_UNSUPPORTED, { type })
    }
  }
}
