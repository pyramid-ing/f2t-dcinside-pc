import { InstagramBaseService } from './instagram-base.service'
import { InstagramPost, InstagramSearchResult } from './interfaces/instagram.interface'
import { humanClick } from '../../../utils/human-actions'
import { sleep } from '../../../utils/sleep'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Page } from 'puppeteer-core'
import { InstagramBrowserService } from './instagram-browser.service'

// 검색 관련 파라미터 타입 정의
export interface SearchParams {
  keyword: string
  loginUsername?: string
  limit?: number
  headless?: boolean
}

@Injectable()
export class InstagramSearchService extends InstagramBaseService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly browserService: InstagramBrowserService,
  ) {
    super(configService, browserService)
  }

  async search(params: SearchParams, page?: Page): Promise<InstagramSearchResult> {
    const { keyword, loginUsername, limit = 10 } = params
    let localPage = page
    if (!localPage) {
      localPage = await this.browserService.getPage()
    }
    try {
      const searchUrl = `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(keyword)}`
      await this.browserService.gotoIfChanged(localPage, searchUrl)
      await localPage.waitForSelector('div[class*="x1qjc9v5"][class*="x972fbf"][class*="x10w94by"]')
      await humanClick(localPage, 'div[class*="x1qjc9v5"][class*="x972fbf"][class*="x10w94by"]')
      await localPage.waitForSelector('div[role="dialog"]')
      await sleep(1000)
      const posts: InstagramPost[] = []
      for (let i = 0; i < limit; i++) {
        try {
          const post = await localPage.evaluate(() => {
            const dialog = document.querySelector('div[role="dialog"]')
            if (!dialog)
              return null
            const postUrl = window.location.href
            const postId = postUrl.split('/p/')?.[1]?.replace('/', '') || ''
            const img = dialog.querySelector('img[style*="object-fit"]') as HTMLImageElement
            const ownerLink = dialog.querySelector('header ._aaqt a[role="link"]') as HTMLAnchorElement
            const ownerImg = dialog.querySelector('header img') as HTMLImageElement
            const verifiedBadge = dialog.querySelector('[aria-label="인증됨"]')
            const likeCount = Number.parseInt(dialog.querySelector('section span')?.textContent?.replace(/\D/g, '') || '0')
            const caption = dialog.querySelector('ul > div')?.textContent || ''
            const commentCount = Number.parseInt(dialog.querySelector('ul')?.childElementCount?.toString() || '0')
            return {
              id: postId,
              shortcode: postId,
              displayUrl: img?.src || '',
              caption,
              owner: {
                id: ownerLink?.href?.split('/')?.filter(Boolean)?.pop() || '',
                username: ownerLink?.textContent || '',
                profilePicUrl: ownerImg?.src || '',
                isPrivate: false,
                isVerified: !!verifiedBadge,
              },
              likeCount,
              commentCount,
              timestamp: new Date().toISOString(),
            }
          })
          if (post) {
            posts.push(post)
          }
          await localPage.keyboard.press('ArrowRight')
          await sleep(1000)
        }
        catch (error) {
          this.logger.error(`포스트 추출 실패: ${error.message}`)
          break
        }
      }
      return {
        success: true,
        posts,
        users: [],
        tags: [],
      }
    }
    catch (error) {
      this.logger.error(`검색 실패 (${keyword}): ${error.message}`)
      return {
        success: false,
        error: error.message,
        posts: [],
        users: [],
        tags: [],
      }
    }
    finally {
      if (!page && localPage)
        await localPage.close()
    }
  }
}
