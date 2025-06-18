import { InstagramBaseService } from './instagram-base.service'
import { InstagramActionResponse } from './interfaces/instagram.interface'
import { humanClick } from '../../../utils/human-actions'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Page } from 'puppeteer-core'
import { InstagramBrowserService } from './instagram-browser.service'

// 좋아요 관련 파라미터 타입 정의
export interface LikeParams {
  postId: string
  loginUsername?: string
  headless?: boolean
}

@Injectable()
export class InstagramLikeService extends InstagramBaseService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly browserService: InstagramBrowserService,
  ) {
    super(configService, browserService)
  }

  async likePost(params: LikeParams, page?: Page): Promise<InstagramActionResponse> {
    const { postId, loginUsername } = params
    let localPage = page
    if (!localPage) {
      localPage = await this.browserService.getPage()
    }
    try {
      await this.ensureLogin(localPage)
      await this.browserService.gotoIfChanged(localPage, `https://www.instagram.com/p/${postId}/`)
      await localPage.waitForSelector('article')
      const likeButton = await localPage.$('article section button[aria-label="좋아요"]')
      if (!likeButton) {
        return { success: false, error: '이미 좋아요를 눌렀거나 좋아요를 할 수 없는 게시물입니다.' }
      }
      await humanClick(localPage, 'article section button[aria-label="좋아요"]')
      await localPage.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)))
      return { success: true }
    }
    catch (error) {
      return { success: false, error: error.message }
    }
    finally {
      if (!page && localPage)
        await localPage.close()
    }
  }

  async unlikePost(params: LikeParams, page?: Page): Promise<InstagramActionResponse> {
    const { postId, loginUsername } = params
    let localPage = page
    if (!localPage) {
      localPage = await this.browserService.getPage()
    }
    try {
      await this.ensureLogin(localPage)
      await this.browserService.gotoIfChanged(localPage, `https://www.instagram.com/p/${postId}/`)
      await localPage.waitForSelector('article')
      const unlikeButton = await localPage.$('article section button[aria-label="좋아요 취소"]')
      if (!unlikeButton) {
        return { success: false, error: '아직 좋아요를 누르지 않았거나 좋아요 취소를 할 수 없는 게시물입니다.' }
      }
      await humanClick(localPage, 'article section button[aria-label="좋아요 취소"]')
      await localPage.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)))
      return { success: true }
    }
    catch (error) {
      return { success: false, error: error.message }
    }
    finally {
      if (!page && localPage)
        await localPage.close()
    }
  }
}
