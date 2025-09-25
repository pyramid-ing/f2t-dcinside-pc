import { Module } from '@nestjs/common'
import { CommentController } from './comment.controller'
import { CommentService } from './comment.service'
import { CommentAutomationService } from './comment-automation.service'
import { CommentQueueService } from './comment-queue.service'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { TwoCaptchaService } from '@main/app/modules/util/two-captcha.service'
import { BrowserManagerService } from '@main/app/modules/util/browser-manager.service'

@Module({
  controllers: [CommentController],
  providers: [
    CommentService,
    CommentAutomationService,
    CommentQueueService,
    PrismaService,
    TwoCaptchaService,
    BrowserManagerService,
  ],
  exports: [CommentService, CommentQueueService],
})
export class CommentModule {}
