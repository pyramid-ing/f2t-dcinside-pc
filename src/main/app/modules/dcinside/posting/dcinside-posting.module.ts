import { Module } from '@nestjs/common'
import { SettingsModule } from 'src/main/app/modules/settings/settings.module'
import { DcinsidePostingService } from '@main/app/modules/dcinside/posting/dcinside-posting.service'
import { JobLogsModule } from 'src/main/app/modules/dcinside/job-logs/job-logs.module'
import { UtilModule } from '@main/app/modules/util/util.module'
import { CommonModule } from '@main/app/modules/common/common.module'
import { DcCaptchaSolverService } from '../util/dc-captcha-solver.service'

@Module({
  imports: [SettingsModule, UtilModule, JobLogsModule, CommonModule],
  controllers: [],
  providers: [DcinsidePostingService, DcCaptchaSolverService],
  exports: [DcinsidePostingService, JobLogsModule, DcCaptchaSolverService],
})
export class DcinsidePostingModule {}
