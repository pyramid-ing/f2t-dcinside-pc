import { CookieService } from '@main/app/modules/util/cookie.service'
import { Module } from '@nestjs/common'
import { DcinsideLoginController } from './dcinside-login.controller'
import { DcinsideLoginService } from './dcinside-login.service'
import { DcinsidePostingController } from './dcinside-posting.controller'
import { DcinsidePostingService } from './dcinside-posting.service'

@Module({
  controllers: [DcinsidePostingController, DcinsideLoginController],
  providers: [DcinsidePostingService, DcinsideLoginService, CookieService],
  exports: [DcinsidePostingService, DcinsideLoginService],
})
export class DcinsideApiModule {}
