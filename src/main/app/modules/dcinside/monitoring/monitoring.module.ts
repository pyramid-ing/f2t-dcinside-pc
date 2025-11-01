import { Module, forwardRef } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { MonitoringController } from './monitoring.controller'
import { MonitoringService } from './monitoring.service'
import { MonitoringCrawlerService } from './monitoring-crawler.service'
import { MonitoringSearchCrawlerService } from './monitoring-search-crawler.service'
import { MonitoringAiService } from './monitoring-ai.service'
import { MonitoringAutoCommentService } from './monitoring-auto-comment.service'
import { MonitoringProcessor } from './monitoring.processor'
import { GalleryInfoCrawlerService } from './gallery-info-crawler.service'
import { PrismaModule } from '@main/app/modules/common/prisma/prisma.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { UtilModule } from '@main/app/modules/util/util.module'
import { DcinsideCommentModule } from '@main/app/modules/dcinside/comment/dcinsideCommentModule'
import { CoupasJobModule } from '@main/app/modules/dcinside/coupas-job/coupas-job.module'
import { JobLogsModule } from '@main/app/modules/dcinside/job-logs/job-logs.module'
import { JobContextModule } from '@main/app/modules/common/job-context/job-context.module'
import { DcinsidePostingCrawlerModule } from '@main/app/modules/dcinside/crawler/dcinside-posting-crawler.module'

@Module({
  imports: [
    HttpModule,
    PrismaModule,
    SettingsModule,
    UtilModule,
    DcinsideCommentModule,
    forwardRef(() => CoupasJobModule),
    JobLogsModule,
    JobContextModule,
    DcinsidePostingCrawlerModule,
  ],
  controllers: [MonitoringController],
  providers: [
    MonitoringService,
    MonitoringCrawlerService,
    MonitoringSearchCrawlerService,
    MonitoringAiService,
    MonitoringAutoCommentService,
    MonitoringProcessor,
    GalleryInfoCrawlerService,
  ],
  exports: [
    MonitoringService,
    MonitoringCrawlerService,
    MonitoringSearchCrawlerService,
    MonitoringAiService,
    MonitoringAutoCommentService,
    MonitoringProcessor,
    GalleryInfoCrawlerService,
  ],
})
export class MonitoringModule {}
