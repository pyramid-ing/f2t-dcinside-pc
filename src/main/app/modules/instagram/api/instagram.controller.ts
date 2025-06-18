import { InstagramDmService } from './instagram-dm.service'
import { InstagramFollowService } from './instagram-follow.service'
import { InstagramLikeService } from './instagram-like.service'
import { InstagramLoginService } from './instagram-login.service'
import { InstagramSearchService } from './instagram-search.service'
import {
  InstagramActionResponse,
  InstagramLoginResponse,
  InstagramPost,
  InstagramSearchResult,
} from './interfaces/instagram.interface'
import { Body, Controller, Get, Post } from '@nestjs/common'
import {
  InstagramDmDto,
  InstagramFollowDto,
  InstagramLikeDto,
  InstagramLoginDto,
  InstagramSearchDto,
} from './dto/instagram-action.dto'

@Controller()
export class InstagramController {
  constructor(
    private readonly dmService: InstagramDmService,
    private readonly followService: InstagramFollowService,
    private readonly likeService: InstagramLikeService,
    private readonly searchService: InstagramSearchService,
    private readonly loginService: InstagramLoginService,
  ) {}

  @Get('search')
  async search(@Body() dto: InstagramSearchDto): Promise<InstagramSearchResult> {
    return this.searchService.search({
      keyword: dto.keyword,
      loginUsername: dto.loginUsername,
      limit: dto.limit,
      headless: dto.headless,
    })
  }

  @Post('post')
  async getPost(@Body() dto: InstagramLikeDto): Promise<InstagramPost | null> {
    // getPost 기능은 추후 별도 서비스로 분리 필요
    return null
  }

  @Post('dm')
  async sendDm(@Body() dto: InstagramDmDto): Promise<InstagramActionResponse> {
    await this.dmService.browserService.createBrowser(false, dto.loginUsername)
    const page = await this.dmService.browserService.getPage()
    return this.dmService.sendDm(
      {
        username: dto.username,
        message: dto.message,
        loginUsername: dto.loginUsername,
        headless: dto.headless,
      },
      page,
    )
  }

  @Post('follow')
  async follow(@Body() dto: InstagramFollowDto): Promise<InstagramActionResponse> {
    await this.followService.browserService.createBrowser(false, dto.loginUsername)
    const page = await this.followService.browserService.getPage()
    return this.followService.follow(
      {
        username: dto.username,
        loginUsername: dto.loginUsername,
        headless: dto.headless,
      },
      page,
    )
  }

  @Post('unfollow')
  async unfollow(@Body() dto: InstagramFollowDto): Promise<InstagramActionResponse> {
    await this.followService.browserService.createBrowser(false, dto.loginUsername)
    const page = await this.followService.browserService.getPage()
    return this.followService.unfollow(
      {
        username: dto.username,
        loginUsername: dto.loginUsername,
        headless: dto.headless,
      },
      page,
    )
  }

  @Post('is-follow')
  async isFollow(@Body() dto: InstagramFollowDto): Promise<boolean> {
    await this.followService.browserService.createBrowser(false, dto.loginUsername)
    const page = await this.followService.browserService.getPage()
    return this.followService.isFollow(
      {
        username: dto.username,
        loginUsername: dto.loginUsername,
        headless: dto.headless,
      },
      page,
    )
  }

  @Post('like')
  async likePost(@Body() dto: InstagramLikeDto): Promise<InstagramActionResponse> {
    await this.likeService.browserService.createBrowser(false, dto.loginUsername)
    const page = await this.likeService.browserService.getPage()
    return this.likeService.likePost(
      {
        postId: dto.postId,
        loginUsername: dto.loginUsername,
        headless: dto.headless,
      },
      page,
    )
  }

  @Post('unlike')
  async unlikePost(@Body() dto: InstagramLikeDto): Promise<InstagramActionResponse> {
    await this.likeService.browserService.createBrowser(false, dto.loginUsername)
    const page = await this.likeService.browserService.getPage()
    return this.likeService.unlikePost(
      {
        postId: dto.postId,
        loginUsername: dto.loginUsername,
        headless: dto.headless,
      },
      page,
    )
  }

  @Post('login')
  async login(@Body() dto: InstagramLoginDto): Promise<InstagramLoginResponse> {
    return this.loginService.login({
      username: dto.loginUsername,
      password: dto.loginPassword,
    })
  }

  @Post('signout')
  async signout(@Body() dto: InstagramLoginDto): Promise<InstagramActionResponse> {
    return this.loginService.signout()
  }

  @Post('open-login')
  async openLoginBrowser() {
    return await this.loginService.openLoginBrowser()
  }

  @Get('login-status')
  async checkLoginStatus() {
    return await this.loginService.checkLoginStatusApi()
  }
}
