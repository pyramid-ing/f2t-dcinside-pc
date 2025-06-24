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
  sessionId: string // 로그인 ID 또는 'anonymous'
}

// 세션별 브라우저 관리
interface SessionBrowser {
  sessionId: string
  browser: Browser
  remainingJobCount: number // 남은 작업 수
}

@Injectable()
export class PostQueueService {
  private readonly logger = new Logger(PostQueueService.name)
  private postQueue: PostQueueItem[] = []
  private isProcessingQueue = false
  private sessionBrowsers = new Map<string, SessionBrowser>() // 세션별 브라우저 관리

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
   * 세션별 브라우저 가져오기 또는 생성
   */
  private async getOrCreateSessionBrowser(sessionId: string, jobCount: number): Promise<Browser> {
    let sessionBrowser = this.sessionBrowsers.get(sessionId)

    if (!sessionBrowser) {
      // 새 브라우저 생성
      const appSettings = await this.getAppSettings()
      const browser = await this.browserManager.launchBrowser({
        headless: !appSettings.showBrowserWindow,
      })

      sessionBrowser = {
        sessionId,
        browser,
        remainingJobCount: jobCount,
      }

      this.sessionBrowsers.set(sessionId, sessionBrowser)
      this.logger.log(`${sessionId} 세션 브라우저 생성 (${jobCount}개 작업 예정)`)
    }

    return sessionBrowser.browser
  }

  /**
   * 작업 완료 후 세션 브라우저 관리
   */
  private async handleSessionBrowserAfterJob(sessionId: string): Promise<void> {
    const sessionBrowser = this.sessionBrowsers.get(sessionId)
    if (!sessionBrowser) return

    sessionBrowser.remainingJobCount--

    // 해당 세션의 마지막 작업이면 브라우저 종료
    if (sessionBrowser.remainingJobCount <= 0) {
      await this.browserManager.closeBrowser(sessionBrowser.browser)
      this.sessionBrowsers.delete(sessionId)
      this.logger.log(`${sessionId} 세션 브라우저 종료 (모든 작업 완료)`)
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

    // 세션별 작업 수 미리 계산
    const sessionJobCounts = new Map<string, number>()
    for (const item of this.postQueue) {
      const count = sessionJobCounts.get(item.sessionId) || 0
      sessionJobCounts.set(item.sessionId, count + 1)
    }

    try {
      // 큐에서 순서대로 하나씩 처리
      while (this.postQueue.length > 0) {
        const queueItem = this.postQueue.shift()!

        try {
          this.logger.log(`작업 시작: ID ${queueItem.id} (${queueItem.sessionId} 세션)`)

          // 해당 세션의 브라우저 가져오기 또는 생성
          const sessionJobCount = sessionJobCounts.get(queueItem.sessionId) || 1
          const browser = await this.getOrCreateSessionBrowser(queueItem.sessionId, sessionJobCount)

          // 작업 처리
          const result = await this.postingService.postArticle(queueItem.params, browser)
          await this.postJobService.updateStatusWithUrl(queueItem.id, 'completed', result.message, result.url)

          this.logger.log(`작업 완료: ID ${queueItem.id}, URL: ${result.url}`)

          // 세션 브라우저 관리 (마지막 작업이면 브라우저 종료)
          await this.handleSessionBrowserAfterJob(queueItem.sessionId)
        } catch (error) {
          await this.postJobService.updateStatus(queueItem.id, 'failed', error.message)
          this.logger.error(`작업 실패: ID ${queueItem.id} - ${error.message}`)

          // 실패해도 세션 브라우저 관리는 해야 함
          await this.handleSessionBrowserAfterJob(queueItem.sessionId)
        }

        // 작업 간 딜레이
        if (this.postQueue.length > 0) {
          this.logger.log(`작업 간 딜레이: ${appSettings.taskDelay}초`)
          await sleep(appSettings.taskDelay * 1000)
        }
      }
    } finally {
      // 혹시 남은 브라우저들 정리
      for (const [sessionId, sessionBrowser] of this.sessionBrowsers.entries()) {
        await this.browserManager.closeBrowser(sessionBrowser.browser)
        this.logger.log(`${sessionId} 세션 브라우저 강제 종료`)
      }
      this.sessionBrowsers.clear()

      this.isProcessingQueue = false
      this.logger.log('큐 처리 완료')
    }
  }

  /**
   * 수동으로 작업 추가 (processQueue 실행 없음)
   */
  async enqueueJob(job: any): Promise<void> {
    const params = await this.convertJobToParams(job)
    const sessionId = job.loginId || 'anonymous'

    this.postQueue.push({
      id: job.id,
      params,
      sessionId,
    })

    this.logger.log(`작업 큐 추가: ID ${job.id} (${sessionId} 세션)`)
  }
}
