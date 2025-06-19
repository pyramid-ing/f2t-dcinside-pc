import { sleep } from '@main/app/utils/sleep'
import { Injectable, Logger } from '@nestjs/common'
import { PostJobService } from 'src/main/app/modules/dcinside/api/post-job.service'
import { SettingsService } from 'src/main/app/modules/settings/settings.service'
import { ZodError } from 'zod'
import { DcinsidePostingService, DcinsidePostParams } from './api/dcinside-posting.service'
import { DcinsidePostSchema } from './api/dto/schemas'

interface PostQueueItem {
  id: number
  params: DcinsidePostParams
}

@Injectable()
export class PostQueueService {
  private readonly logger = new Logger(PostQueueService.name)
  private postQueue: PostQueueItem[] = []
  private isProcessingQueue = false

  constructor(
    private readonly postJobService: PostJobService,
    private readonly postingService: DcinsidePostingService,
    private readonly settingsService: SettingsService,
  ) {}

  private async getAppSettings(): Promise<{ showBrowserWindow: boolean; taskDelay: number }> {
    try {
      const setting = await this.settingsService.findByKey('app')
      const data = setting?.data as any
      return {
        showBrowserWindow: data?.showBrowserWindow ?? true,
        taskDelay: data?.taskDelay ?? 10,
      }
    } catch {
      return { showBrowserWindow: true, taskDelay: 10 }
    }
  }

  private async convertJobToParams(job: any): Promise<DcinsidePostParams> {
    const appSettings = await this.getAppSettings()

    // 기본 포스팅 파라미터 구성
    const rawParams = {
      galleryUrl: job.galleryUrl,
      title: job.title,
      contentHtml: job.contentHtml,
      password: job.password,
      nickname: job.nickname,
      headtext: job.headtext,
      imagePaths: job.imagePaths ? JSON.parse(job.imagePaths) : [],
      loginId: job.loginId,
      loginPassword: job.loginPassword,
      headless: !appSettings.showBrowserWindow, // 창보임 설정의 반대가 headless
    }

    try {
      // Zod로 검증 및 변환
      return DcinsidePostSchema.parse(rawParams)
    } catch (error) {
      if (error instanceof ZodError) {
        const zodErrors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        throw new Error(`큐 파라미터 검증 실패: ${zodErrors.join(', ')}`)
      }
      throw new Error(`큐 파라미터 검증 실패: ${error.message}`)
    }
  }

  async enqueueJob(job: any): Promise<void> {
    // 이미 검증된 데이터이므로 변환만 수행
    const params = await this.convertJobToParams(job)

    this.postQueue.push({ id: job.id, params })
    this.logger.log(`작업 큐에 추가: ID ${job.id}`)

    // 큐가 처리 중이 아니면 처리 시작
    if (!this.isProcessingQueue) {
      this.runQueue()
    }
  }

  private async runQueue(): Promise<void> {
    if (this.isProcessingQueue || this.postQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true
    this.logger.log(`포스팅 큐 처리 시작: ${this.postQueue.length}개 작업`)

    const appSettings = await this.getAppSettings()
    const taskDelay = appSettings.taskDelay * 1000 // 초를 밀리초로 변환
    const headless = !appSettings.showBrowserWindow

    while (this.postQueue.length > 0) {
      const queueItem = this.postQueue.shift()!

      try {
        this.logger.log(`포스팅 시작: ID ${queueItem.id}`)
        const result = await this.postingService.postArticle({
          ...queueItem.params,
          headless,
        })
        await this.postJobService.updateStatusWithUrl(queueItem.id, 'completed', result.message, result.url)
        this.logger.log(`포스팅 완료: ID ${queueItem.id}, URL: ${result.url}`)
      } catch (error) {
        await this.postJobService.updateStatus(queueItem.id, 'failed', error.message)
        this.logger.error(`포스팅 실패: ID ${queueItem.id} - ${error.message}`)
      }

      // 설정된 작업 간 딜레이
      if (this.postQueue.length > 0) {
        this.logger.log(`작업 간 딜레이: ${appSettings.taskDelay}초`)
        await sleep(taskDelay)
      }
    }

    this.isProcessingQueue = false
    this.logger.log('포스팅 큐 처리 완료')
  }
}
