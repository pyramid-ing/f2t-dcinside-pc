import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PostJobService } from 'src/main/app/modules/dcinside/api/post-job.service'
import { PostQueueService } from '../post-queue.service'

@Injectable()
export class ScheduledPostCronService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledPostCronService.name)

  constructor(
    private readonly postJobService: PostJobService,
    private readonly postQueueService: PostQueueService,
  ) {}

  async onModuleInit() {
    // 1. 시작 직후 processing 상태인 것들을 error 처리 (중간에 강제종료된 경우)
    await this.handleOrphanedJobs()
  }

  private async handleOrphanedJobs() {
    try {
      const processingJobs = await this.postJobService.findByStatus('processing')
      for (const job of processingJobs) {
        await this.postJobService.updateStatus(job.id, 'failed', '시스템 재시작으로 인한 작업 중단')
      }
      this.logger.log(`처리 중이던 ${processingJobs.length}개 작업을 실패 처리했습니다.`)
    } catch (error) {
      this.logger.error('처리 중이던 작업 정리 실패:', error)
    }
  }

  // 1분마다 예약 글 등록 처리
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledPosts() {
    try {
      const now = new Date()

      // 2. pending 상태이면서 publishAt <= now인 작업들을 processing으로 변경
      const updatedCount = await this.postJobService.updatePendingToProcessing(now)

      if (updatedCount > 0) {
        this.logger.log(`${updatedCount}개 작업을 processing 상태로 변경`)

        // 3. processing 상태인 작업들을 큐에 추가
        const processingJobs = await this.postJobService.findByStatus('processing')

        for (const job of processingJobs) {
          await this.postQueueService.enqueueJob(job)
        }
      }
    } catch (error) {
      this.logger.error('스케줄 처리 중 오류:', error)
    }
  }
}
