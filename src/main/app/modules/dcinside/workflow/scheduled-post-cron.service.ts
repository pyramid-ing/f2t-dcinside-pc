import { sleep } from '@main/app/utils/sleep'
import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PostJobService } from 'src/main/app/modules/dcinside/api/post-job.service'
import { DcinsidePostingService, DcinsidePostParams } from '../api/dcinside-posting.service'

@Injectable()
export class ScheduledPostCronService {
  private readonly logger = new Logger(ScheduledPostCronService.name)
  constructor(
    private readonly postJobService: PostJobService,
    private readonly postingService: DcinsidePostingService,
  ) {}

  // 1분마다 예약 글 등록 처리
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledPosts() {
    const now = new Date()
    const posts = await this.postJobService.findPending(now)

    for (const post of posts) {
      try {
        const params: DcinsidePostParams = {
          ...post,
          imagePaths: post.imagePaths ? JSON.parse(post.imagePaths) : [],
          headless: false,
        }
        const result = await this.postingService.postArticle(params)
        await this.postJobService.updateStatus(post.id, 'completed', result.message)
      }
      catch (e: any) {
        await this.postJobService.updateStatus(post.id, 'failed', e.message)
      }
      // 10초 간격으로 처리
      await sleep(10000)
    }
  }
}
