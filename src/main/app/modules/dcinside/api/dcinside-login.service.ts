import { CookieService } from '@main/app/modules/util/cookie.service'
import { sleep } from '@main/app/utils/sleep'
import { Injectable, Logger } from '@nestjs/common'
import { Page } from 'puppeteer-core'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(StealthPlugin())

@Injectable()
export class DcinsideLoginService {
  private readonly logger = new Logger(DcinsideLoginService.name)

  constructor(private readonly cookieService: CookieService) {}

  async login(id: string, password: string, headless: boolean = true): Promise<{ success: boolean, message: string }> {
    let browser = null
    try {
      browser = await puppeteer.launch({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ko-KR,ko'],
      })
      const page: Page = await browser.newPage()
      await page.setExtraHTTPHeaders({ 'accept-language': 'ko-KR,ko;q=0.9' })

      await page.goto('https://dcinside.com/', { waitUntil: 'networkidle2', timeout: 60000 })
      // 로그인 폼 입력 및 로그인 버튼 클릭 (구체적 셀렉터는 실제 DOM 확인 필요)
      await page.type('#user_id', id, { delay: 30 })
      await page.type('#pw', password, { delay: 30 })
      await page.click('#login_ok')
      await sleep(2000)

      // 로그인 체크
      const isLoggedIn = await this.isLogin(page)
      if (isLoggedIn) {
        // 쿠키 저장 (공통 쿠키 서비스 활용, browser.cookies 사용)
        const cookies = await browser.cookies()
        this.cookieService.saveCookies('dcinside', id, cookies)
        return { success: true, message: '로그인 성공' }
      }
      else {
        return { success: false, message: '로그인 실패' }
      }
    }
    catch (e) {
      this.logger.error(`로그인 실패: ${e.message}`)
      return { success: false, message: e.message }
    }
    finally {
      if (browser)
        await browser.close()
    }
  }

  async isLogin(page: Page): Promise<boolean> {
    try {
      await page.goto('https://dcinside.com/', { waitUntil: 'networkidle2', timeout: 60000 })
      await page.waitForSelector('#login_box', { timeout: 10000 })
      const userNameExists = await page.$eval('#login_box .user_name', el => !!el)
      return !!userNameExists
    }
    catch {
      return false
    }
  }
}
