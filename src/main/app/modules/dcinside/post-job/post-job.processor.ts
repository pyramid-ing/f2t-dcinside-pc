import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PostJobService } from '@main/app/modules/dcinside/post-job/post-job.service'

@Injectable()
export class PostJobProcessor implements OnModuleInit {
  private readonly logger = new Logger(PostJobProcessor.name)

  constructor(private readonly postJobService: PostJobService) {}

  async onModuleInit() {
    // 1. 시작 직후 processing 상태인 것들을 error 처리 (중간에 강제종료된 경우)
    await this.removeUnprocessedPostJobs()
  }

  private async removeUnprocessedPostJobs() {
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
    await this.postJobService.processPostJobs()
  }
}
