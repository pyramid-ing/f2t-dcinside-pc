import { Module, forwardRef } from '@nestjs/common'
import { CoupangWorkflowService } from './coupang-workflow.service'
import { WordPressModule } from '@main/app/modules/wordpress/wordpress.module'
import { CoupangCrawlerModule } from '@main/app/modules/coupang-crawler/coupang-crawler.module'
import { CoupangPartnersModule } from '@main/app/modules/coupang-partners/coupang-partners.module'
import { DcinsidePostingCrawlerModule } from '@main/app/modules/dcinside/crawler/dcinside-posting-crawler.module'
import { DcinsideCommentModule } from '@main/app/modules/dcinside/comment/dcinsideCommentModule'
import { JobLogsModule } from '@main/app/modules/dcinside/job-logs/job-logs.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { UtilModule } from '@main/app/modules/util/util.module'
import { MonitoringModule } from '@main/app/modules/dcinside/monitoring/monitoring.module'

@Module({
  imports: [
    WordPressModule,
    CoupangCrawlerModule,
    CoupangPartnersModule,
    DcinsidePostingCrawlerModule,
    DcinsideCommentModule,
    JobLogsModule,
    SettingsModule,
    UtilModule,
    forwardRef(() => MonitoringModule),
  ],
  providers: [CoupangWorkflowService],
  exports: [CoupangWorkflowService],
})
export class CoupangWorkflowModule {}
