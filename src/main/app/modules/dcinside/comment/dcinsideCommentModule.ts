import { Module } from '@nestjs/common'
import { DcinsideCommentController } from 'src/main/app/modules/dcinside/comment/dcinside-comment.controller'
import { CommentJobService } from 'src/main/app/modules/dcinside/comment/comment-job.service'
import { DcinsideCommentAutomationService } from 'src/main/app/modules/dcinside/comment/dcinside-comment-automation.service'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { BrowserManagerService } from '@main/app/modules/util/browser-manager.service'
import { DcCaptchaSolverService } from '../util/dc-captcha-solver.service'
import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { UtilModule } from '@main/app/modules/util/util.module'
import { JobLogsModule } from '@main/app/modules/dcinside/job-logs/job-logs.module'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [SettingsModule, UtilModule, JobLogsModule, CommonModule],
  controllers: [DcinsideCommentController],
  providers: [
    CommentJobService,
    DcinsideCommentAutomationService,
    PrismaService,
    BrowserManagerService,
    DcCaptchaSolverService,
  ],
  exports: [CommentJobService, DcinsideCommentAutomationService],
})
export class DcinsideCommentModule {}
