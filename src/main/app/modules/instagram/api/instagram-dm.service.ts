import { InstagramBaseService } from './instagram-base.service'
import { InstagramActionResponse } from './interfaces/instagram.interface'
import { humanClick, humanType } from '../../../utils/human-actions'
import { sleep } from '../../../utils/sleep'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Page } from 'puppeteer-core'
import { InstagramBrowserService } from './instagram-browser.service'

// DM 파라미터 타입 정의
export interface SendDmParams {
  username: string
  message: string
  loginUsername?: string
  headless?: boolean
}

@Injectable()
export class InstagramDmService extends InstagramBaseService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly browserService: InstagramBrowserService,
  ) {
    super(configService, browserService)
  }

  async sendDm(params: SendDmParams, page?: Page): Promise<InstagramActionResponse> {
    const { username, message, loginUsername } = params
    let localPage = page
    if (!localPage) {
      localPage = await this.browserService.getPage()
    }
    try {
      await this.ensureLogin(localPage)
      await this.browserService.gotoIfChanged(localPage, `https://www.instagram.com/${username}`)
      await localPage.waitForSelector('header div[role="button"]')
      await sleep(2000)
      const msgBtnHandle = await localPage.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('header div[role="button"]'))
        return (
          buttons.find((btn) => {
            const text = btn.textContent?.trim()
            return text === '메시지 보내기' || text === 'Message'
          }) || null
        )
      })
      if (!msgBtnHandle)
        throw new Error('메시지 보내기 버튼을 찾을 수 없습니다.')
      await humanClick(localPage, msgBtnHandle)
      await page.waitForNavigation({ waitUntil: 'networkidle2' })
      await sleep(2000)
      await localPage.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"]')
        if (dialog) {
          const buttons = Array.from(dialog.querySelectorAll('button'))
          for (const btn of buttons) {
            const text = btn.textContent?.trim()
            if (text === '나중에 하기' || text.toLowerCase() === 'not now') {
              ;(btn as HTMLElement).click()
              break
            }
          }
        }
      })
      await localPage.waitForSelector('[contenteditable="true"]')
      await sleep(1000)
      await humanClick(localPage, '[contenteditable="true"]')
      await sleep(500)
      await humanType(localPage, '[contenteditable="true"]', message)
      await sleep(500)
      await localPage.keyboard.press('Enter')
      await sleep(2000)
      return { success: true }
    }
    catch (error) {
      this.logger.error(`DM 전송 실패 (${username}): ${error.message}`)
      return { success: false, error: error.message }
    }
    finally {
      if (!page && localPage)
        await localPage.close()
    }
  }
}
