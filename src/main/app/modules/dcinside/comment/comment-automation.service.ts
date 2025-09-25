import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { Page, Browser } from 'playwright'
import { TwoCaptchaService } from '@main/app/modules/util/two-captcha.service'

@Injectable()
export class CommentAutomationService {
  private readonly logger = new Logger(CommentAutomationService.name)

  constructor(
    private prisma: PrismaService,
    private twoCaptchaService: TwoCaptchaService,
  ) {}

  /**
   * 댓글 자동화 작업 실행
   */
  async executeCommentJob(jobId: string, browser: Browser): Promise<void> {
    try {
      const commentJob = await this.prisma.commentJob.findFirst({
        where: { jobId },
        include: { job: true },
      })

      if (!commentJob) {
        throw new Error(`Comment job not found: ${jobId}`)
      }

      this.logger.log(`Starting comment job: ${jobId}`)

      // 작업 상태를 processing으로 변경
      await this.prisma.job.update({
        where: { id: commentJob.jobId },
        data: { status: 'processing' },
      })

      const postUrls = JSON.parse(commentJob.postUrls)

      for (const postUrl of postUrls) {
        try {
          await this.commentOnPost(
            browser,
            postUrl,
            commentJob.comment,
            commentJob.nickname,
            commentJob.password,
            true, // ipChangeEnabled - 항상 true
            true, // captchaEnabled - 항상 true
          )

          // 작업 간격 대기
          if (commentJob.taskDelay > 0) {
            await this.sleep(commentJob.taskDelay * 1000)
          }
        } catch (error) {
          this.logger.error(`Failed to comment on post ${postUrl}: ${error.message}`)

          // 특정 에러 타입에 따라 처리
          if (error.message.includes('댓글쓰기가 불가능한 게시판')) {
            this.logger.warn(`Skipping post due to disabled comments: ${postUrl}`)
          } else if (error.message.includes('로그인이 필요')) {
            this.logger.warn(`Skipping post due to login requirement: ${postUrl}`)
          } else {
            this.logger.error(`Unexpected error for post ${postUrl}: ${error.message}`)
          }

          // 개별 게시물 실패는 로그만 남기고 계속 진행
        }
      }

      // 작업 완료
      await this.prisma.job.update({
        where: { id: commentJob.jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      })

      this.logger.log(`Comment job completed: ${jobId}, processed ${postUrls.length} posts`)
    } catch (error) {
      this.logger.error(`Comment job failed: ${error.message}`, error.stack)

      // 작업 실패 처리
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          errorMsg: error.message,
        },
      })
    }
  }

  /**
   * 개별 게시물에 댓글 작성
   */
  private async commentOnPost(
    browser: Browser,
    postUrl: string,
    comment: string,
    nickname: string,
    password: string,
    ipChangeEnabled: boolean,
    captchaEnabled: boolean,
  ): Promise<void> {
    const page = await browser.newPage()

    try {
      // User-Agent 설정
      await page.setExtraHTTPHeaders({
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      })

      // IP 변경이 필요한 경우 여기서 처리
      if (ipChangeEnabled) {
        // TODO: IP 변경 로직 구현
        this.logger.log('IP change requested but not implemented yet')
      }

      // 게시물 페이지로 이동
      await page.goto(postUrl, { waitUntil: 'networkidle' })

      // 댓글 작성 폼 찾기
      const commentForm = page.locator('.cmt_write_box')
      if ((await commentForm.count()) === 0) {
        // 댓글 쓰기가 불가능한 게시판인지 확인
        const commentDisabledMessage = page.locator('.comment_disabled, .cmt_disabled, .no_comment')
        if ((await commentDisabledMessage.count()) > 0) {
          throw new Error('댓글쓰기가 불가능한 게시판입니다')
        }

        // 로그인이 필요한 경우인지 확인
        const loginRequiredMessage = page.locator('.login_required, .need_login')
        if ((await loginRequiredMessage.count()) > 0) {
          throw new Error('댓글 작성에 로그인이 필요합니다')
        }

        throw new Error('댓글 작성 폼을 찾을 수 없습니다')
      }

      // 게시물 번호 추출
      const postNo = this.extractPostNo(postUrl)
      if (!postNo) {
        throw new Error('게시물 번호를 찾을 수 없습니다')
      }

      // 닉네임 입력 처리
      await this.handleNicknameInput(page, postNo, nickname)

      // 비밀번호 입력
      const passwordInput = page.locator('#password_' + postNo)
      if ((await passwordInput.count()) > 0) {
        await passwordInput.fill(password)
      }

      // 댓글 내용 입력
      const commentTextarea = page.locator('#memo_' + postNo)
      if ((await commentTextarea.count()) > 0) {
        await commentTextarea.fill(comment)
      } else {
        throw new Error('댓글 입력 필드를 찾을 수 없습니다')
      }

      // 캡차 확인
      if (captchaEnabled) {
        const captchaResult = await this.handleCaptcha(page)
        if (!captchaResult.success) {
          throw new Error('Captcha solving failed')
        }
      }

      // 댓글 등록 버튼 클릭
      const submitButton = page.locator(`button[data-no="${postNo}"].repley_add`)
      if ((await submitButton.count()) > 0) {
        await submitButton.click()
        await page.waitForTimeout(3000)

        // 댓글 등록 후 성공/실패 메시지 확인
        await this.checkCommentSubmissionResult(page)
      } else {
        throw new Error('댓글 등록 버튼을 찾을 수 없습니다')
      }

      this.logger.log(`Comment posted successfully on: ${postUrl}`)
    } finally {
      await page.close()
    }
  }

  /**
   * 캡차 처리
   */
  private async handleCaptcha(page: Page): Promise<{ success: boolean; error?: string }> {
    try {
      // reCAPTCHA 확인 및 처리
      const recaptchaResult = await this.detectAndSolveRecaptcha(page)
      if (recaptchaResult.found && recaptchaResult.success) {
        return { success: true }
      }

      // DC인사이드 캡차 확인
      const dcCaptchaResult = await this.detectDcCaptcha(page)
      if (dcCaptchaResult.found) {
        // DC인사이드 캡차는 별도 처리 필요
        this.logger.warn('DC Inside captcha detected, manual intervention may be required')
        return { success: false, error: 'DC Inside captcha detected' }
      }

      return { success: true }
    } catch (error) {
      this.logger.error(`Captcha handling failed: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  /**
   * reCAPTCHA 감지 및 해결
   */
  private async detectAndSolveRecaptcha(page: Page): Promise<{ found: boolean; success: boolean; error?: string }> {
    try {
      // reCAPTCHA iframe 확인
      const recaptchaIframe = page.locator('iframe[src*="recaptcha"]')
      if ((await recaptchaIframe.count()) === 0) {
        return { found: false, success: true }
      }

      // reCAPTCHA 사이트 키 추출
      const siteKeyElement = page.locator('[data-sitekey]')
      if ((await siteKeyElement.count()) === 0) {
        return { found: true, success: false, error: 'reCAPTCHA site key not found' }
      }

      const siteKey = await siteKeyElement.getAttribute('data-sitekey')
      if (!siteKey) {
        return { found: true, success: false, error: 'reCAPTCHA site key is empty' }
      }

      // TODO: 2captcha API 키를 설정에서 가져와야 함
      const apiKey = 'YOUR_2CAPTCHA_API_KEY' // 실제로는 설정에서 가져와야 함

      if (apiKey === 'YOUR_2CAPTCHA_API_KEY') {
        this.logger.warn('2captcha API key not configured, skipping reCAPTCHA solving')
        return { found: true, success: false, error: '2captcha API key not configured' }
      }

      // 2captcha로 reCAPTCHA 해결
      const token = await this.twoCaptchaService.solveRecaptchaV2(apiKey, siteKey, page.url())

      // reCAPTCHA 토큰을 페이지에 주입
      await page.evaluate(token => {
        const responseElement = document.querySelector('[name="g-recaptcha-response"]') as HTMLTextAreaElement
        if (responseElement) {
          responseElement.value = token
          responseElement.style.display = 'block'
        }
      }, token)

      return { found: true, success: true }
    } catch (error) {
      this.logger.error(`reCAPTCHA solving failed: ${error.message}`)
      return { found: true, success: false, error: error.message }
    }
  }

  /**
   * DC인사이드 캡차 감지
   */
  private async detectDcCaptcha(page: Page): Promise<{ found: boolean }> {
    try {
      const captchaElement = page.locator('.captcha')
      return { found: (await captchaElement.count()) > 0 }
    } catch (error) {
      return { found: false }
    }
  }

  /**
   * 닉네임 입력 처리 (갤닉네임과 사용자 닉네임 구분)
   */
  private async handleNicknameInput(page: Page, postNo: string, nickname: string): Promise<void> {
    try {
      // 갤닉네임이 있는지 확인
      const gallNickname = await page.$(`#gall_nick_name_${postNo}`)
      if (gallNickname) {
        const gallNickValue = await gallNickname.inputValue()
        this.logger.log(`Gall nickname found: "${gallNickValue}"`)

        // readonly 속성을 여러 방법으로 확인
        const hasReadonlyAttr = await gallNickname.evaluate(el => el.hasAttribute('readonly'))

        // 갤닉네임이 있고 readonly인 경우 X 버튼 클릭
        if (gallNickValue && hasReadonlyAttr) {
          this.logger.log('Gall nickname is readonly, clicking X button')
          const deleteButton = await page.$(`#btn_gall_nick_name_x_${postNo}`)
          if (deleteButton) {
            await deleteButton.click()
            await page.waitForTimeout(500)
            this.logger.log('X button clicked successfully')
          } else {
            this.logger.warn('X button not found')
          }
        } else {
          this.logger.log('Gall nickname is not readonly, skipping X button click')
        }
      }

      // 사용자 닉네임 입력 (X 버튼 클릭 후 잠시 대기)
      await page.waitForTimeout(300)

      const userNicknameInput = page.locator(`#name_${postNo}`)
      if ((await userNicknameInput.count()) > 0) {
        await userNicknameInput.fill(nickname)
        this.logger.log(`User nickname filled: ${nickname}`)
      } else {
        // 사용자 닉네임 필드가 없으면 갤닉네임 필드에 직접 입력 시도
        const gallNicknameInput = page.locator(`#gall_nick_name_${postNo}`)
        if ((await gallNicknameInput.count()) > 0) {
          await gallNicknameInput.fill(nickname)
          this.logger.log(`Gall nickname filled: ${nickname}`)
        } else {
          this.logger.warn('No nickname input field found')
        }
      }
    } catch (error) {
      this.logger.warn(`Nickname input handling failed: ${error.message}`)
      // 닉네임 입력 실패는 치명적이지 않으므로 계속 진행
    }
  }

  /**
   * 댓글 등록 결과 확인
   */
  private async checkCommentSubmissionResult(page: Page): Promise<void> {
    try {
      // 에러 메시지 확인
      const errorSelectors = ['.error_msg', '.fail_msg', '.alert_msg', '.warning_msg', '.notice_msg']

      for (const selector of errorSelectors) {
        const errorElement = page.locator(selector)
        if ((await errorElement.count()) > 0) {
          const errorText = await errorElement.textContent()
          if (errorText && errorText.trim()) {
            throw new Error(`댓글 등록 실패: ${errorText.trim()}`)
          }
        }
      }

      // 성공 메시지나 새로운 댓글이 추가되었는지 확인
      const successIndicators = ['.success_msg', '.complete_msg', '.new_comment', '.comment_added']

      let successFound = false
      for (const selector of successIndicators) {
        const successElement = page.locator(selector)
        if ((await successElement.count()) > 0) {
          successFound = true
          break
        }
      }

      // 성공 지표가 없어도 에러가 없으면 성공으로 간주
      if (!successFound) {
        this.logger.log('Comment submission completed (no explicit success message found)')
      } else {
        this.logger.log('Comment submission successful')
      }
    } catch (error) {
      this.logger.error(`Comment submission result check failed: ${error.message}`)
      throw error
    }
  }

  /**
   * 게시물 번호 추출
   */
  private extractPostNo(url: string): string {
    const match = url.match(/no=(\d+)/)
    return match ? match[1] : ''
  }

  /**
   * 지연 함수
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
