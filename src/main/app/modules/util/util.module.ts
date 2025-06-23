import { Module } from '@nestjs/common'
import { BrowserManagerService } from './browser-manager.service'
import { CookieService } from './cookie.service'
import { UtilService } from './util.service'

@Module({
  imports: [],
  providers: [BrowserManagerService, CookieService, UtilService],
  exports: [BrowserManagerService, CookieService, UtilService],
})
export class UtilModule {}
