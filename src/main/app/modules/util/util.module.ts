import { Module } from '@nestjs/common'
import { BrowserManagerService } from './browser-manager.service'
import { CookieService } from './cookie.service'
import { UtilService } from './util.service'
import { TetheringService } from './tethering.service'
import { TwoCaptchaService } from './two-captcha.service'

@Module({
  imports: [],
  providers: [BrowserManagerService, CookieService, UtilService, TetheringService, TwoCaptchaService],
  exports: [BrowserManagerService, CookieService, UtilService, TetheringService, TwoCaptchaService],
})
export class UtilModule {}
