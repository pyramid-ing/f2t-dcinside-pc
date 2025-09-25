import { Module } from '@nestjs/common'
import { CommentController } from './comment.controller'
import { CommentService } from './comment.service'
import { CommentAutomationService } from './comment-automation.service'
import { CommentQueueService } from './comment-queue.service'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { BrowserManagerService } from '@main/app/modules/util/browser-manager.service'
import { DcCaptchaSolverService } from '../util/dc-captcha-solver.service'
import { SettingsModule } from '@main/app/modules/settings/settings.module'

@Module({
  imports: [SettingsModule],
  controllers: [CommentController],
  providers: [
    CommentService,
    CommentAutomationService,
    CommentQueueService,
    PrismaService,
    BrowserManagerService,
    DcCaptchaSolverService,
  ],
  exports: [CommentService, CommentQueueService],
})
export class CommentModule {}
