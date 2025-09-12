import { Module } from '@nestjs/common'
import { JobQueueProcessor } from './job-queue.processor'
import { JobController } from './job.controller'
import { JobService } from './job.service'
import { CommonModule } from '@main/app/modules/common/common.module'
import { PostJobModule } from '@main/app/modules/dcinside/post-job/post-job.module'
import { JobLogsModule } from '@main/app/modules/dcinside/job-logs/job-logs.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { DcinsideApiModule } from '@main/app/modules/dcinside/api/api.module'
import { UtilModule } from '@main/app/modules/util/util.module'

@Module({
  imports: [CommonModule, PostJobModule, JobLogsModule, SettingsModule, DcinsideApiModule, UtilModule],
  providers: [JobQueueProcessor, JobService],
  controllers: [JobController],
  exports: [JobQueueProcessor, JobService],
})
export class JobModule {}
