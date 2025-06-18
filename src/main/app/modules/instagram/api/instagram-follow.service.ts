import { humanClick } from '../../../utils/human-actions'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Page } from 'puppeteer-core'
import { InstagramBaseService } from './instagram-base.service'
import { InstagramBrowserService } from './instagram-browser.service'
import { InstagramActionResponse } from './interfaces/instagram.interface'

// 팔로우 관련 파라미터 타입 정의
export interface FollowParams {
  username: string
  loginUsername?: string
  headless?: boolean
}

@Injectable()
export class InstagramFollowService extends InstagramBaseService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly browserService: InstagramBrowserService,
  ) {
    super(configService, browserService)
  }

  async follow(params: FollowParams, page?: Page): Promise<InstagramActionResponse> {
    const { username, loginUsername } = params
    let localPage = page
    if (!localPage) {
      localPage = await this.browserService.getPage()
    }
    try {
      await this.ensureLogin(localPage)
      await this.browserService.gotoIfChanged(localPage, `https://www.instagram.com/${username}/`)
      await localPage.waitForSelector('header')
      // 텍스트 기반으로 팔로우 버튼 찾기 (영어/한글 모두 지원)
      const followButton = await localPage.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('header button'))
        return (
          btns.find((btn) => {
            const text = (btn as HTMLElement).innerText?.toLowerCase().trim() || ''
            return text.includes('follow') || text.includes('팔로우')
          }) || null
        )
      })
      if (!followButton) {
        return { success: false, error: '이미 팔로우 중이거나 팔로우할 수 없는 계정입니다.' }
      }
      await humanClick(localPage, followButton)
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

  async unfollow(params: FollowParams, page?: Page): Promise<InstagramActionResponse> {
    const { username, loginUsername } = params
    let localPage = page
    if (!localPage) {
      localPage = await this.browserService.getPage()
    }
    try {
      await this.ensureLogin(localPage)
      await this.browserService.gotoIfChanged(localPage, `https://www.instagram.com/${username}/`)
      await localPage.waitForSelector('header')
      // 텍스트 기반으로 팔로잉 버튼 찾기 (영어/한글 모두 지원)
      const followingButton = await localPage.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('header button'))
        return (
          btns.find((btn) => {
            const text = (btn as HTMLElement).innerText?.toLowerCase().trim() || ''
            return text.includes('following') || text.includes('팔로잉')
          }) || null
        )
      })
      if (!followingButton) {
        return { success: false, error: '팔로우 중이 아닌 계정입니다.' }
      }
      await humanClick(localPage, followingButton)
      // 팝업에서 '팔로우 취소' 또는 'unfollow' 텍스트가 포함된 버튼 클릭
      await localPage.waitForSelector('div[role="dialog"] button, div[role="dialog"] [role="button"]')
      const unfollowBtnHandle = await localPage.evaluateHandle(() => {
        const btns = Array.from(
          document.querySelectorAll('div[role="dialog"] button, div[role="dialog"] [role="button"]'),
        )
        return (
          btns.find((btn) => {
            const text = (btn as HTMLElement).innerText?.toLowerCase().trim() || ''
            return text.includes('unfollow') || text.includes('팔로우 취소')
          }) || null
        )
      })
      if (unfollowBtnHandle) {
        await humanClick(localPage, unfollowBtnHandle)
      }
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

  async isFollow(params: FollowParams, page?: Page): Promise<boolean> {
    const { username, loginUsername } = params
    let localPage = page
    if (!localPage) {
      localPage = await this.browserService.getPage()
    }
    try {
      await this.ensureLogin(localPage)
      await this.browserService.gotoIfChanged(localPage, `https://www.instagram.com/${username}/`)
      await localPage.waitForSelector('button')
      // 텍스트 기반으로 팔로잉 상태 버튼 찾기 (영어/한글 모두 지원)
      const isFollowing = await localPage.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
        return btns.some((btn) => {
          const text = (btn as HTMLElement).innerText?.toLowerCase().trim() || ''
          return text.includes('following') || text.includes('팔로잉')
        })
      })
      return isFollowing
    }
    catch (error) {
      throw new Error(`팔로우 상태 확인 실패: ${error.message}`)
    }
    finally {
      if (!page && localPage)
        await localPage.close()
    }
  }
}
