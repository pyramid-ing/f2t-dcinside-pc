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
import { JobContextService } from '@main/app/modules/common/job-context/job-context.service'
import { assertPermission } from '@main/app/utils/permission.assert'

export enum GalleryType {
  BOARD = 'board',
  MGALLERY = 'mgallery',
  MINI = 'mini',
  PERSON = 'person',
}

export enum GalleryViewMode {
  MOBILE = 'mobile',
  PC = 'pc',
}

export enum GalleryViewKind {
  LIST = 'list',
  DETAIL = 'detail',
}

export interface GalleryInfo {
  id: string
  type: GalleryType
  postNo?: string
  viewMode: GalleryViewMode
  viewKind: GalleryViewKind
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
  protected readonly jobContext: JobContextService

  constructor(
    protected readonly settingsService: SettingsService,
    protected readonly cookieService: CookieService,
    protected readonly twoCaptchaService: TwoCaptchaService,
    protected readonly dcCaptchaSolverService: DcCaptchaSolverService,
    protected readonly browserManagerService: BrowserManagerService,
    protected readonly tetheringService: TetheringService,
    protected readonly jobLogsService: JobLogsService,
    jobContext: JobContextService,
  ) {
    this.logger = new Logger(this.constructor.name)
    this.jobContext = jobContext
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
    const settings = await this.settingsService.getSettings()
    const headless = options?.headless ?? !settings.showBrowserWindow
    const respectProxy = options?.respectProxy ?? true
    const reuseExisting = options?.reuseExisting ?? false

    const canUseProxy =
      respectProxy &&
      settings?.ipMode === IpMode.PROXY &&
      Array.isArray(settings?.proxies) &&
      settings.proxies.length > 0

    let proxyArg: string | undefined
    let proxyAuth: { server: string; username?: string; password?: string } | undefined
    let proxyInfo: { ip: string; port: number; id?: string; pw?: string } | null = null

    if (canUseProxy) {
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
      }
    }

    const launchOptions: { headless: boolean; args?: string[] } = {
      headless,
    }
    if (proxyArg) {
      launchOptions.args = [proxyArg]
    }

    try {
      const browser = await this.browserManagerService.getOrCreateBrowser(options?.browserId, launchOptions)

      // 기존 컨텍스트/페이지가 있고 재사용 옵션이 켜져 있으면 그대로 사용
      if (reuseExisting) {
        const contexts = browser.contexts()
        let existingContext: BrowserContext | null = null
        let existingPage: Page | null = null

        for (const ctx of contexts) {
          const pages = ctx.pages()
          if (pages.length > 0) {
            existingContext = ctx
            existingPage = pages[0]
            break
          }
        }

        if (existingContext && existingPage) {
          return { browser, context: existingContext, page: existingPage, proxyInfo }
        }
      }

      // 없으면 새 컨텍스트/페이지 생성 (공통 설정 적용)
      const { context, page } = await this.createContextAndPage(browser, proxyAuth ? { proxyAuth } : undefined)

      return { browser, context, page, proxyInfo }
    } catch (error: any) {
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
  public async createContextAndPage(
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
      await page.goto('https://msign.dcinside.com/login', {
        waitUntil: 'load',
        timeout: 60_000,
      })

      await page.fill('#code', params.id)
      await page.fill('#password', params.password)

      await page.click('#loginAction')

      const popupHandled = await this.handlePasswordChangeCampaignPopup(page)

      if (!popupHandled) {
        await page.waitForURL(url => url.hostname === 'm.dcinside.com', { timeout: 60_000 }).catch(() => null)
      }

      if (!page.url().startsWith('https://m.dcinside.com')) {
        await page.goto('https://m.dcinside.com/', { waitUntil: 'load', timeout: 60_000 }).catch(() => null)
      }

      // 로그인 후 메인 페이지로 이동하여 상태 확인
      const isLoggedIn = await this.isLogin(page)
      if (isLoggedIn) {
        const context = page.context()
        const cookies = await context.cookies()
        this.cookieService.saveCookies('dcinside', params.id, cookies)
        return { success: true, message: '로그인 성공' }
      }

      return { success: false, message: '로그인 실패' }
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
      const currentUrl = page.url()

      if (!currentUrl.startsWith('https://m.dcinside.com')) {
        await page.goto('https://m.dcinside.com/', { waitUntil: 'load', timeout: 60_000 })
      } else {
        await page.waitForLoadState('load', { timeout: 10_000 })
      }

      await page.waitForSelector('.header-top', { timeout: 10_000 })

      const userMenu = await page.$('.header-top .sign.on')
      if (userMenu) {
        return true
      }

      const logoutLink = await page.$('.header-top a[href*="logout"]')
      if (logoutLink) {
        return true
      }

      return false
    } catch {
      return false
    }
  }

  private async handlePasswordChangeCampaignPopup(page: Page): Promise<boolean> {
    try {
      const popup = page.locator('.pwch_cpiwrap')
      await popup.waitFor({ state: 'visible', timeout: 5_000 })

      const laterButton = popup.locator('a.btn-line-login').filter({ hasText: /다음에 변경/ })
      if ((await laterButton.count()) > 0) {
        await Promise.all([
          page.waitForURL(url => url.hostname === 'm.dcinside.com', { timeout: 60_000 }).catch(() => null),
          laterButton.first().click(),
        ])
        await sleep(1_000)
        return true
      }
    } catch {
      // 팝업이 없는 경우 무시
    }

    return false
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
    refreshSelector: string,
  ): Promise<void> {
    const captchaImg = page.locator(captchaImgSelector)
    const captchaCount = await captchaImg.count()

    if (captchaCount > 0) {
      this.logger.log('DC 캡챠 감지됨, 해결 시작')

      // 캡챠 활성 여부 확인
      const settings = await this.settingsService.getSettings()
      if (settings.dcCaptchaEnabled === false) {
        throw DcException.captchaDisabled({
          message: '디시인사이드 캡챠가 비활성화되어 있어 사용할 수 없습니다.',
        })
      }

      // 캡챠 새로고침 버튼 클릭 (있는 경우)
      if (refreshSelector) {
        const refreshButton = page.locator(refreshSelector)
        if ((await refreshButton.count()) > 0) {
          this.logger.log('캡챠 새로고침 버튼 클릭')
          await refreshButton.click()
          await sleep(1000) // 새로고침 후 잠시 대기
        }
      }

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
      const deletionPatterns = ['게시물 작성자가 삭제했거나 존재하지 않는 페이지입니다']

      const redirectHints = ['잠시 후 갤러리 리스트로 이동됩니다']

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
  public async handleTetheringMode(settings: Settings): Promise<void> {
    await this._checkPermission(Permission.TETHERING)

    // 와이파이 자동 연결 확인 및 처리
    if (settings?.tethering?.wifi?.enabled && settings?.tethering?.wifi?.ssid && settings?.tethering?.wifi?.password) {
      await this._handleWifiConnection(settings.tethering.wifi)
    }

    // IP 변경이 필요한지 확인
    const shouldChange = this.tetheringService.shouldChangeIp(settings?.tethering?.changeInterval)

    if (shouldChange) {
      try {
        const prev = this.tetheringService.getCurrentIp()
        await this.jobLogsService.createJobLog(`테더링 전 현재 IP: ${prev.ip || '조회 실패'}`)
        const changed = await this.tetheringService.checkIpChanged(prev)
        await this.jobLogsService.createJobLog(`테더링으로 IP 변경됨: ${prev.ip} → ${changed.ip}`)
      } catch (e: any) {
        await this.jobLogsService.createJobLog(`테더링 IP 변경 실패: ${e?.message || e}`)
        throw DcException.postSubmitFailed({ message: '테더링 IP 변경 실패' })
      }
    } else {
      await this.jobLogsService.createJobLog(`테더링 IP 변경 주기에 따라 변경하지 않음`)
    }
  }

  /**
   * 와이파이 연결 처리
   */
  private async _handleWifiConnection(wifiConfig: { ssid: string; password: string }): Promise<void> {
    await this.jobLogsService.createJobLog(`와이파이 연결 확인 시작: ${wifiConfig.ssid}`)

    // 현재 연결된 와이파이 SSID 확인
    const currentSsid = this.tetheringService.getCurrentWifiSsid()

    if (currentSsid.success && currentSsid.ssid === wifiConfig.ssid) {
      await this.jobLogsService.createJobLog(`이미 ${wifiConfig.ssid}에 연결되어 있습니다.`)
      return
    }

    // 설정된 와이파이와 다르면 연결 시도
    if (currentSsid.success && currentSsid.ssid !== wifiConfig.ssid) {
      await this.jobLogsService.createJobLog(`현재 연결: ${currentSsid.ssid}, 목표: ${wifiConfig.ssid}`)
    }

    // 와이파이 연결 시도
    const result = await this.tetheringService.connectToWifi(wifiConfig.ssid, wifiConfig.password)

    if (result.success) {
      await this.jobLogsService.createJobLog(`와이파이 연결 성공: ${result.message}`)
    } else {
      await this.jobLogsService.createJobLog(`와이파이 연결 실패: ${result.message}`)
      // 실패해도 경고만 하고 계속 진행 (기존 동작 유지)
      this.logger.warn(`와이파이 연결 실패: ${result.message}`)
    }
  }

  /**
   * 프록시 모드 처리
   */
  public async handleProxyMode(
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
      await this.jobLogsService.createJobLog(`프록시 적용: ${proxyStr}`)
    } else {
      await this.jobLogsService.createJobLog('프록시 미적용')
    }

    // 실제 외부 IP 로깅
    await this.logExternalIp(page)

    return { browser, context, page, proxyInfo }
  }

  /**
   * 브라우저 재사용 모드 처리
   */
  public async handleBrowserReuseMode(
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
    await this.logExternalIp(page)

    return { context, page }
  }

  /**
   * 브라우저 신규 생성 모드 처리
   */
  public async handleBrowserNewMode(
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
    await this.logExternalIp(page)

    return { context, page }
  }

  /**
   * 외부 IP 로깅
   */
  public async logExternalIp(target: Page): Promise<void> {
    try {
      const externalIp = await getExternalIp(target)
      await this.jobLogsService.createJobLog(`실제 외부 IP: ${externalIp}`)
    } catch (e) {
      await this.jobLogsService.createJobLog(`외부 IP 조회 실패: ${e instanceof Error ? e.message : e}`)
    }
  }

  /**
   * 작업 간 딜레이 적용
   */
  public async applyTaskDelay(taskDelaySeconds: number): Promise<void> {
    if (taskDelaySeconds > 0) {
      await this.jobLogsService.createJobLog(`작업 간 딜레이: ${taskDelaySeconds}초`)
      await sleep(taskDelaySeconds * 1000)
    }
  }

  /**
   * 갤러리 정보 추출 (PC/모바일 URL 모두 지원)
   */
  protected _extractGalleryInfo(url: string): GalleryInfo {
    const urlObj = new URL(url)

    if (!urlObj.hostname.includes('dcinside.com')) {
      throw DcException.postNotFoundOrDeleted({
        message: '디시인사이드 URL이 아닙니다.',
      })
    }

    const isMobile = urlObj.hostname === 'm.dcinside.com'

    const { type, id, postNo, viewKind } = isMobile
      ? this._parseMobileGalleryUrl(urlObj)
      : this._parsePcGalleryUrl(urlObj)

    const result: GalleryInfo = {
      id,
      type,
      postNo,
      viewMode: isMobile ? GalleryViewMode.MOBILE : GalleryViewMode.PC,
      viewKind,
    }

    this.logger.log(
      `갤러리 정보 추출: ID=${result.id}, Type=${result.type}, PostNo=${result.postNo || 'N/A'}, ViewMode=${result.viewMode}, ViewKind=${result.viewKind}`,
    )

    return result
  }

  protected _buildGalleryListUrl(info: GalleryInfo): string {
    return info.viewMode === GalleryViewMode.PC
      ? this._buildPcGalleryListUrl(info.type, info.id)
      : this._buildMobileGalleryListUrl(info.type, info.id)
  }

  private _parsePcGalleryUrl(urlObj: URL): {
    type: GalleryType
    id: string
    postNo?: string
    viewKind: GalleryViewKind
  } {
    const pathSegments = urlObj.pathname.split('/').filter(Boolean)

    if (pathSegments.length === 0) {
      throw DcException.postNotFoundOrDeleted({ message: '갤러리 경로를 분석할 수 없습니다.' })
    }

    const { type, action } = this._detectPcGalleryTypeAndAction(pathSegments)
    const id = urlObj.searchParams.get('id')?.trim()
    const postNo = this._normalizePostNo(
      urlObj.searchParams.get('no') || urlObj.searchParams.get('post_no') || undefined,
    )

    if (!id) {
      throw DcException.postNotFoundOrDeleted({ message: '갤러리 ID를 찾을 수 없습니다.' })
    }

    if (action === GalleryViewKind.DETAIL && !postNo) {
      throw DcException.postNotFoundOrDeleted({ message: '게시글 번호를 찾을 수 없습니다.' })
    }

    return { type, id, postNo, viewKind: action }
  }

  private _parseMobileGalleryUrl(urlObj: URL): {
    type: GalleryType
    id: string
    postNo?: string
    viewKind: GalleryViewKind
  } {
    const pathSegments = urlObj.pathname.split('/').filter(Boolean)

    if (pathSegments.length === 0 && urlObj.searchParams.get('id')) {
      // lists/?id= 형태 지원
      const typeFromQuery = this._parseGalleryType(urlObj.searchParams.get('type')) ?? GalleryType.BOARD
      const idFromQuery = urlObj.searchParams.get('id')!
      const postNoFromQuery = this._normalizePostNo(
        urlObj.searchParams.get('no') || urlObj.searchParams.get('post_no') || undefined,
      )
      return {
        type: typeFromQuery,
        id: idFromQuery,
        postNo: postNoFromQuery,
        viewKind: postNoFromQuery ? GalleryViewKind.DETAIL : GalleryViewKind.LIST,
      }
    }

    const [first, second, third] = pathSegments

    if (!first) {
      throw DcException.postNotFoundOrDeleted({ message: '갤러리 경로를 분석할 수 없습니다.' })
    }

    const type = this._detectGalleryTypeFromMobilePath(first, urlObj.searchParams.get('type'))
    const id = (second || urlObj.searchParams.get('id') || '').trim()
    const postNoCandidate = third || urlObj.searchParams.get('no') || urlObj.searchParams.get('post_no') || undefined
    const postNo = this._normalizePostNo(postNoCandidate)

    if (!id) {
      throw DcException.postNotFoundOrDeleted({ message: '갤러리 ID를 찾을 수 없습니다.' })
    }

    return { type, id, postNo, viewKind: postNo ? GalleryViewKind.DETAIL : GalleryViewKind.LIST }
  }

  private _detectPcGalleryTypeAndAction(segments: string[]): {
    type: GalleryType
    action: GalleryViewKind
  } {
    const [first, second, third] = segments

    let type: GalleryType
    let actionSegment: string | undefined

    switch (first) {
      case 'board':
        type = GalleryType.BOARD
        actionSegment = second
        break
      case 'mgallery':
        type = GalleryType.MGALLERY
        actionSegment = third ?? second
        break
      case 'mini':
        type = GalleryType.MINI
        actionSegment = third ?? second
        break
      case 'person':
        type = GalleryType.PERSON
        actionSegment = third ?? second
        break
      default:
        throw DcException.postNotFoundOrDeleted({ message: '지원하지 않는 갤러리 경로입니다.' })
    }

    if (actionSegment === 'lists') {
      return { type, action: GalleryViewKind.LIST }
    }

    if (actionSegment === 'view') {
      return { type, action: GalleryViewKind.DETAIL }
    }

    throw DcException.postNotFoundOrDeleted({ message: '갤러리 경로 형식이 올바르지 않습니다.' })
  }

  private _detectGalleryTypeFromMobilePath(firstSegment: string, typeHint: string | null): GalleryType {
    const parsedHint = this._parseGalleryType(typeHint)
    if (parsedHint) {
      return parsedHint
    }

    if (firstSegment === 'mini') return GalleryType.MINI
    if (firstSegment === 'person') return GalleryType.PERSON
    if (firstSegment === 'board') return GalleryType.BOARD

    // 모바일 경로에서 명확히 구분되지 않는 경우 기본 갤러리로 처리
    return GalleryType.BOARD
  }

  private _normalizePostNo(value?: string | null): string | undefined {
    const sanitized = value?.trim()
    if (!sanitized) return undefined

    return /^\d+$/.test(sanitized) ? sanitized : undefined
  }

  private _buildMobileGalleryUrl(type: GalleryType, id: string, postNo?: string): string {
    switch (type) {
      case GalleryType.MINI:
        return postNo ? `https://m.dcinside.com/mini/${id}/${postNo}` : `https://m.dcinside.com/mini/${id}`
      case GalleryType.PERSON:
        return postNo ? `https://m.dcinside.com/person/${id}/${postNo}` : `https://m.dcinside.com/person/${id}`
      case GalleryType.MGALLERY:
      case GalleryType.BOARD:
      default:
        return postNo ? `https://m.dcinside.com/board/${id}/${postNo}` : `https://m.dcinside.com/board/${id}`
    }
  }

  private _buildMobileGalleryListUrl(type: GalleryType, id: string): string {
    return this._buildMobileGalleryUrl(type, id)
  }

  private _buildPcGalleryListUrl(type: GalleryType, id: string): string {
    switch (type) {
      case GalleryType.MGALLERY:
        return `https://gall.dcinside.com/mgallery/board/lists/?id=${id}`
      case GalleryType.MINI:
        return `https://gall.dcinside.com/mini/board/lists/?id=${id}`
      case GalleryType.PERSON:
        return `https://gall.dcinside.com/person/board/lists/?id=${id}`
      case GalleryType.BOARD:
      default:
        return `https://gall.dcinside.com/board/lists/?id=${id}`
    }
  }

  private _parseGalleryType(value?: string | null): GalleryType | null {
    switch (value) {
      case GalleryType.BOARD:
        return GalleryType.BOARD
      case GalleryType.MGALLERY:
        return GalleryType.MGALLERY
      case GalleryType.MINI:
        return GalleryType.MINI
      case GalleryType.PERSON:
        return GalleryType.PERSON
      default:
        return null
    }
  }

  /**
   * 권한 확인
   */
  private async _checkPermission(permission: Permission): Promise<void> {
    const settings = await this.settingsService.getSettings()
    const licenseCache = settings.licenseCache
    assertPermission(licenseCache, permission)
  }
}
