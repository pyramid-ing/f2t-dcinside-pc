import { CookieService } from '@main/app/modules/util/cookie.service'
import { Module } from '@nestjs/common'
import { SettingsModule } from 'src/main/app/modules/settings/settings.module'
import { DcinsideLoginController } from './dcinside-login.controller'
import { DcinsideLoginService } from './dcinside-login.service'
import { DcinsidePostingController } from './dcinside-posting.controller'
import { DcinsidePostingService } from './dcinside-posting.service'

@Module({
  imports: [SettingsModule],
  controllers: [DcinsidePostingController, DcinsideLoginController],
  providers: [DcinsidePostingService, DcinsideLoginService, CookieService],
  exports: [DcinsidePostingService, DcinsideLoginService],
})
export class DcinsideApiModule {}
