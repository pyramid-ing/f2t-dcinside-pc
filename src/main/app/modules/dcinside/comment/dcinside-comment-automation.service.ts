import { Injectable } from '@nestjs/common'
import { Page, BrowserContext } from 'playwright'
import { DcinsideBaseService } from '@main/app/modules/dcinside/base/dcinside-base.service'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { CookieService } from '@main/app/modules/util/cookie.service'
import { TwoCaptchaService } from '@main/app/modules/util/two-captcha.service'
import { DcCaptchaSolverService } from '@main/app/modules/dcinside/util/dc-captcha-solver.service'
import { BrowserManagerService } from '@main/app/modules/util/browser-manager.service'
import { sleep } from '@main/app/utils/sleep'
import { retry } from '@main/app/utils/retry'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { TetheringService } from '@main/app/modules/util/tethering.service'
import { Settings, IpMode } from '@main/app/modules/settings/settings.types'
import { DcException } from '@main/common/errors/dc.exception'
import { DcinsideCommentSearchDto, SortType } from '@main/app/modules/dcinside/comment/dto/dcinside-comment-search.dto'
import {
  DcinsidePostItemDto,
  PostSearchResponseDto,
} from '@main/app/modules/dcinside/comment/dto/dcinside-post-item.dto'
import axios from 'axios'
import * as cheerio from 'cheerio'
import UserAgent from 'user-agents'

@Injectable()
export class DcinsideCommentAutomationService extends DcinsideBaseService {
  // 브라우저 ID 상수
  private static readonly BROWSER_IDS = {
    DCINSIDE_REUSE: 'dcinside',
    COMMENT_JOB_NEW: (jobId: string) => `comment-job-new-${jobId}`,
    PROXY: 'dcinside-comment-proxy',
    FALLBACK: 'dcinside-comment-fallback',
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

  /**
   * 개별 게시물에 댓글 작성 (API 방식)
   */
  async commentOnPost(
    postUrl: string,
    comment: string,
    nickname: string | null,
    password: string | null,
    loginId: string | null,
    loginPassword: string | null,
    jobId: string,
  ): Promise<void> {
    await this.jobLogsService.createJobLog(jobId, '브라우저 자동화 방식으로 댓글 작성 시작')

    const settings = await this.settingsService.getSettings()

    // 1. 페이지 켜기 (브라우저 생성)
    const { context, page, browserId } = await this._launchBrowser(jobId, settings)

    try {
      // 2. IP 변경 처리
      await this._handleIpChange(jobId, settings)

      // 3. 로그인 처리
      const isMember = await this._handleLogin(jobId, context, page, loginId, loginPassword)

      // 4. 작업 간 딜레이
      await this.applyTaskDelay(jobId, settings)

      // 5. 댓글 작성 실행
      await this._navigateToPost(page, postUrl)

      // 비정상(삭제/존재하지 않음) 페이지 감지 시 예외 발생
      await this.checkAbnormalPage(page)

      await this._validateCommentForm(page)
      // 비회원일 때만 닉네임과 비밀번호 입력
      if (!isMember) {
        await this._inputNickname(page, nickname)
        await this._inputPassword(page, password)
      }

      await this._inputComment(page, comment)

      await this._submitCommentWithRetry(page, postUrl)
    } finally {
      // 브라우저 종료 (신규 생성 모드일 때만)
      if (!settings.reuseWindowBetweenTasks) {
        await this._closeBrowser(jobId, browserId)
      }
    }
  }

  /**
   * 디시인사이드 게시물 검색 (모바일 기준)
   */
  async searchPosts(searchDto: DcinsideCommentSearchDto): Promise<PostSearchResponseDto> {
    try {
      const { keyword, sortType = SortType.NEW, maxCount } = searchDto

      // 모바일 검색 URL 구성 - 정확한 옵션 타입 사용
      const optionType = sortType === SortType.NEW ? 'recency_plus' : 'rankup'
      const searchUrl = `https://m.dcinside.com/search/gall_content?keyword=${encodeURIComponent(keyword)}&option_type=${optionType}`

      this.logger.log(`Searching posts (mobile): ${searchUrl}`)

      const userAgent = new UserAgent({ deviceCategory: 'mobile' }).toString()

      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': userAgent,
        },
        timeout: 10000,
      })

      const $ = cheerio.load(response.data)
      const posts: DcinsidePostItemDto[] = []

      // 모바일 게시물 목록 파싱 (.sch-lst li)
      $('.sch-lst li').each((index, element) => {
        const $item = $(element)
        const $link = $item.find('a')
        const $title = $item.find('.sch-lnk .tit')
        const $summary = $item.find('.sch-lnk .txt')
        const $galleryName = $item.find('.sch-lnk-sub .gallname-lnk')
        const $date = $item.find('.sch-lnk-sub .date')

        if ($link.length > 0 && $title.length > 0) {
          const title = $title.text().trim()
          const url = $link.attr('href')
          const summary = $summary.text().trim()
          const galleryName = $galleryName.text().trim()
          const date = $date.text().trim()

          if (url && title) {
            posts.push({
              id: `${Date.now()}_${index}`,
              title,
              url: url.startsWith('http') ? url : `https://m.dcinside.com${url}`,
              board: galleryName,
              date,
              summary: summary || undefined,
              galleryName,
            })
          }
        }
      })

      // 다음 페이지 존재 여부 확인
      const hasNextPage = $('.paging .next').length > 0

      // maxCount가 지정된 경우, 목표 개수까지 다음 페이지를 순회하며 누적 수집
      if (typeof maxCount === 'number' && maxCount > 0) {
        let currentPage = 1
        let canContinue = hasNextPage

        while (posts.length < maxCount && canContinue) {
          currentPage += 1

          // 다음 페이지 URL 구성
          const nextUrl = `${searchUrl}&page=${currentPage}`

          this.logger.log(`Searching posts (pagination): ${nextUrl}`)

          const nextResp = await axios.get(nextUrl, {
            headers: {
              'User-Agent': userAgent,
            },
            timeout: 10000,
          })

          const _$ = cheerio.load(nextResp.data)

          _$('.sch-lst li').each((index, element) => {
            if (posts.length >= maxCount) return
            const $item = _$(element)
            const $link = $item.find('a')
            const $title = $item.find('.sch-lnk .tit')
            const $summary = $item.find('.sch-lnk .txt')
            const $galleryName = $item.find('.sch-lnk-sub .gallname-lnk')
            const $date = $item.find('.sch-lnk-sub .date')

            if ($link.length > 0 && $title.length > 0) {
              const title = $title.text().trim()
              const url = $link.attr('href')
              const summary = $summary.text().trim()
              const galleryName = $galleryName.text().trim()
              const date = $date.text().trim()

              if (url && title) {
                posts.push({
                  id: `${Date.now()}_${currentPage}_${index}`,
                  title,
                  url: url.startsWith('http') ? url : `https://m.dcinside.com${url}`,
                  board: galleryName,
                  date,
                  summary: summary || undefined,
                  galleryName,
                })
              }
            }
          })

          canContinue = _$('.paging .next').length > 0
        }
      }

      this.logger.log(`Found ${posts.length} posts for keyword: ${keyword}`)

      return {
        posts: typeof maxCount === 'number' && maxCount > 0 ? posts.slice(0, maxCount) : posts,
        totalCount: posts.length,
        currentPage: 1,
        hasNextPage,
      }
    } catch (error) {
      this.logger.error(`Failed to search posts: ${error.message}`, error.stack)
      throw DcException.postSubmitFailed({
        message: '게시물 검색에 실패했습니다.',
        originalError: error.message,
      })
    }
  }

  /**
   * 1. 페이지 켜기 (브라우저 생성)
   */
  private async _launchBrowser(
    jobId: string,
    settings: Settings,
  ): Promise<{ context: BrowserContext; page: Page; browserId: string }> {
    // 브라우저 ID 생성 (재사용 모드에 따라 결정)
    const browserId = settings.reuseWindowBetweenTasks
      ? DcinsideCommentAutomationService.BROWSER_IDS.DCINSIDE_REUSE
      : DcinsideCommentAutomationService.BROWSER_IDS.COMMENT_JOB_NEW(jobId)

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
  private async _handleLogin(
    jobId: string,
    context: BrowserContext,
    page: Page,
    loginId: string | null,
    loginPassword: string | null,
  ): Promise<boolean> {
    let isMember = false
    if (loginId && loginPassword) {
      await this.jobLogsService.createJobLog(jobId, `로그인 시도: ${loginId}`)
      await this.handleBrowserLogin(context, page, loginId, loginPassword)
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

  /**
   * 게시물 페이지로 이동
   */
  private async _navigateToPost(page: Page, postUrl: string): Promise<void> {
    await page.goto(postUrl, { waitUntil: 'load' })
  }

  /**
   * 댓글 작성 폼 검증 및 스크롤 이동 (모바일 전용)
   */
  private async _validateCommentForm(page: Page): Promise<void> {
    const commentForm = page.locator('.comment-write')
    if ((await commentForm.count()) === 0) {
      // 댓글 쓰기가 불가능한 게시판인지 확인
      const commentDisabledMessage = page.locator('.comment_disabled, .cmt_disabled, .no_comment')
      if ((await commentDisabledMessage.count()) > 0) {
        throw DcException.commentDisabledPage({
          message: '댓글쓰기가 불가능한 게시판입니다',
        })
      }

      // 로그인이 필요한 경우인지 확인
      const loginRequiredMessage = page.locator('.login_required, .need_login')
      if ((await loginRequiredMessage.count()) > 0) {
        throw DcException.commentDisabledPage({
          message: '댓글 작성에 로그인이 필요합니다',
        })
      }

      throw DcException.commentDisabledPage({
        message: '댓글 작성 폼을 찾을 수 없습니다',
      })
    }

    // 댓글 폼이 존재하면 해당 위치로 스크롤 이동
    await commentForm.scrollIntoViewIfNeeded()
  }

  /**
   * 1. 닉네임 입력
   */
  private async _inputNickname(page: Page, nickname: string | null): Promise<void> {
    if (!nickname || nickname.trim() === '') {
      return
    }

    // 갤닉네임이 있는지 확인 (모바일 전용)
    const gallNickname = await page.$(`#comment_nick`)
    if (gallNickname) {
      const gallNickValue = await gallNickname.inputValue()
      this.logger.log(`Gall nickname found: "${gallNickValue}"`)

      // readonly 속성을 여러 방법으로 확인
      const hasReadonlyAttr = await gallNickname.evaluate(el => el.hasAttribute('disabled'))

      // 갤닉네임이 있고 readonly인 경우 X 버튼 클릭 (모바일 전용)
      if (gallNickValue && hasReadonlyAttr) {
        this.logger.log('Gall nickname is readonly, clicking X button')
        const deleteButton = await page.$(`#delete_nickname_btn`)
        if (deleteButton) {
          await deleteButton.click()
          await sleep(500)
          this.logger.log('X button clicked successfully')
        } else {
          this.logger.warn('X button not found')
        }
      } else {
        this.logger.log('Gall nickname is not readonly, skipping X button click')
      }
    }

    // 모바일 댓글 폼에서만 닉네임 입력
    const mobileNicknameInput = page.locator(`#comment_nick`)
    if ((await mobileNicknameInput.count()) > 0) {
      await mobileNicknameInput.fill(nickname)
      this.logger.log(`Mobile comment nickname filled: ${nickname}`)
    } else {
      this.logger.warn('Mobile comment nickname input field not found')
    }
  }

  /**
   * 2. 비밀번호 입력
   */
  private async _inputPassword(page: Page, password: string | null): Promise<void> {
    if (password && password.trim() !== '') {
      // 모바일 댓글 폼에서만 비밀번호 입력
      const mobilePasswordInput = page.locator(`#comment_pw`)
      if ((await mobilePasswordInput.count()) > 0) {
        await mobilePasswordInput.fill(password)
        this.logger.log(`Mobile comment password filled`)
      } else {
        this.logger.warn(`Mobile comment password input field not found`)
      }
    }
  }

  /**
   * 3. 댓글 내용 입력
   */
  private async _inputComment(page: Page, comment: string): Promise<void> {
    // 모바일 댓글 폼에서만 댓글 내용 입력
    const mobileCommentTextarea = page.locator(`#comment_memo`)
    if ((await mobileCommentTextarea.count()) > 0) {
      await mobileCommentTextarea.click()
      await mobileCommentTextarea.fill(comment)
      this.logger.log(`Mobile comment filled`)
    } else {
      throw DcException.commentDisabledPage({
        message: '모바일 댓글 입력 필드를 찾을 수 없습니다',
      })
    }
  }

  /**
   * 댓글 등록 (재시도 포함)
   */
  private async _submitCommentWithRetry(page: Page, postUrl: string): Promise<void> {
    await retry(
      async () => {
        // 캡차 확인
        const captchaResult = await this._handleCaptcha(page)
        if (!captchaResult.success) {
          throw DcException.captchaSolveFailed({
            message: `자동입력 방지코드가 일치하지 않습니다. (${captchaResult.error})`,
          })
        }

        // 제출 전 댓글 개수 확인
        const commentCountBefore = await this._getCommentCount(page)
        this.logger.log(`제출 전 댓글 개수: ${commentCountBefore}`)

        // 댓글 등록 전에 dialog 이벤트 리스너 등록
        let alertMessage = ''
        const dialogHandler = async (dialog: any) => {
          alertMessage = dialog.message()
          this.logger.log(`Alert detected: ${alertMessage}`)
          await dialog.accept()
        }
        page.on('dialog', dialogHandler)

        try {
          const submitButton = await page.$(`.btn-comment-write`)
          if (!submitButton) {
            throw DcException.commentDisabledPage({
              message: '댓글 작성 버튼을 찾을 수 없습니다.',
            })
          }

          await submitButton.click()
          this.logger.log('댓글 작성 버튼 클릭 완료')

          // 충분한 대기 시간 (5초)
          await sleep(3000)

          // 댓글 등록 후 성공/실패 메시지 확인
          await this._checkCommentSubmissionResult(alertMessage)

          this.logger.log(`Comment posted successfully on: ${postUrl}`)
        } finally {
          // 이벤트 리스너 정리
          page.removeAllListeners('dialog')
        }
      },
      3000, // 3초 간격
      3, // 최대 3회 재시도
      'linear', // 선형 백오프
    )
  }

  /**
   * 현재 댓글 개수 가져오기
   */
  private async _getCommentCount(page: Page): Promise<number> {
    try {
      // 모바일 댓글 목록에서 개수 확인
      const comments = await page.$$('.all-comment-lst li')
      return comments.length
    } catch {
      return 0
    }
  }

  /**
   * 캡차 처리
   */
  private async _handleCaptcha(page: Page): Promise<{ success: boolean; error?: string }> {
    try {
      // 모바일 댓글용 캡차 감지
      const captchaElement = page.locator('#captcha_codeC')
      const captchaCount = await captchaElement.count()

      if (captchaCount > 0) {
        this.logger.log('모바일 댓글용 캡차 감지됨, 해결 시작')

        // 캡챠 새로고침 버튼 클릭 (댓글용)
        const refreshButton = page.locator('.comment-write .code .sp-reload')
        if ((await refreshButton.count()) > 0) {
          this.logger.log('댓글용 캡챠 새로고침 버튼 클릭')
          await refreshButton.click()
          await sleep(1000) // 새로고침 후 잠시 대기
        }

        // 모바일 댓글용 캡차 해결
        await this.solveDcCaptcha(page, '.comment-write .code img', '#captcha_codeC')
      } else {
        this.logger.log('모바일 댓글용 캡차가 감지되지 않음')
      }

      return { success: true }
    } catch (error) {
      this.logger.error(`댓글용 캡차 처리 실패: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  /**
   * 댓글 등록 결과 확인
   */
  private async _checkCommentSubmissionResult(alertMessage: string): Promise<void> {
    // 댓글 내용 없음 체크
    if (alertMessage.includes('내용을 입력하세요')) {
      throw DcException.commentDisabledPage({
        message: '내용을 입력하세요.',
      })
    }

    // 캡차 실패 체크
    if (alertMessage.includes('자동입력 방지코드가 일치하지 않습니다')) {
      throw DcException.captchaSolveFailed({
        message: '자동입력 방지코드가 일치하지 않습니다.',
      })
    }

    // 기타 에러 메시지들
    if (alertMessage.includes('댓글을 입력')) {
      throw DcException.commentDisabledPage({
        message: '댓글을 입력해주세요.',
      })
    }

    if (alertMessage.includes('비밀번호를 입력')) {
      throw DcException.commentDisabledPage({
        message: '비밀번호를 입력해주세요.',
      })
    }

    if (alertMessage.includes('닉네임을 입력')) {
      throw DcException.nicknameRequired({
        message: '닉네임을 입력해주세요.',
      })
    }

    // alert 메시지가 있었다면 에러로 처리
    if (alertMessage) {
      throw DcException.commentDisabledPage({
        message: `댓글 등록 실패: ${alertMessage}`,
        alertMessage,
      })
    }

    this.logger.log('댓글 등록 완료 (에러 메시지 없음)')
  }
}
