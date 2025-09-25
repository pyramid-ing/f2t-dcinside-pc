import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { DcinsideCommentAutomationService } from 'src/main/app/modules/dcinside/comment/dcinside-comment-automation.service'
import { DcinsideCommentException } from '@main/common/errors/dcinside-comment.exception'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'

@Injectable()
export class DcinsideCommentQueueService {
  private readonly logger = new Logger(DcinsideCommentQueueService.name)
  private processingJobs = new Set<string>()

  constructor(
    private prisma: PrismaService,
    private commentAutomationService: DcinsideCommentAutomationService,
  ) {}

  /**
   * 댓글 작업을 큐에 추가
   */
  async queueCommentJob(jobId: string): Promise<void> {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        include: { commentJob: true },
      })

      if (!job || !job.commentJob) {
        throw new Error(`Comment job not found: ${jobId}`)
      }

      if (this.processingJobs.has(jobId)) {
        this.logger.warn(`Job ${jobId} is already being processed`)
        return
      }

      this.logger.log(`Queueing comment job: ${jobId}`)

      this.processingJobs.add(jobId)

      await this.commentAutomationService.executeCommentJob(jobId)
    } catch (error) {
      this.logger.error(`Failed to queue comment job ${jobId}: ${error.message}`, error.stack)

      // DcinsideCommentException을 CustomHttpException으로 변환
      if (error instanceof DcinsideCommentException) {
        throw new CustomHttpException(error.errorCode, error.metadata)
      }

      throw error
    }
  }

  /**
   * 대기 중인 댓글 작업들을 처리
   */
  async processPendingCommentJobs(): Promise<void> {
    try {
      const pendingJobs = await this.prisma.job.findMany({
        where: {
          type: 'COMMENT',
          status: 'pending',
        },
        include: {
          commentJob: true,
        },
      })

      this.logger.log(`Found ${pendingJobs.length} pending comment jobs`)

      for (const job of pendingJobs) {
        if (!this.processingJobs.has(job.id)) {
          // 비동기로 처리 (병렬 실행)
          this.queueCommentJob(job.id).catch(error => {
            this.logger.error(`Failed to process job ${job.id}: ${error.message}`)
          })
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process pending comment jobs: ${error.message}`, error.stack)
    }
  }

  /**
   * 작업 중지
   */
  async stopCommentJob(jobId: string): Promise<void> {
    try {
      await this.prisma.job.update({
        where: { id: jobId },
        data: { status: 'pending' },
      })

      this.logger.log(`Stopped comment job: ${jobId}`)
    } catch (error) {
      this.logger.error(`Failed to stop comment job ${jobId}: ${error.message}`, error.stack)
      throw error
    }
  }

  /**
   * 작업 재시작
   */
  async restartCommentJob(jobId: string): Promise<void> {
    try {
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'pending',
          startedAt: null,
          completedAt: null,
          errorMsg: null,
        },
      })

      this.logger.log(`Restarted comment job: ${jobId}`)

      // 큐에 다시 추가
      await this.queueCommentJob(jobId)
    } catch (error) {
      this.logger.error(`Failed to restart comment job ${jobId}: ${error.message}`, error.stack)

      // DcinsideCommentException을 CustomHttpException으로 변환
      if (error instanceof DcinsideCommentException) {
        throw new CustomHttpException(error.errorCode, error.metadata)
      }

      throw error
    }
  }
}
