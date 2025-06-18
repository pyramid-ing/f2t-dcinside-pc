import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { InstagramBaseService } from './instagram-base.service'
import { InstagramBrowserService } from './instagram-browser.service'
import { InstagramDmService } from './instagram-dm.service'
import { InstagramFollowService } from './instagram-follow.service'
import { InstagramLikeService } from './instagram-like.service'
import { InstagramLoginService } from './instagram-login.service'
import { InstagramSearchService } from './instagram-search.service'
import { InstagramController } from './instagram.controller'

@Module({
  imports: [ConfigModule],
  controllers: [InstagramController],
  providers: [
    InstagramDmService,
    InstagramFollowService,
    InstagramLikeService,
    InstagramSearchService,
    InstagramLoginService,
    InstagramBaseService,
    InstagramBrowserService,
  ],
  exports: [
    InstagramDmService,
    InstagramFollowService,
    InstagramLikeService,
    InstagramSearchService,
    InstagramLoginService,
    InstagramBaseService,
    InstagramBrowserService,
  ],
})
export class InstagramApiModule {}
