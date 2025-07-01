import { PostQueueService } from '@main/app/modules/dcinside/post-queue.service'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { UtilModule } from '@main/app/modules/util/util.module'
import { PrismaService } from '@main/app/shared/prisma.service'
import { Module } from '@nestjs/common'
import { DcinsideApiModule } from '../api/api.module'
import { JobLogsModule } from 'src/main/app/modules/dcinside/job-logs/job-logs.module'
import { PostJobModule } from 'src/main/app/modules/dcinside/post-job/post-job.module'
import { DcinsideWorkflowController } from './dcinside-workflow.controller'
import { DcinsideWorkflowService } from './dcinside-workflow.service'
import { ScheduledPostCronService } from './scheduled-post-cron.service'

@Module({
  imports: [SettingsModule, UtilModule, DcinsideApiModule, PostJobModule, JobLogsModule],
  controllers: [DcinsideWorkflowController],
  providers: [DcinsideWorkflowService, ScheduledPostCronService, PostQueueService, PrismaService],
})
export class DcinsideWorkflowModule {}
