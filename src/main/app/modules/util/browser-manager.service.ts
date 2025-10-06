import { Injectable, Logger } from '@nestjs/common'
import { chromium, Browser, BrowserContext } from 'playwright'
import { ChromeNotInstalledError } from '@main/common/errors/chrome-not-installed.exception'

// 브라우저 ID별 브라우저 관리
interface ManagedBrowser {
  browserId: string
  browser: Browser
  context: BrowserContext
  headless: boolean // 브라우저 생성 시 사용된 headless 옵션
  proxyArgs?: string[] // 프록시 args
}

/**
 * 프록시 목록에서 랜덤으로 1개 선택
 */
export function getRandomProxy(
  proxies: { ip: string; port: number; id?: string; pw?: string }[],
): { ip: string; port: number; id?: string; pw?: string } | undefined {
  if (!proxies || proxies.length === 0) return undefined
  const idx = Math.floor(Math.random() * proxies.length)
  return proxies[idx]
}

/**
 * 프록시 변경 방식에 따라 프록시 선택
 */
export function getProxyByMethod(
  proxies: { ip: string; port: number; id?: string; pw?: string }[],
  method: 'random' | 'sequential' | 'fixed' = 'random',
  lastIndex = 0,
): { proxy: any; nextIndex: number } {
  if (!proxies || proxies.length === 0) return { proxy: undefined, nextIndex: 0 }
  if (method === 'random') {
    return { proxy: getRandomProxy(proxies), nextIndex: lastIndex }
  }
  if (method === 'sequential') {
    const idx = lastIndex % proxies.length
    return { proxy: proxies[idx], nextIndex: idx + 1 }
  }
  if (method === 'fixed') {
    return { proxy: proxies[0], nextIndex: lastIndex }
  }
  return { proxy: getRandomProxy(proxies), nextIndex: lastIndex }
}

@Injectable()
export class BrowserManagerService {
  private readonly logger = new Logger(BrowserManagerService.name)
  private managedBrowsers = new Map<string, ManagedBrowser>() // 브라우저 ID별 브라우저 관리

  // 브라우저 실행 (세션 시작)
  async launchBrowser(headless: boolean = true, proxyArgs?: string[]): Promise<Browser> {
    // Stealth 모드를 위한 기본 args
    const stealthArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--lang=ko-KR,ko',
      '--disable-blink-features=AutomationControlled', // 자동화 감지 비활성화
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--disable-gpu', // GPU 하드웨어 가속 비활성화
    ]

    // 프록시 args가 있으면 추가
    const allArgs = proxyArgs ? [...stealthArgs, ...proxyArgs] : stealthArgs

    const launchOptions: any = {
      headless,
      args: allArgs,
    }

    if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
      launchOptions.executablePath = process.env.PLAYWRIGHT_BROWSERS_PATH
    }

    try {
      const browser = await chromium.launch(launchOptions)
      this.logger.log(`브라우저 세션 시작됨 (Stealth 모드, headless: ${headless})`)
      return browser
    } catch (error) {
      // Playwright 브라우저 설치 관련 에러 처리
      if (error.message.includes("Executable doesn't exist")) {
        throw new ChromeNotInstalledError('크롬 브라우저가 설치되지 않았습니다. 크롬을 재설치 해주세요.')
      }
      throw error
    }
  }

  // 브라우저 ID로 브라우저 종료 (managedBrowsers Map에서도 제거)
  async closeManagedBrowser(browserId: string): Promise<void> {
    const managedBrowser = this.managedBrowsers.get(browserId)
    if (!managedBrowser) {
      this.logger.warn(`브라우저를 찾을 수 없습니다: ${browserId}`)
      return
    }

    try {
      await managedBrowser.browser.close()
      this.managedBrowsers.delete(browserId)
      this.logger.log(`브라우저 종료: ${browserId}`)
    } catch (error) {
      this.logger.warn(`브라우저 종료 중 오류: ${error.message}`)
      // 오류가 발생해도 Map에서 제거
      this.managedBrowsers.delete(browserId)
    }
  }

  // 브라우저 ID별 브라우저 가져오기 또는 생성
  async getOrCreateBrowser(browserId: string, headless: boolean = true, proxyArgs?: string[]): Promise<Browser> {
    let managedBrowser = this.managedBrowsers.get(browserId)

    // 브라우저가 존재하는 경우
    if (managedBrowser) {
      try {
        // 브라우저가 실제로 연결되어 있는지 확인
        managedBrowser.browser.version()

        // headless 모드 또는 프록시 args가 변경되었는지 확인
        const proxyChanged = JSON.stringify(managedBrowser.proxyArgs) !== JSON.stringify(proxyArgs)
        if (managedBrowser.headless !== headless || proxyChanged) {
          this.logger.log(
            `브라우저 옵션 변경 감지: ${browserId} (headless: ${managedBrowser.headless} → ${headless}, proxy 변경: ${proxyChanged}), 기존 브라우저 종료 후 새로 생성합니다`,
          )
          await this.closeManagedBrowser(browserId)
          managedBrowser = null
        }
      } catch (error) {
        // 브라우저가 연결되지 않은 경우 Map에서 제거
        this.logger.log(`브라우저 연결 끊어짐 감지: ${browserId}, 새로 생성합니다`)
        await this.closeManagedBrowser(browserId)
        managedBrowser = null
      }
    }

    if (!managedBrowser) {
      // 새 브라우저 생성
      const browser = await this.launchBrowser(headless, proxyArgs)
      const context = await browser.newContext()

      managedBrowser = {
        browserId,
        browser,
        context,
        headless, // headless 옵션 저장
        proxyArgs, // 프록시 args 저장
      }

      this.managedBrowsers.set(browserId, managedBrowser)
      this.logger.log(`브라우저 생성: ${browserId}`)
    }

    return managedBrowser.browser
  }
}
