import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Page } from 'puppeteer-core'
import puppeteerExtra from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { InstagramBrowserService } from './instagram-browser.service'

puppeteerExtra.use(StealthPlugin())

export interface BrowserOptions {
  headless?: boolean
  loginUsername?: string
}

@Injectable()
export class InstagramBaseService {
  protected readonly logger = new Logger(InstagramBaseService.name)

  constructor(
    protected readonly configService: ConfigService,
    protected readonly browserService: InstagramBrowserService,
  ) {}

  protected async checkLoginStatus(page: Page): Promise<boolean> {
    return await page.evaluate(() => {
      const elements = [
        ...document.querySelectorAll('[role="button"]'),
        ...document.querySelectorAll('[role="link"]'),
        ...document.querySelectorAll('[type="submit"]'),
        ...document.querySelectorAll('button div'),
        ...document.querySelectorAll('button'),
      ]
      return !elements.some((el) => {
        const text = el.textContent?.toLowerCase().trim() || ''
        return text === 'log in' || text === '로그인'
      })
    })
  }

  protected async ensureLogin(page: Page): Promise<void> {
    // instagram.com 홈이 아니면 먼저 이동
    if (!page.url().includes('instagram.com/')) {
      await page.goto('https://www.instagram.com')
    }
    const isLoggedIn = await this.checkLoginStatus(page)
    if (!isLoggedIn) {
      throw new Error('로그인이 필요합니다. 먼저 로그인을 진행해주세요.')
    }
  }
}
