import { Module } from '@nestjs/common'
import { BrowserManagerService } from './browser-manager.service'
import { CookieService } from './cookie.service'
import { UtilService } from './util.service'
import { TetheringService } from './tethering.service'

@Module({
  imports: [],
  providers: [BrowserManagerService, CookieService, UtilService, TetheringService],
  exports: [BrowserManagerService, CookieService, UtilService, TetheringService],
})
export class UtilModule {}
