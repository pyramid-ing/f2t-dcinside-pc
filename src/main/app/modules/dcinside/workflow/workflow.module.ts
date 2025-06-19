import { PostQueueService } from '@main/app/modules/dcinside/post-queue.service'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { PrismaService } from '@main/app/shared/prisma.service'
import { Module } from '@nestjs/common'
import { PostJobService } from 'src/main/app/modules/dcinside/api/post-job.service'
import { CookieService } from '../../util/cookie.service'
import { DcinsideLoginService } from '../api/dcinside-login.service'
import { DcinsidePostingService } from '../api/dcinside-posting.service'
import { DcinsideWorkflowController } from './dcinside-workflow.controller'
import { DcinsideWorkflowService } from './dcinside-workflow.service'
import { ScheduledPostCronService } from './scheduled-post-cron.service'

@Module({
  imports: [SettingsModule],
  controllers: [DcinsideWorkflowController],
  providers: [
    DcinsideWorkflowService,
    ScheduledPostCronService,
    PostQueueService,
    DcinsidePostingService,
    DcinsideLoginService,
    PostJobService,
    PrismaService,
    CookieService,
  ],
})
export class DcinsideWorkflowModule {}
