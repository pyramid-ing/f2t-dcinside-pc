import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { Module } from '@nestjs/common'
import { CookieService } from '../../util/cookie.service'
import { DcinsideLoginService } from '../api/dcinside-login.service'
import { DcinsidePostingService } from '../api/dcinside-posting.service'
import { DcinsideWorkflowController } from './dcinside-workflow.controller'
import { DcinsideWorkflowService } from './dcinside-workflow.service'

@Module({
  imports: [SettingsModule],
  controllers: [DcinsideWorkflowController],
  providers: [DcinsideWorkflowService, DcinsidePostingService, DcinsideLoginService, CookieService],
})
export class DcinsideWorkflowModule {}
