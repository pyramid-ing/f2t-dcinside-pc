import { Module } from '@nestjs/common'
import { JobQueueProcessor } from './job-queue.processor'
import { JobController } from './job.controller'
import { JobService } from './job.service'
import { CommonModule } from '@main/app/modules/common/common.module'
import { PostJobModule } from '@main/app/modules/dcinside/post-job/post-job.module'
import { JobLogsModule } from '@main/app/modules/dcinside/job-logs/job-logs.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { DcinsidePostingModule } from '@main/app/modules/dcinside/posting/dcinside-posting.module'
import { UtilModule } from '@main/app/modules/util/util.module'
import { DcinsideCommentModule } from '@main/app/modules/dcinside/comment/dcinsideCommentModule'

@Module({
  imports: [
    CommonModule,
    PostJobModule,
    JobLogsModule,
    SettingsModule,
    DcinsidePostingModule,
    UtilModule,
    DcinsideCommentModule,
  ],
  providers: [JobQueueProcessor, JobService],
  controllers: [JobController],
  exports: [JobQueueProcessor, JobService],
})
export class JobModule {}
