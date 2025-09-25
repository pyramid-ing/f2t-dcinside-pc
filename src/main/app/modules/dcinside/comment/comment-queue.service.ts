import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { CommentAutomationService } from './comment-automation.service'
import { BrowserManagerService } from '@main/app/modules/util/browser-manager.service'

@Injectable()
export class CommentQueueService {
  private readonly logger = new Logger(CommentQueueService.name)
  private processingJobs = new Set<string>()

  constructor(
    private prisma: PrismaService,
    private commentAutomationService: CommentAutomationService,
    private browserManagerService: BrowserManagerService,
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

      // 브라우저 매니저를 통해 브라우저 생성 및 작업 실행
      const browserId = `comment-job-${jobId}`
      const browser = await this.browserManagerService.getOrCreateBrowser(browserId, {
        headless: false, // 디버깅을 위해 headless: false로 설정
      })

      this.processingJobs.add(jobId)

      try {
        await this.commentAutomationService.executeCommentJob(jobId, browser)
      } finally {
        this.processingJobs.delete(jobId)
        await this.browserManagerService.closeManagedBrowser(browserId)
      }
    } catch (error) {
      this.logger.error(`Failed to queue comment job ${jobId}: ${error.message}`, error.stack)
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
      throw error
    }
  }
}
