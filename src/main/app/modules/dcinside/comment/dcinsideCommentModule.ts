import { Module } from '@nestjs/common'
import { DcinsideCommentController } from 'src/main/app/modules/dcinside/comment/dcinside-comment.controller'
import { DcinsideCommentService } from 'src/main/app/modules/dcinside/comment/dcinside-comment.service'
import { DcinsideCommentAutomationService } from 'src/main/app/modules/dcinside/comment/dcinside-comment-automation.service'
import { DcinsideCommentQueueService } from 'src/main/app/modules/dcinside/comment/dcinside-comment-queue.service'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { BrowserManagerService } from '@main/app/modules/util/browser-manager.service'
import { DcCaptchaSolverService } from '../util/dc-captcha-solver.service'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { UtilModule } from '@main/app/modules/util/util.module'
import { JobLogsModule } from '@main/app/modules/dcinside/job-logs/job-logs.module'

@Module({
  imports: [SettingsModule, UtilModule, JobLogsModule],
  controllers: [DcinsideCommentController],
  providers: [
    DcinsideCommentService,
    DcinsideCommentAutomationService,
    DcinsideCommentQueueService,
    PrismaService,
    BrowserManagerService,
    DcCaptchaSolverService,
  ],
  exports: [DcinsideCommentService, DcinsideCommentQueueService],
})
export class DcinsideCommentModule {}
