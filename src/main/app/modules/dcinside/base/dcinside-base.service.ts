import { Injectable, Logger } from '@nestjs/common'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { CookieService } from '@main/app/modules/util/cookie.service'
import { TwoCaptchaService } from '@main/app/modules/util/two-captcha.service'
import { DcCaptchaSolverService } from '@main/app/modules/dcinside/util/dc-captcha-solver.service'
import { BrowserManagerService, getProxyByMethod } from '@main/app/modules/util/browser-manager.service'
import { TetheringService } from '@main/app/modules/util/tethering.service'
import { IpMode, Settings } from '@main/app/modules/settings/settings.types'
import { BrowserContext, Page } from 'playwright'
import UserAgent from 'user-agents'
import { sleep } from '@main/app/utils/sleep'
import { DcException } from '@main/common/errors/dc.exception'
import { ChromeNotInstalledError } from '@main/common/errors/chrome-not-installed.exception'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { Permission } from '@main/app/modules/auth/auth.guard'
import { getExternalIp } from '@main/app/utils/ip'
import { assertPermission } from '@main/app/utils/permission.assert'

export type GalleryType = 'board' | 'mgallery' | 'mini' | 'person'

export interface GalleryInfo {
  id: string
  type: GalleryType
  postNo?: string
}

export function assertValidPopupPage(popupPage: any): asserts popupPage is Page {
  if (!popupPage) {
    throw DcException.postNotFoundOrDeleted({
      message: '이미지 팝업 윈도우를 찾을 수 없습니다.',
    })
  }
}

export function assertRetrySuccess(success: boolean, errorMessage: string): asserts success is true {
  if (!success) {
    throw DcException.commentDisabledPage({ message: errorMessage })
  }
}

// reCAPTCHA(리캡챠) 감지 함수: iframe에서 사이트 키 추출
export async function detectRecaptcha(page: Page): Promise<{ found: boolean; siteKey?: string }> {
  return await page.evaluate(() => {
    // reCAPTCHA iframe 찾기
    const iframe = document.querySelector('iframe[src*="recaptcha"]') as HTMLIFrameElement
    if (iframe && iframe.src) {
      const url = new URL(iframe.src)
      const siteKey = url.searchParams.get('k')
      if (siteKey) {
        return { found: true, siteKey }
      }
    }
    return { found: false }
  })
}

@Injectable()
export abstract class DcinsideBaseService {
  protected readonly logger: Logger

  constructor(
    protected readonly settingsService: SettingsService,
    protected readonly cookieService: CookieService,
    protected readonly twoCaptchaService: TwoCaptchaService,
    protected readonly dcCaptchaSolverService: DcCaptchaSolverService,
    protected readonly browserManagerService: BrowserManagerService,
    protected readonly tetheringService: TetheringService,
    protected readonly jobLogsService: JobLogsService,
  ) {
    this.logger = new Logger(this.constructor.name)
  }

  /**
   * 브라우저 실행 (프록시 지원)
   */
  public async launch(options?: {
    browserId?: string
    headless?: boolean
    reuseExisting?: boolean
    respectProxy?: boolean
  }) {
    let proxyArg = undefined
    let proxyAuth = undefined
    let lastError = null
    let proxyInfo = null

    const settings = await this.settingsService.getSettings()
    const headless = options?.headless ?? !settings.showBrowserWindow
    const respectProxy = options?.respectProxy ?? true

    // ipMode가 proxy일 때만 프록시 적용
    if (respectProxy && settings?.ipMode === IpMode.PROXY && settings?.proxies && settings.proxies.length > 0) {
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
          const browser = await this.browserManagerService.getOrCreateBrowser(options?.browserId, headless, [proxyArg])
          if (options?.reuseExisting) {
            let context = browser.contexts()[0] || null
            let page: Page | null = null
            if (context) {
              page = context.pages()[0] || (await context.newPage())
            } else {
              const cp = await this.initContextAndPage(browser, { proxyAuth })
              context = cp.context
              page = cp.page
            }
            return { browser, context, page, proxyInfo }
          }
          const { context, page } = await this.initContextAndPage(browser, { proxyAuth })
          return { browser, context, page, proxyInfo }
        } catch (error) {
          // 브라우저 설치 오류를 런처 상위에서 도메인 예외로 변환
          if (error instanceof ChromeNotInstalledError) {
            throw DcException.chromeNotInstalled({
              message: '크롬 브라우저가 설치되지 않았습니다. 크롬을 재설치 해주세요.',
            })
          }
          this.logger.warn(`프록시 브라우저 실행 실패: ${error.message}`)
          lastError = error
        }
      }
    }
    // fallback: 프록시 없이 재시도
    try {
      const browser = await this.browserManagerService.getOrCreateBrowser(options?.browserId, headless)
      if (options?.reuseExisting) {
        let context = browser.contexts()[0] || null
        let page: Page | null = null
        if (context) {
          page = context.pages()[0] || (await context.newPage())
        } else {
          const cp = await this.initContextAndPage(browser)
          context = cp.context
          page = cp.page
        }
        if (lastError) this.logger.warn('프록시 모드 실패 또는 미적용으로 프록시 없이 브라우저를 재시도합니다.')
        return { browser, context, page, proxyInfo: null }
      }
      const { context, page } = await this.initContextAndPage(browser)
      if (lastError) this.logger.warn('프록시 모드 실패 또는 미적용으로 프록시 없이 브라우저를 재시도합니다.')
      return { browser, context, page, proxyInfo: null }
    } catch (error) {
      // 브라우저 설치 오류를 런처 상위에서 도메인 예외로 변환
      if (error instanceof ChromeNotInstalledError) {
        throw DcException.chromeNotInstalled({
          message: '크롬 브라우저가 설치되지 않았습니다. 크롬을 재설치 해주세요.',
        })
      }
      throw error
    }
  }

  /**
   * 공통 컨텍스트/페이지 생성 유틸
   * - viewport, userAgent, sessionStorage 초기화 스크립트 공통 적용
   * - 필요 시 컨텍스트 레벨 프록시 옵션 적용
   */
  public async initContextAndPage(
    browser: any,
    options?: { proxyAuth?: { server: string; username?: string; password?: string } },
  ): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({
      viewport: { width: 414, height: 896 }, // iPhone 11 Pro Max 크기
      userAgent: new UserAgent({ deviceCategory: 'mobile' }).toString(),
      ...(options?.proxyAuth ? { proxy: options.proxyAuth } : {}),
    })

    await context.addInitScript(() => {
      window.sessionStorage.clear()
    })

    const page = await context.newPage()
    return { context, page }
  }

  /**
   * 로그인 처리
   */
  public async login(
    page: Page,
    params: { id: string; password: string },
  ): Promise<{ success: boolean; message: string }> {
    try {
      await page.goto('https://dcinside.com/', { waitUntil: 'load', timeout: 60_000 })

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

  /**
   * 로그인 상태 확인 (모바일 전용)
   */
  public async isLogin(page: Page): Promise<boolean> {
    try {
      // 현재 페이지에서 .gall-tit-box가 이미 존재하는지 확인
      const hasGallTitBox = await page.$('.gall-tit-box')

      if (!hasGallTitBox) {
        // .gall-tit-box가 없으면 메인 페이지로 이동
        await page.goto('https://dcinside.com/', { waitUntil: 'load', timeout: 60_000 })
        await page.waitForSelector('.gall-tit-box', { timeout: 10000 })
      }

      // 모바일 버전에서만 .btn-write가 있으면 로그인된 상태 (글쓰기 버튼이 보임)
      const writeButton = await page.$('.btn-write')
      return !!writeButton
    } catch {
      return false
    }
  }

  /**
   * 브라우저별 로그인 처리 (브라우저 생성 직후 한 번만 실행)
   */
  public async handleBrowserLogin(
    browserContext: BrowserContext,
    page: Page,
    loginId: string,
    loginPassword: string,
  ): Promise<void> {
    this.logger.log(`로그인 처리 시작: ${loginId}`)

    // 브라우저 생성 직후 쿠키 로드 및 적용
    const cookies = this.cookieService.loadCookies('dcinside', loginId)

    // 쿠키가 있으면 먼저 적용해보기
    if (cookies && cookies.length > 0) {
      this.logger.log('저장된 쿠키를 브라우저에 적용합니다.')
      await browserContext.addCookies(cookies)
    }

    // 로그인 상태 확인
    const isLoggedIn = await this.isLogin(page)

    if (!isLoggedIn) {
      // 로그인이 안되어 있으면 로그인 실행
      if (!loginPassword) {
        throw DcException.authRequired({
          message: '로그인이 필요하지만 로그인 패스워드가 제공되지 않았습니다.',
        })
      }

      this.logger.log('로그인이 필요합니다. 자동 로그인을 시작합니다.')
      const loginResult = await this.login(page, {
        id: loginId,
        password: loginPassword,
      })

      if (!loginResult.success) {
        throw DcException.authRequired({
          message: `자동 로그인 실패: ${loginResult.message}`,
        })
      }

      // 로그인 성공 후 새로운 쿠키 저장
      const newCookies = await browserContext.cookies()
      this.cookieService.saveCookies('dcinside', loginId, newCookies)
      this.logger.log('로그인 성공 후 쿠키를 저장했습니다.')
    } else {
      this.logger.log('기존 쿠키로 로그인 상태가 유지되고 있습니다.')
    }
  }

  /**
   * reCAPTCHA 해결 (2captcha 사용)
   */
  protected async solveRecaptchaWith2Captcha(page: Page, siteKey: string, jobId?: string): Promise<void> {
    const settings = await this.settingsService.getSettings()
    const twoCaptchaApiKey = settings.twoCaptchaApiKey

    if (!twoCaptchaApiKey) {
      throw DcException.postParamInvalid({
        message: '2captcha API 키가 설정되지 않았습니다.',
      })
    }

    this.logger.log(`reCAPTCHA 감지됨 (사이트 키: ${siteKey}), 2captcha로 해결 시작`)
    if (jobId) {
      // JobLogsService가 있다면 로그 작성
      this.logger.log(`2captcha를 이용한 reCAPTCHA 해결 시작 (사이트 키: ${siteKey})`)
    }

    try {
      // 2captcha로 reCAPTCHA 해결
      const recaptchaToken = await this.twoCaptchaService.solveRecaptchaV2(twoCaptchaApiKey, siteKey, page.url())

      if (jobId) {
        this.logger.log('reCAPTCHA 토큰 획득 완료, 페이지에 적용 중...')
      }

      // 토큰을 g-recaptcha-response textarea에 적용
      await page.evaluate(token => {
        const responseElement = document.querySelector('#g-recaptcha-response') as HTMLTextAreaElement
        if (responseElement) {
          responseElement.value = token
          responseElement.style.display = 'block'
        }
      }, recaptchaToken)

      if (jobId) {
        this.logger.log('reCAPTCHA 해결 완료')
      }

      this.logger.log('2captcha reCAPTCHA 해결 완료')
    } catch (error) {
      const errorMessage = `2captcha reCAPTCHA 해결 실패: ${error.message}`
      this.logger.error(errorMessage)

      if (jobId) {
        this.logger.error(errorMessage)
      }

      throw DcException.postSubmitFailed({
        message: errorMessage,
      })
    }
  }

  /**
   * DC 캡챠 해결
   */
  protected async solveDcCaptcha(
    page: Page,
    captchaImgSelector: string,
    inputSelector: string,
    jobId?: string,
  ): Promise<void> {
    try {
      const captchaImg = page.locator(captchaImgSelector)
      const captchaCount = await captchaImg.count()

      if (captchaCount > 0) {
        this.logger.log('DC 캡챠 감지됨, 해결 시작')

        // 캡챠 이미지 추출
        const captchaImageBase64 = await this.dcCaptchaSolverService.extractCaptchaImageBase64(page, captchaImgSelector)

        // 캡챠 해결
        const answer = await this.dcCaptchaSolverService.solveDcCaptcha(captchaImageBase64)

        // 캡챠 입력 필드에 답안 입력
        const captchaInput = page.locator(inputSelector)
        if ((await captchaInput.count()) > 0) {
          await captchaInput.fill(answer)
          this.logger.log(`캡챠 답안 입력 완료: ${answer}`)
        }
      } else {
        this.logger.log('캡챠가 존재하지 않음')
      }
    } catch (error) {
      this.logger.error(`캡챠 처리 실패: ${error.message}`)
      throw DcException.captchaSolveFailed({ message: error.message })
    }
  }

  /**
   * 비정상(삭제/존재하지 않음) 페이지 감지
   */
  protected async checkAbnormalPage(page: Page): Promise<void> {
    const abnormalInfo = await page.evaluate(() => {
      // 모바일 DC인사이드의 penalty-box 구조 확인
      const container = document.querySelector('.penalty-box') as HTMLElement | null
      if (!container) return null

      const texts: string[] = []

      // penalty-box 내의 모든 p 태그에서 텍스트 추출
      const paragraphs = Array.from(container.querySelectorAll('p.txt')) as HTMLElement[]
      for (const p of paragraphs) {
        if (p.textContent) {
          const text = p.textContent.trim()
          if (text) texts.push(text)
        }
      }

      const combined = texts.join(' ')
      return { combined, texts }
    })

    if (abnormalInfo) {
      const combined = abnormalInfo.combined || ''

      // 삭제/존재하지 않음 관련 패턴들 (한국어/영문 보조 문구 포함)
      const deletionPatterns = [
        '게시물 작성자가 삭제했거나 존재하지 않는 페이지입니다',
        'You will be redirected in a few seconds',
      ]

      const redirectHints = ['잠시 후 갤러리 리스트로 이동됩니다', 'You will be redirected in a few seconds']

      const deletionDetected = deletionPatterns.some(p => combined.includes(p))
      const redirectDetected = redirectHints.some(p => combined.includes(p))

      if (deletionDetected || redirectDetected) {
        this.logger.log(`삭제 완료: ${combined} (이미 삭제됨)`)
        throw DcException.postNotFoundOrDeleted({ message: combined })
      }

      // 다른 비정상 상태는 에러로 처리
      throw DcException.postNotFoundOrDeleted({ message: combined })
    }
  }

  /**
   * 커스텀 팝업 대기
   */
  protected async waitForCustomPopup(page: Page): Promise<{ isCustomPopup: true; message: string } | null> {
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

  /**
   * 갤러리 접근 제한 안내 팝업 처리
   * 마이너 갤러리 접근 시 나타나는 팝업을 자동으로 확인 버튼 클릭
   */
  protected async handleGalleryAccessPopup(page: Page): Promise<void> {
    try {
      // 팝업이 나타날 때까지 최대 3초 대기
      const popupContainerSelector = '.layer-popup-inner.notx'
      await page.waitForSelector(popupContainerSelector, { timeout: 3000 })

      this.logger.log('갤러리 접근 제한 안내 팝업 감지됨')

      // 팝업 내용 확인 (선택적)
      const popupContent = await page.evaluate(selector => {
        const popup = document.querySelector(selector)
        if (popup) {
          const title = popup.querySelector('.pop-inbox-tit')?.textContent?.trim()
          return title || ''
        }
        return ''
      }, popupContainerSelector)

      if (popupContent) {
        this.logger.log(`팝업 내용: ${popupContent}`)
      }

      // 확인 버튼 클릭
      const confirmButtonSelector = `${popupContainerSelector} button.btn-line.btn-line-inblue`
      await page.waitForSelector(confirmButtonSelector, { timeout: 2000 })
      await page.click(confirmButtonSelector)

      this.logger.log('갤러리 접근 제한 안내 팝업 확인 버튼 클릭 완료')

      // 팝업이 사라질 때까지 대기
      await sleep(1000)
    } catch (error) {
      // 팝업이 나타나지 않거나 이미 사라진 경우 (정상 상황)
      // 에러를 무시하고 계속 진행
      this.logger.log('갤러리 접근 제한 팝업 없음 또는 이미 처리됨')
    }
  }

  /**
   * 테더링 모드 처리
   */
  public async handleTetheringMode(jobId: string, settings: Settings): Promise<void> {
    await this.checkPermission(Permission.TETHERING)

    // IP 변경이 필요한지 확인
    const shouldChange = this.tetheringService.shouldChangeIp(settings?.tethering?.changeInterval)

    if (shouldChange) {
      try {
        const prev = this.tetheringService.getCurrentIp()
        await this.jobLogsService.createJobLog(jobId, `테더링 전 현재 IP: ${prev.ip || '조회 실패'}`)
        const changed = await this.tetheringService.checkIpChanged(prev)
        await this.jobLogsService.createJobLog(jobId, `테더링으로 IP 변경됨: ${prev.ip} → ${changed.ip}`)
      } catch (e: any) {
        await this.jobLogsService.createJobLog(jobId, `테더링 IP 변경 실패: ${e?.message || e}`)
        throw DcException.postSubmitFailed({ message: '테더링 IP 변경 실패' })
      }
    } else {
      await this.jobLogsService.createJobLog(jobId, `테더링 IP 변경 주기에 따라 변경하지 않음`)
    }
  }

  /**
   * 프록시 모드 처리
   */
  public async handleProxyMode(
    jobId: string,
    settings: Settings,
    browserId: string,
  ): Promise<{ browser: any; context: BrowserContext; page: Page; proxyInfo: any }> {
    const { browser, context, page, proxyInfo } = await this.launch({
      browserId,
      headless: !settings.showBrowserWindow,
      reuseExisting: settings.reuseWindowBetweenTasks,
      respectProxy: true,
    })

    // 프록시 정보 로깅
    if (proxyInfo) {
      const proxyStr = proxyInfo.id
        ? `${proxyInfo.id}@${proxyInfo.ip}:${proxyInfo.port}`
        : `${proxyInfo.ip}:${proxyInfo.port}`
      await this.jobLogsService.createJobLog(jobId, `프록시 적용: ${proxyStr}`)
    } else {
      await this.jobLogsService.createJobLog(jobId, '프록시 미적용')
    }

    // 실제 외부 IP 로깅
    await this.logExternalIp(jobId, page)

    return { browser, context, page, proxyInfo }
  }

  /**
   * 브라우저 재사용 모드 처리
   */
  public async handleBrowserReuseMode(
    jobId: string,
    settings: Settings,
    browserId: string,
  ): Promise<{ context: BrowserContext; page: Page }> {
    const { context, page } = await this.launch({
      browserId,
      headless: !settings.showBrowserWindow,
      reuseExisting: true,
      respectProxy: false,
    })

    // 실제 외부 IP 로깅
    await this.logExternalIp(jobId, page)

    return { context, page }
  }

  /**
   * 브라우저 신규 생성 모드 처리
   */
  public async handleBrowserNewMode(
    jobId: string,
    settings: Settings,
    browserId: string,
  ): Promise<{ context: BrowserContext; page: Page }> {
    const { context, page } = await this.launch({
      browserId,
      headless: !settings.showBrowserWindow,
      reuseExisting: false,
      respectProxy: false,
    })

    // 실제 외부 IP 로깅
    await this.logExternalIp(jobId, page)

    return { context, page }
  }

  /**
   * 외부 IP 로깅
   */
  public async logExternalIp(jobId: string, target: Page): Promise<void> {
    try {
      const externalIp = await getExternalIp(target)
      await this.jobLogsService.createJobLog(jobId, `실제 외부 IP: ${externalIp}`)
    } catch (e) {
      await this.jobLogsService.createJobLog(jobId, `외부 IP 조회 실패: ${e instanceof Error ? e.message : e}`)
    }
  }

  /**
   * 작업 간 딜레이 적용
   */
  public async applyTaskDelay(jobId: string, settings: Settings): Promise<void> {
    if (settings?.taskDelay > 0) {
      await this.jobLogsService.createJobLog(jobId, `작업 간 딜레이: ${settings.taskDelay}초`)
      await sleep(settings.taskDelay * 1000)
    }
  }

  /**
   * PC URL을 모바일 URL로 변환
   * PC: dcinside.com (gall.dcinside.com 등)
   * Mobile: m.dcinside.com
   */
  protected _convertPcToMobileUrl(url: string): string {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname

    // 이미 모바일 URL이면 그대로 반환
    if (hostname === 'm.dcinside.com') {
      return url
    }

    // PC URL 체크 (dcinside.com을 포함하지만 m.dcinside.com은 아닌 경우)
    if (!hostname.includes('dcinside.com')) {
      return url
    }

    // URL에서 갤러리 ID 추출
    const idParam = urlObj.searchParams.get('id')
    if (!idParam) {
      throw new Error('갤러리 ID를 찾을 수 없습니다.')
    }

    // 갤러리 타입 판별 및 모바일 URL 생성
    const pathname = urlObj.pathname

    if (pathname.includes('/mgallery/')) {
      // 마이너 갤러리
      return `https://m.dcinside.com/board/${idParam}`
    } else if (pathname.includes('/mini/')) {
      // 미니 갤러리
      return `https://m.dcinside.com/mini/${idParam}`
    } else if (pathname.includes('/person/')) {
      // 인물 갤러리
      return `https://m.dcinside.com/person/${idParam}`
    } else {
      // 일반 갤러리
      return `https://m.dcinside.com/board/${idParam}`
    }
  }

  /**
   * 갤러리 정보 추출 (PC/모바일 URL 모두 지원)
   */
  protected _extractGalleryInfo(url: string): GalleryInfo {
    // PC URL을 모바일 URL로 변환
    const mobileUrl = this._convertPcToMobileUrl(url)

    let id: string
    let postNo: string | undefined

    // 모바일 URL 패턴별 처리 (경로 기반)
    if (mobileUrl.includes('/board/')) {
      // 일반 갤러리: /board/galleryId/postNo
      const boardMatch = mobileUrl.match(/\/board\/([^/]+)\/([^/?]+)/)
      if (boardMatch) {
        id = boardMatch[1]
        postNo = boardMatch[2] // 마지막 슬러그
      } else {
        // 게시물 번호가 없는 경우 (갤러리 목록)
        const galleryMatch = mobileUrl.match(/\/board\/([^/?]+)/)
        if (galleryMatch) {
          id = galleryMatch[1]
          postNo = undefined
        } else {
          throw DcException.postNotFoundOrDeleted({
            message: '갤러리 URL 형식이 올바르지 않습니다.',
          })
        }
      }
    } else if (mobileUrl.includes('/mini/')) {
      // 미니 갤러리: /mini/galleryId/postNo
      const miniMatch = mobileUrl.match(/\/mini\/([^/]+)\/([^/?]+)/)
      if (miniMatch) {
        id = miniMatch[1]
        postNo = miniMatch[2] // 마지막 슬러그
      } else {
        // 갤러리 목록
        const galleryMatch = mobileUrl.match(/\/mini\/([^/?]+)/)
        if (galleryMatch) {
          id = galleryMatch[1]
          postNo = undefined
        } else {
          throw DcException.postNotFoundOrDeleted({
            message: '미니 갤러리 URL 형식이 올바르지 않습니다.',
          })
        }
      }
    } else if (mobileUrl.includes('/person/')) {
      // 인물 갤러리: /person/galleryId/postNo
      const personMatch = mobileUrl.match(/\/person\/([^/]+)\/([^/?]+)/)
      if (personMatch) {
        id = personMatch[1]
        postNo = personMatch[2] // 마지막 슬러그
      } else {
        // 갤러리 목록
        const galleryMatch = mobileUrl.match(/\/person\/([^/?]+)/)
        if (galleryMatch) {
          id = galleryMatch[1]
          postNo = undefined
        } else {
          throw DcException.postNotFoundOrDeleted({
            message: '인물 갤러리 URL 형식이 올바르지 않습니다.',
          })
        }
      }
    } else {
      // 기타 URL 형식
      throw DcException.postNotFoundOrDeleted({
        message: '지원하지 않는 URL 형식입니다.',
      })
    }

    // 갤러리 타입 판별
    let type: GalleryType
    if (mobileUrl.includes('/mgallery/')) {
      type = 'mgallery'
    } else if (mobileUrl.includes('/mini/')) {
      type = 'mini'
    } else if (mobileUrl.includes('/person/')) {
      type = 'person'
    } else {
      type = 'board' // 일반갤러리
    }

    this.logger.log(`갤러리 정보 추출: ID=${id}, Type=${type}, PostNo=${postNo || 'N/A'}`)
    return { id, type, postNo }
  }

  /**
   * 권한 확인
   */
  private async checkPermission(permission: Permission): Promise<void> {
    const settings = await this.settingsService.getSettings()
    const licenseCache = settings.licenseCache
    assertPermission(licenseCache, permission)
  }
}
