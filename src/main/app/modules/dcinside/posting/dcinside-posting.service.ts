import type { DcinsidePostDto } from '@main/app/modules/dcinside/posting/dto/dcinside-post.dto'
import { DcinsidePostSchema } from '@main/app/modules/dcinside/posting/dto/dcinside-post.schema'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { Injectable } from '@nestjs/common'
import { BrowserContext, Page } from 'playwright'
import { ZodError } from 'zod/v4'
import { PostJob } from '@prisma/client'
import { DcException } from '@main/common/errors/dc.exception'
import {
  DcinsideBaseService,
  detectRecaptcha,
  assertRetrySuccess,
  GalleryInfo,
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
import axios from 'axios'
import * as cheerio from 'cheerio'
import UserAgent from 'user-agents'

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
      try {
        await this.checkAbnormalPage(page)
      } catch (error) {
        // 이미 삭제된 경우 성공으로 처리
        await this.jobLogsService.createJobLog(jobId, '이미 삭제된 게시물로 판단되어 성공 처리')
        return
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
      await page.waitForSelector('[onclick^=board_delete]', { timeout: 60_000 })
      await this.jobLogsService.createJobLog(jobId, '삭제 버튼 발견, 클릭 시도')

      await page.click('[onclick^=board_delete]')
      await sleep(2000)

      await this.jobLogsService.createJobLog(jobId, '삭제 버튼 클릭 완료, 삭제 페이지로 이동 대기')
    } catch (error) {
      const errorMessage = `삭제 버튼을 찾을 수 없습니다: ${error.message}`
      this.logger.warn(errorMessage)
      await this.jobLogsService.createJobLog(jobId, errorMessage)
      throw DcException.postSubmitFailed({ message: errorMessage })
    }
  }

  // 4. 인증 처리 (회원/비회원) 및 비밀번호 체크
  private async _handleAuthentication(page: Page, post: PostJob, jobId: string, isMember?: boolean): Promise<void> {
    // 비회원인 경우 비밀번호 입력
    if (!isMember) {
      if (!post.password) {
        throw DcException.postParamInvalid({
          message: '삭제 비밀번호가 설정되지 않았습니다.',
        })
      }

      await page.waitForSelector('#board_pw', { timeout: 60_000 })
      await page.fill('#board_pw', post.password)
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
      await page.locator('button.btn-pwd-blue[type=submit]').click({ timeout: 5000 })

      // Promise.race로 alert 메시지와 페이지 이동을 동시에 감지
      const result = await Promise.race([
        // 1. Alert 다이얼로그 대기
        new Promise<string>(resolve => {
          const checkAlert = () => {
            if (alertMessage) {
              resolve(alertMessage)
            } else {
              setTimeout(checkAlert, 200)
            }
          }
          setTimeout(checkAlert, 200)
        }),

        // 2. 갤러리 목록 페이지로 이동 대기 (마지막에 포스팅 ID가 없는 URL로 이동)
        new Promise<string>(resolve => {
          let timeoutId: NodeJS.Timeout
          let intervalId: NodeJS.Timeout

          const checkUrl = () => {
            try {
              const currentUrl = page.url()
              // URL이 변경되었고, 마지막에 숫자(포스팅 ID)가 없는 경우 목록 페이지로 이동한 것으로 판단
              // board, mini, mgallery, person 등 다양한 갤러리 타입에 대응
              const isGalleryUrl =
                currentUrl.includes('/board/') ||
                currentUrl.includes('/mini/') ||
                currentUrl.includes('/mgallery/') ||
                currentUrl.includes('/person/')

              if (isGalleryUrl && !currentUrl.match(/\/\d+$/)) {
                clearTimeout(timeoutId)
                clearInterval(intervalId)
                resolve('SUCCESS_BY_NAVIGATION')
              }
            } catch (error) {
              // 에러가 발생해도 계속 체크
            }
          }

          // 30초 타임아웃 설정
          timeoutId = setTimeout(() => {
            clearInterval(intervalId)
            resolve('TIMEOUT')
          }, 30_000)

          // 200ms마다 URL 체크
          intervalId = setInterval(checkUrl, 200)
        }),

        // 3. 타임아웃 (30초)
        new Promise<string>(resolve => {
          setTimeout(() => resolve('TIMEOUT'), 30_000)
        }),
      ])

      if (result === 'SUCCESS_BY_NAVIGATION') {
        await this.jobLogsService.createJobLog(jobId, `삭제 성공: 갤러리 목록 페이지로 이동됨`)
        return 'SUCCESS_BY_NAVIGATION'
      } else if (result === 'TIMEOUT') {
        await this.jobLogsService.createJobLog(jobId, '삭제 처리 타임아웃')
        return 'TIMEOUT'
      } else {
        await this.jobLogsService.createJobLog(jobId, `삭제 처리 완료, 알림 메시지: ${result}`)
        return result
      }
    } finally {
      page.off('dialog', dialogHandler)
    }
  }

  // 6. 성공 여부 체크
  private async _verifyDeleteSuccess(alertMessage: string, jobId: string): Promise<void> {
    // 페이지 이동을 통한 성공 확인
    if (alertMessage === 'SUCCESS_BY_NAVIGATION') {
      await this.jobLogsService.createJobLog(jobId, '삭제 성공: 갤러리 목록 페이지로 이동됨')
      return
    }

    // 타임아웃 케이스
    if (alertMessage === 'TIMEOUT') {
      throw DcException.postSubmitFailed({
        message: '삭제 처리 타임아웃: 30초 내에 응답이 없습니다.',
      })
    }

    // 비밀번호 오류
    if (alertMessage.includes('비밀번호가 틀립니다')) {
      throw DcException.postParamInvalid({
        message: '삭제 실패: 비밀번호가 맞지 않습니다.',
      })
    }

    // 기타 오류 (alert가 나타난 경우)
    if (alertMessage) {
      throw DcException.postSubmitFailed({
        message: `삭제 실패: ${alertMessage}`,
      })
    }

    // 알림 메시지가 없는 경우도 성공으로 처리 (alert 없이 페이지 이동으로 성공)
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
        throw DcException.postParamInvalid({
          message: `말머리 "${headtext}"를 찾을 수 없습니다.`,
        })
      }

      this.logger.log(`말머리 "${headtext}" 선택 완료`)
      await sleep(1000)
    } catch (error: any) {
      if (error.name === 'TimeoutError' || (error.message && error.message.includes('Timeout'))) {
        const msg = `말머리 목록을 60초 내에 불러오지 못했습니다. (타임아웃)`
        this.logger.warn(msg)
        throw DcException.postParamInvalid({ message: msg })
      }
      if (error.message && error.message.includes('말머리')) {
        throw error // 말머리 오류는 그대로 전파
      }
      this.logger.warn(`말머리 선택 중 오류 (무시하고 계속): ${error.message}`)
    }
  }

  private async _inputContent(page: Page, contentHtml: string): Promise<void> {
    // 모바일 DC인사이드에서는 HTML 체크박스가 없으므로 note-editable 영역에 직접 HTML 삽입
    await page.waitForSelector('.note-editor .note-editable', { timeout: 60_000 })

    await page.evaluate(html => {
      const editableDiv = document.querySelector('.note-editor .note-editable') as HTMLElement
      if (editableDiv) {
        // 기존 내용 제거
        editableDiv.innerHTML = ''

        // HTML 내용 삽입
        editableDiv.innerHTML = html

        // 이벤트 발생시켜서 에디터가 내용 변경을 인식하도록 함
        editableDiv.dispatchEvent(new Event('input', { bubbles: true }))
        editableDiv.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }, contentHtml)

    this.logger.log('모바일 HTML 내용 입력 완료')
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

    // 앱 설정 가져오기 (이미지 업로드 실패 처리 방식)
    const appSettings = await this.settingsService.getSettings()

    try {
      await this._performImageUpload(page, imagePaths, imagePosition)
      this.logger.log('이미지 업로드 성공')
    } catch (imageUploadError) {
      const errorMessage = `이미지 업로드 실패: ${imageUploadError.message}`
      this.logger.warn(errorMessage)

      // 설정에 따른 처리
      const imageFailureAction = appSettings.imageUploadFailureAction || 'fail'

      switch (imageFailureAction) {
        case 'fail':
          // 작업 실패 - 전체 포스팅 중단
          throw DcException.imageUploadFailed({ message: errorMessage })
        case 'skip':
          this.logger.log('이미지 업로드 실패하였으나 설정에 따라 이미지 없이 포스팅을 진행합니다.')
          break
      }
    }
  }

  private async _performImageUpload(page: Page, imagePaths: string[], imagePosition: '상단' | '하단'): Promise<void> {
    try {
      this.logger.log('이미지 업로드 시작 (페이지 내 처리)')

      // 현재 페이지에서 파일 input 찾기
      const fileInput = page.locator('input[type="file"]#upload')
      await fileInput.waitFor({ state: 'attached', timeout: 10_000 })

      // 파일 업로드
      await fileInput.setInputFiles(imagePaths)
      this.logger.log(`${imagePaths.length}개 이미지 파일 선택 완료`)

      // 업로드 완료 대기
      await this._waitForImageUploadComplete(page, imagePaths.length)

      // 이미지 위치가 '상단'이면 이미지 블럭들을 에디터 상단으로 이동
      if (imagePosition === '상단') {
        await this._moveImagesToTop(page)
      }

      this.logger.log('이미지 업로드 및 적용 완료')
    } catch (error) {
      this.logger.error(`이미지 업로드 중 오류: ${error.message}`)
      throw error
    }
  }

  private async _waitForImageUploadComplete(page: Page, expectedImageCount: number): Promise<void> {
    this.logger.log('이미지 업로드 완료 대기 중...')

    const maxWaitTime = 60_000 // 최대 60초 대기
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // 로딩 박스가 있는지 확인
        const loadingBox = await page.$('.loding_box')
        if (loadingBox) {
          this.logger.log('이미지 업로드 진행 중...')
          await sleep(2000)
          continue
        }

        // 업로드된 이미지 리스트 확인 (에디터 내 이미지 확인)
        const uploadedImages = await page.$$('.note-editable img')
        this.logger.log(`업로드된 이미지 수: ${uploadedImages.length}/${expectedImageCount}`)

        if (uploadedImages.length >= expectedImageCount) {
          this.logger.log('모든 이미지 업로드 완료!')
          break
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

  private async _moveImagesToTop(page: Page): Promise<void> {
    this.logger.log('이미지 블럭을 에디터 상단으로 이동 중...')

    await page.evaluate(() => {
      const editorContainer = document.querySelector('.note-editor .note-editing-area .note-editable')
      if (!editorContainer) {
        throw new Error('에디터 컨테이너를 찾을 수 없습니다.')
      }

      // 이미지 블럭들을 찾기 (div.block contenteditable="false")
      const imageBlocks = Array.from(editorContainer.querySelectorAll('div.block[contenteditable="false"]'))

      if (imageBlocks.length === 0) {
        return
      }

      // 이미지 블럭들을 에디터 컨테이너 상단으로 이동
      imageBlocks.forEach(block => {
        editorContainer.insertBefore(block, editorContainer.firstChild)
      })
    })

    this.logger.log(`이미지 블럭 이동 완료`)
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

    // 모바일/PC 공통 닉네임 입력 필드 대기 및 입력
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
          throw DcException.recaptchaNotSupported({
            message: 'reCAPTCHA 사이트 키를 찾을 수 없습니다.',
          })
        }

        const settings = await this.settingsService.getSettings()
        if (!settings.twoCaptchaApiKey) {
          throw DcException.recaptchaNotSupported({
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
          throw DcException.captchaFailed({ message: error.message })
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
        await page.click('.wrt-tit-box button')

        // 커스텀 팝업 대기 프로미스
        const customPopupPromise = this.waitForCustomPopup(page)

        // dialog, timeout, navigation, custom popup 중 먼저 완료되는 것을 대기
        const result = await Promise.race([
          dialogPromise,
          timeoutPromise,
          customPopupPromise,
          page
            .waitForURL(/\/board\/[^\/]+$/, { timeout: 60_000 })
            .then(() => null)
            .catch(() => null),
        ])

        // 커스텀 팝업 결과 처리
        if (result && typeof result === 'object' && 'isCustomPopup' in result) {
          throw DcException.postSubmitFailed({
            message: `글 등록 실패: ${result.message}`,
          })
        }

        const dialogMessage = result

        // 알림창이 떴을 경우 처리
        if (dialogMessage) {
          // 캡챠 오류 메시지일 경우에만 재시도
          if (captchaErrorMessages.some(m => dialogMessage.includes(m))) {
            captchaTryCount += 1
            if (captchaTryCount >= 3) throw DcException.captchaFailed()

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
            throw DcException.postSubmitFailed({
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
    // 모바일 버전에서 .gall-detail-lst에서 제목이 일치하는 첫 번째 글의 a href 추출
    await page.waitForSelector('.gall-detail-lst', { timeout: 60_000 })
    let postUrl = await page.evaluate(title => {
      // 모바일 버전 선택자 사용 - 광고 요소 제외하고 실제 게시글만 처리
      const mobileRows = Array.from(document.querySelectorAll('.gall-detail-lst li'))
      for (const row of mobileRows) {
        // 광고 요소는 제외 (.adv-inner 클래스가 있는 li는 광고)
        if (row.classList.contains('adv-inner')) continue

        const gallDetailLink = row.querySelector('.gall-detail-lnktb')
        if (!gallDetailLink) continue

        const subjectLink = gallDetailLink.querySelector('a.lt .subject-add .subjectin')
        if (!subjectLink) continue

        const text = subjectLink.textContent?.replace(/\s+/g, ' ').trim()
        if (text === title) {
          const parentLink = gallDetailLink.querySelector('a.lt')
          return parentLink?.getAttribute('href')
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
      throw DcException.postSubmitFailed({
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
        // 1. 게시글 목록 테이블이 나타날 때까지 대기
        page.waitForSelector('.gall-detail-lnktb', { timeout: 60_000 }),
      ])

      this.logger.log('게시글 목록 페이지로 이동 완료')
    } catch (error: any) {
      if (error.name === 'TimeoutError' || (error.message && error.message.includes('Timeout'))) {
        const msg = '게시글 목록 페이지로 60초 내에 이동하지 못했습니다. (타임아웃)'
        this.logger.warn(msg)
        throw DcException.postSubmitFailed({ message: msg })
      }
      this.logger.warn(`목록 페이지 이동 대기 중 타임아웃: ${error.message}`)
      throw DcException.postSubmitFailed({
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
            throw DcException.postSubmitFailed({ message: msg })
          }
          throw error
        }

        // 갤러리 접근 제한 팝업 처리
        await this.handleGalleryAccessPopup(page)

        // 글쓰기 버튼 클릭 (goWrite)
        try {
          await page.waitForSelector('a.btn-write.lnk', { timeout: 60_000 })
        } catch (error: any) {
          if (error.name === 'TimeoutError' || (error.message && error.message.includes('Timeout'))) {
            const msg = '글쓰기 버튼을 60초 내에 찾지 못했습니다. (타임아웃)'
            this.logger.warn(msg)
            throw DcException.postSubmitFailed({ message: msg })
          }
          throw error
        }
        await page.click('a.btn-write.lnk')
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
        throw DcException.postParamInvalid({
          message: `포스팅 파라미터 검증 실패: ${zodErrors.join(', ')}`,
        })
      }
      throw DcException.postParamInvalid({
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

  private _buildGalleryUrl(galleryInfo: GalleryInfo): string {
    const { id, type } = galleryInfo

    switch (type) {
      case 'board':
        return `https://m.dcinside.com/board/${id}`
      case 'mgallery':
        return `https://m.dcinside.com/mgallery/board/lists/?id=${id}`
      case 'mini':
        return `https://m.dcinside.com/mini/board/lists/?id=${id}`
      case 'person':
        return `https://m.dcinside.com/person/board/lists/?id=${id}`
      default:
        throw DcException.galleryTypeUnsupported({ type })
    }
  }

  /**
   * 디시인사이드 게시글의 조회수를 가져옵니다.
   * @param resultUrl 게시글 URL
   * @returns 조회수
   */
  public async getViewCount(resultUrl: string): Promise<number> {
    try {
      this.logger.log(`조회수 가져오기: ${resultUrl}`)

      const userAgent = new UserAgent({ deviceCategory: 'mobile' })
      const userAgentString = userAgent.toString()

      const response = await axios.get(resultUrl, {
        headers: {
          'User-Agent': userAgentString,
        },
        timeout: 10000,
      })

      const $ = cheerio.load(response.data)

      let viewCount = 0

      const mobileViewText = $('.gall-thum-btm-inner .ginfo2 li:nth-child(1)').text().trim()
      if (mobileViewText) {
        const match = mobileViewText.match(/조회수 \s*(\d+)/)
        if (match) {
          viewCount = parseInt(match[1], 10)
        }
      }

      this.logger.log(`조회수 파싱 완료: ${viewCount}`)
      return viewCount
    } catch (error) {
      this.logger.error(`조회수 가져오기 실패: ${error.message}`)
      throw DcException.viewCountFetchFailed({ message: error.message })
    }
  }
}
