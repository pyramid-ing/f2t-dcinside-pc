import { Module } from '@nestjs/common'
import { DcinsidePostingCrawlerService } from 'src/main/app/modules/dcinside/crawler/dcinside-posting-crawler.service'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { UtilModule } from '@main/app/modules/util/util.module'
import { JobLogsModule } from '@main/app/modules/dcinside/job-logs/job-logs.module'
import { CommonModule } from '@main/app/modules/common/common.module'
import { DcCaptchaSolverService } from '@main/app/modules/dcinside/util/dc-captcha-solver.service'

@Module({
  imports: [SettingsModule, UtilModule, JobLogsModule, CommonModule],
  providers: [DcinsidePostingCrawlerService, DcCaptchaSolverService],
  exports: [DcinsidePostingCrawlerService],
})
export class DcinsidePostingCrawlerModule {}
