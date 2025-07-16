import { Injectable, Logger } from '@nestjs/common'
import { chromium, Browser, BrowserContext, Page } from 'playwright'

export interface BrowserLaunchOptions {
  headless?: boolean
  args?: string[]
}

// 브라우저 ID별 브라우저 관리
interface ManagedBrowser {
  browserId: string
  browser: Browser
  context: BrowserContext
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
  async launchBrowser(options: BrowserLaunchOptions = {}): Promise<Browser> {
    const launchOptions: any = {
      headless: options.headless ?? true,
      args: options.args || ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ko-KR,ko'],
    }

    if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
      launchOptions.executablePath = process.env.PLAYWRIGHT_BROWSERS_PATH
    }

    const browser = await chromium.launch(launchOptions)
    this.logger.log('브라우저 세션 시작됨')
    return browser
  }

  // 새 페이지 생성
  async createPage(browser: Browser, headers?: Record<string, string>): Promise<Page> {
    const context = await browser.newContext({
      extraHTTPHeaders: {
        'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        ...headers,
      },
    })

    const page = await context.newPage()
    this.logger.log('새 페이지 생성됨')
    return page
  }

  // 기존 페이지 재사용 또는 새 페이지 생성
  async getOrCreatePage(browser: Browser, headers?: Record<string, string>): Promise<Page> {
    const contexts = browser.contexts()

    if (contexts.length > 0) {
      const pages = contexts[0].pages()
      if (pages.length > 0) {
        const page = pages[0]
        this.logger.log('기존 페이지 재사용')
        return page
      }
    }

    // 페이지가 없으면 새로 생성 (헤더 설정 포함)
    this.logger.log('기존 페이지가 없어 새 페이지 생성')
    return this.createPage(browser, headers)
  }

  // 브라우저 종료 (세션 종료)
  async closeBrowser(browser: Browser): Promise<void> {
    if (browser) {
      try {
        await browser.close()
        this.logger.log('브라우저 세션 종료됨')
      } catch (error) {
        this.logger.warn(`브라우저 종료 중 오류: ${error.message}`)
      }
    }
  }

  // 페이지 닫기
  async closePage(page: Page): Promise<void> {
    if (page && !page.isClosed()) {
      try {
        await page.close()
        this.logger.log('페이지 종료됨')
      } catch (error) {
        this.logger.warn(`페이지 종료 중 오류: ${error.message}`)
      }
    }
  }

  // 브라우저 ID별 브라우저 가져오기 또는 생성
  async getOrCreateBrowser(browserId: string, options: BrowserLaunchOptions = {}): Promise<Browser> {
    let managedBrowser = this.managedBrowsers.get(browserId)

    if (!managedBrowser) {
      // 새 브라우저 생성
      const browser = await this.launchBrowser(options)
      const context = await browser.newContext()

      managedBrowser = {
        browserId,
        browser,
        context,
      }

      this.managedBrowsers.set(browserId, managedBrowser)
      this.logger.log(`브라우저 생성: ${browserId}`)
    }

    return managedBrowser.browser
  }

  // 특정 브라우저 종료
  async closeManagedBrowser(browserId: string): Promise<void> {
    const managedBrowser = this.managedBrowsers.get(browserId)
    if (!managedBrowser) return

    await this.closeBrowser(managedBrowser.browser)
    this.managedBrowsers.delete(browserId)
    this.logger.log(`브라우저 종료: ${browserId}`)
  }

  // 모든 관리 브라우저 정리
  async closeAllManagedBrowsers(): Promise<void> {
    this.logger.log('모든 관리 브라우저 정리 시작')

    for (const [browserId, managedBrowser] of this.managedBrowsers.entries()) {
      await this.closeBrowser(managedBrowser.browser)
      this.logger.log(`브라우저 강제 종료: ${browserId}`)
    }

    this.managedBrowsers.clear()
    this.logger.log('모든 관리 브라우저 정리 완료')
  }

  // 브라우저 존재 여부 확인
  hasManagedBrowser(browserId: string): boolean {
    return this.managedBrowsers.has(browserId)
  }

  // 현재 활성 브라우저 ID 목록 조회
  getActiveBrowserIds(): string[] {
    return Array.from(this.managedBrowsers.keys())
  }

  // 쿠키 설정 메서드 (browser.cookies()를 대체)
  async setCookies(browser: Browser, cookies: any[]): Promise<void> {
    const contexts = browser.contexts()
    if (contexts.length > 0) {
      await contexts[0].addCookies(cookies)
    }
  }

  // 쿠키 가져오기 메서드 (browser.cookies()를 대체)
  async getCookies(browser: Browser): Promise<any[]> {
    const contexts = browser.contexts()
    if (contexts.length > 0) {
      return await contexts[0].cookies()
    }
    return []
  }
}
