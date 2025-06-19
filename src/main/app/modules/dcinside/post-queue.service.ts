import { sleep } from '@main/app/utils/sleep'
import { Injectable, Logger } from '@nestjs/common'
import { PostJobService } from 'src/main/app/modules/dcinside/api/post-job.service'
import { SettingsService } from 'src/main/app/modules/settings/settings.service'
import { DcinsidePostingService, DcinsidePostParams } from './api/dcinside-posting.service'

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

  private async getAppSettings(): Promise<{ showBrowserWindow: boolean, taskDelay: number }> {
    try {
      const setting = await this.settingsService.findByKey('app')
      const data = setting?.data as any
      return {
        showBrowserWindow: data?.showBrowserWindow ?? true,
        taskDelay: data?.taskDelay ?? 10,
      }
    }
    catch {
      return { showBrowserWindow: true, taskDelay: 10 }
    }
  }

  private async convertJobToParams(job: any): Promise<DcinsidePostParams> {
    const appSettings = await this.getAppSettings()
    return {
      ...job,
      imagePaths: job.imagePaths ? JSON.parse(job.imagePaths) : [],
      headless: !appSettings.showBrowserWindow, // 창보임 설정의 반대가 headless
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
        await this.postJobService.updateStatusWithUrl(
          queueItem.id,
          'completed',
          result.message,
          result.url,
        )
        this.logger.log(`포스팅 완료: ID ${queueItem.id}, URL: ${result.url}`)
      }
      catch (error) {
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
