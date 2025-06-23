import { Injectable, Logger } from '@nestjs/common'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import type { Browser, Page } from 'puppeteer-core'

puppeteer.use(StealthPlugin())

export interface BrowserLaunchOptions {
  headless?: boolean
  args?: string[]
}

@Injectable()
export class BrowserManagerService {
  private readonly logger = new Logger(BrowserManagerService.name)

  // 브라우저 실행 (세션 시작)
  async launchBrowser(options: BrowserLaunchOptions = {}): Promise<Browser> {
    const launchOptions: any = {
      headless: options.headless ?? true,
      args: options.args || ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ko-KR,ko'],
    }

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
    }

    const browser = await puppeteer.launch(launchOptions)
    this.logger.log('브라우저 세션 시작됨')
    return browser
  }

  // 새 페이지 생성
  async createPage(browser: Browser, headers?: Record<string, string>): Promise<Page> {
    const page = await browser.newPage()

    // 기본 헤더 설정
    const defaultHeaders = {
      'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      ...headers,
    }

    await page.setExtraHTTPHeaders(defaultHeaders)
    this.logger.log('새 페이지 생성됨')
    return page
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
}
