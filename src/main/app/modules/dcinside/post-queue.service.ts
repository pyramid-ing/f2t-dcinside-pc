import { sleep } from '@main/app/utils/sleep'
import { Injectable, Logger } from '@nestjs/common'
import { PostJobService } from 'src/main/app/modules/dcinside/api/post-job.service'
import { SettingsService } from 'src/main/app/modules/settings/settings.service'
import { BrowserManagerService } from '@main/app/modules/util/browser-manager.service'
import { ZodError } from 'zod'
import { DcinsidePostingService, DcinsidePostParams } from './api/dcinside-posting.service'
import { DcinsidePostSchema } from './api/dto/schemas'
import type { Browser } from 'puppeteer-core'

interface PostQueueItem {
  id: number
  params: DcinsidePostParams
  browserId: string // 로그인 ID 또는 'anonymous'
}

@Injectable()
export class PostQueueService {
  private readonly logger = new Logger(PostQueueService.name)
  private postQueue: PostQueueItem[] = []
  private isProcessingQueue = false

  constructor(
    private readonly browserManager: BrowserManagerService,
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

  

  /**
   * 큐 처리 (엑셀 순서대로, 세션별 브라우저 관리)
   */
  async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.postQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true
    this.logger.log(`큐 처리 시작: ${this.postQueue.length}개 작업`)

    const appSettings = await this.getAppSettings()

    // 브라우저 ID별 작업 수 미리 계산
    const browserJobCounts = new Map<string, number>()
    for (const item of this.postQueue) {
      const count = browserJobCounts.get(item.browserId) || 0
      browserJobCounts.set(item.browserId, count + 1)
    }

    try {
      // 큐에서 순서대로 하나씩 처리
      while (this.postQueue.length > 0) {
        const queueItem = this.postQueue.shift()!

        try {
          this.logger.log(`작업 시작: ID ${queueItem.id} (브라우저: ${queueItem.browserId})`)

          // 해당 브라우저 가져오기 또는 생성
          const browser = await this.browserManager.getOrCreateBrowser(
            queueItem.browserId, 
            { headless: !appSettings.showBrowserWindow }
          )

          // 작업 처리
          const result = await this.postingService.postArticle(queueItem.params, browser)
          await this.postJobService.updateStatusWithUrl(queueItem.id, 'completed', result.message, result.url)

          this.logger.log(`작업 완료: ID ${queueItem.id}, URL: ${result.url}`)

          // 해당 브라우저의 남은 작업 수 감소
          browserJobCounts.set(queueItem.browserId, browserJobCounts.get(queueItem.browserId)! - 1)

          // 해당 브라우저의 마지막 작업이면 브라우저 종료
          if (browserJobCounts.get(queueItem.browserId) === 0) {
            await this.browserManager.closeManagedBrowser(queueItem.browserId)
          }

        } catch (error) {
          await this.postJobService.updateStatus(queueItem.id, 'failed', error.message)
          this.logger.error(`작업 실패: ID ${queueItem.id} - ${error.message}`)

          // 실패해도 브라우저 작업 수 감소 및 브라우저 관리는 해야 함
          browserJobCounts.set(queueItem.browserId, browserJobCounts.get(queueItem.browserId)! - 1)
          if (browserJobCounts.get(queueItem.browserId) === 0) {
            await this.browserManager.closeManagedBrowser(queueItem.browserId)
          }
        }

        // 작업 간 딜레이
        if (this.postQueue.length > 0) {
          this.logger.log(`작업 간 딜레이: ${appSettings.taskDelay}초`)
          await sleep(appSettings.taskDelay * 1000)
        }
      }
    } finally {
      // 혹시 남은 브라우저들 정리
      await this.browserManager.closeAllManagedBrowsers()

      this.isProcessingQueue = false
      this.logger.log('큐 처리 완료')
    }
  }

  /**
   * 수동으로 작업 추가 (processQueue 실행 없음)
   */
  async enqueueJob(job: any): Promise<void> {
    const params = await this.convertJobToParams(job)
    const browserId = job.loginId || 'anonymous'

    this.postQueue.push({
      id: job.id,
      params,
      browserId,
    })

    this.logger.log(`작업 큐 추가: ID ${job.id} (브라우저: ${browserId})`)
  }
}
