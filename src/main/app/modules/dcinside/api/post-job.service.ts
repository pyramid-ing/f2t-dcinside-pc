import { PostingQueueService } from '@main/app/modules/dcinside/api/post-queue.service'
import { PrismaService } from '@main/app/shared/prisma.service'
import { sleep } from '@main/app/utils/sleep'
import { Injectable, Logger } from '@nestjs/common'
import { PostJobDto } from './dto/scheduled-post.dto'

@Injectable()
export class PostJobService {
  private readonly logger = new Logger(PostJobService.name)
  constructor(private readonly prismaService: PrismaService, private readonly postingQueueService: PostingQueueService) {
    (async () => {
      await postingQueueService.enqueue(() => this.doPost('A-10초', 10000))
      await postingQueueService.enqueue(() => this.doPost('B-5초', 5000))
      await postingQueueService.enqueue(() => this.doPost('C-1초', 1000))
    })()
  }

  async doPost(id: string, delay: number) {
    console.log(`doPost${id}`)
    await sleep(delay)
  }

  // 예약 등록 추가
  async createPostJob(dto: PostJobDto) {
    return (this.prismaService as any).postJob.create({
      data: {
        galleryUrl: dto.galleryUrl,
        title: dto.title,
        contentHtml: dto.contentHtml,
        password: dto.password.toString(),
        nickname: dto.nickname ?? null,
        headtext: dto.headtext ?? null,
        headless: dto.headless ?? true,
        imagePaths: dto.imagePaths ? JSON.stringify(dto.imagePaths) : null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : new Date(),
        status: 'pending',
      },
    })
  }

  // 예약 작업 목록 조회
  async getPostJobs() {
    return (this.prismaService as any).postJob.findMany({ orderBy: { scheduledAt: 'asc' } })
  }

  // 예약 작업 상태/결과 갱신
  async updateStatus(id: number, status: string, resultMsg?: string) {
    return (this.prismaService as any).postJob.update({
      where: { id },
      data: { status, resultMsg },
    })
  }

  // pending 작업 조회 (scheduledAt <= now)
  async findPending(now: Date) {
    return (this.prismaService as any).postJob.findMany({
      where: { status: 'pending', scheduledAt: { lte: now } },
      orderBy: { scheduledAt: 'asc' },
    })
  }
}
