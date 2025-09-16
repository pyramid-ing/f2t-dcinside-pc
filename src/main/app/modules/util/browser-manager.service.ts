import { Injectable, Logger } from '@nestjs/common'
import { chromium, Browser, BrowserContext } from 'playwright'
import { ChromeNotInstalledError } from '@main/common/errors/chrome-not-installed.exception'

export interface BrowserLaunchOptions {
  headless?: boolean
  args?: string[]
}

// 브라우저 ID별 브라우저 관리
interface ManagedBrowser {
  browserId: string
  browser: Browser
  context: BrowserContext
  options: BrowserLaunchOptions // 브라우저 생성 시 사용된 옵션 저장
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

    try {
      const browser = await chromium.launch(launchOptions)
      this.logger.log('브라우저 세션 시작됨')
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
  async getOrCreateBrowser(browserId: string, options: BrowserLaunchOptions = {}): Promise<Browser> {
    let managedBrowser = this.managedBrowsers.get(browserId)

    // 브라우저가 존재하는 경우
    if (managedBrowser) {
      try {
        // 브라우저가 실제로 연결되어 있는지 확인
        managedBrowser.browser.version()

        // 브라우저 옵션이 변경되었는지 확인 (특히 headless 모드)
        const currentOptions = managedBrowser.options
        const newOptions = this.normalizeOptions(options)

        if (this.hasOptionsChanged(currentOptions, newOptions)) {
          this.logger.log(`브라우저 옵션 변경 감지: ${browserId}, 기존 브라우저 종료 후 새로 생성합니다`)
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
      const normalizedOptions = this.normalizeOptions(options)
      const browser = await this.launchBrowser(normalizedOptions)
      const context = await browser.newContext()

      managedBrowser = {
        browserId,
        browser,
        context,
        options: normalizedOptions, // 옵션 저장
      }

      this.managedBrowsers.set(browserId, managedBrowser)
      this.logger.log(`브라우저 생성: ${browserId}`)
    }

    return managedBrowser.browser
  }

  // 브라우저 옵션 정규화 (기본값 적용)
  private normalizeOptions(options: BrowserLaunchOptions): BrowserLaunchOptions {
    return {
      headless: options.headless ?? true,
      args: options.args || ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ko-KR,ko'],
    }
  }

  // 옵션 변경 여부 확인
  private hasOptionsChanged(current: BrowserLaunchOptions, newOptions: BrowserLaunchOptions): boolean {
    // headless 모드 변경 확인
    if (current.headless !== newOptions.headless) {
      return true
    }

    // args 변경 확인 (간단한 비교)
    const currentArgs = current.args?.sort().join(',') || ''
    const newArgs = newOptions.args?.sort().join(',') || ''

    return currentArgs !== newArgs
  }
}
