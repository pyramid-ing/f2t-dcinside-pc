import { sleep } from '@main/app/utils/sleep'
import { Injectable, Logger } from '@nestjs/common'
import { PostJobService } from '@main/app/modules/dcinside/post-job/post-job.service'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { SettingsService } from 'src/main/app/modules/settings/settings.service'
import { BrowserManagerService } from '@main/app/modules/util/browser-manager.service'
import { ZodError } from 'zod'
import { DcinsidePostingService, DcinsidePostParams } from './api/dcinside-posting.service'
import { DcinsideLoginService } from './api/dcinside-login.service'
import { CookieService } from '../util/cookie.service'
import { DcinsidePostSchema } from './api/dto/dcinside-post.schema'
import { PostJobToParamsSchema } from './api/dto/post-job.schema'
import type { Browser, Page } from 'puppeteer-core'

interface PostQueueItem {
  id: string
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
    private readonly jobLogsService: JobLogsService,
    private readonly postingService: DcinsidePostingService,
    private readonly settingsService: SettingsService,
    private readonly dcinsideLoginService: DcinsideLoginService,
    private readonly cookieService: CookieService,
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
    try {
      const appSettings = await this.getAppSettings()

      // 1단계: PostJob 객체 검증 및 기본 변환
      const baseParams = PostJobToParamsSchema.parse(job)

      // 2단계: headless 설정 추가하여 최종 파라미터 구성
      const finalParams = {
        ...baseParams,
        headless: !appSettings.showBrowserWindow, // 창보임 설정의 반대가 headless
      }

      // 3단계: 최종 DcinsidePostSchema로 검증
      return DcinsidePostSchema.parse(finalParams)
    } catch (error) {
      if (error instanceof ZodError) {
        const zodErrors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        throw new Error(`작업 파라미터 검증 실패: ${zodErrors.join(', ')}`)
      }
      throw new Error(`작업 파라미터 검증 실패: ${error.message}`)
    }
  }

  /**
   * 브라우저별 로그인 처리 (브라우저 생성 직후 한 번만 실행)
   */
  private async handleBrowserLogin(browser: Browser, loginId: string, loginPassword: string): Promise<void> {
    this.logger.log(`로그인 처리 시작: ${loginId}`)

    const page: Page = await this.browserManager.getOrCreatePage(browser)

    // 브라우저 생성 직후 쿠키 로드 및 적용
    const cookies = this.cookieService.loadCookies('dcinside', loginId)

    // 쿠키가 있으면 먼저 적용해보기
    if (cookies && cookies.length > 0) {
      this.logger.log('저장된 쿠키를 브라우저에 적용합니다.')
      await browser.setCookie(...cookies)
    }

    // 로그인 상태 확인
    const isLoggedIn = await this.dcinsideLoginService.isLogin(page)

    if (!isLoggedIn) {
      // 로그인이 안되어 있으면 로그인 실행
      if (!loginPassword) {
        throw new Error('로그인이 필요하지만 로그인 패스워드가 제공되지 않았습니다.')
      }

      this.logger.log('로그인이 필요합니다. 자동 로그인을 시작합니다.')
      const loginResult = await this.dcinsideLoginService.loginWithPage(page, {
        id: loginId,
        password: loginPassword,
      })

      if (!loginResult.success) {
        throw new Error(`자동 로그인 실패: ${loginResult.message}`)
      }

      // 로그인 성공 후 새로운 쿠키 저장
      const newCookies = await browser.cookies()
      this.cookieService.saveCookies('dcinside', loginId, newCookies)
      this.logger.log('로그인 성공 후 쿠키를 저장했습니다.')
    } else {
      this.logger.log('기존 쿠키로 로그인 상태가 유지되고 있습니다.')
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

    // 브라우저별 로그인 처리 완료 여부 추적
    const browserLoginCompleted = new Set<string>()

    try {
      // 큐에서 순서대로 하나씩 처리
      while (this.postQueue.length > 0) {
        const queueItem = this.postQueue.shift()!

        try {
          this.logger.log(`작업 시작: ID ${queueItem.id} (브라우저: ${queueItem.browserId})`)
          await this.jobLogsService.createJobLog(queueItem.id, '작업 시작')

          // 해당 브라우저 가져오기 또는 생성
          const browser = await this.browserManager.getOrCreateBrowser(queueItem.browserId, {
            headless: !appSettings.showBrowserWindow,
          })
          await this.jobLogsService.createJobLog(queueItem.id, `브라우저 생성 완료 (${queueItem.browserId})`)

          // 해당 브라우저에서 로그인이 아직 처리되지 않았다면 로그인 처리
          if (!browserLoginCompleted.has(queueItem.browserId)) {
            if (queueItem.params.loginId && queueItem.params.loginPassword) {
              await this.jobLogsService.createJobLog(queueItem.id, `로그인 시도: ${queueItem.params.loginId}`)
              await this.handleBrowserLogin(browser, queueItem.params.loginId, queueItem.params.loginPassword)
              await this.jobLogsService.createJobLog(queueItem.id, '로그인 성공')
            } else if (queueItem.params.loginId) {
              this.logger.log(`비로그인 모드로 진행: ${queueItem.browserId}`)
              await this.jobLogsService.createJobLog(queueItem.id, '비로그인 모드로 진행')
            } else {
              this.logger.log(`비로그인 모드로 진행: ${queueItem.browserId}`)
              await this.jobLogsService.createJobLog(queueItem.id, '비로그인 모드로 진행')
            }
            browserLoginCompleted.add(queueItem.browserId)
          }

          // 작업 처리
          await this.jobLogsService.createJobLog(queueItem.id, '포스팅 시작')
          const result = await this.postingService.postArticle(queueItem.params, browser, queueItem.id)
          await this.postJobService.updateStatusWithUrl(queueItem.id, 'completed', result.message, result.url)
          await this.jobLogsService.createJobLog(queueItem.id, `포스팅 완료: ${result.url}`)

          this.logger.log(`작업 완료: ID ${queueItem.id}, URL: ${result.url}`)

          // 해당 브라우저의 남은 작업 수 감소
          browserJobCounts.set(queueItem.browserId, browserJobCounts.get(queueItem.browserId)! - 1)

          // 해당 브라우저의 마지막 작업이면 브라우저 종료
          if (browserJobCounts.get(queueItem.browserId) === 0) {
            await this.browserManager.closeManagedBrowser(queueItem.browserId)
            await this.jobLogsService.createJobLog(queueItem.id, '브라우저 종료')
          }
        } catch (error) {
          await this.postJobService.updateStatus(queueItem.id, 'failed', error.message)
          await this.jobLogsService.createJobLog(queueItem.id, `작업 실패: ${error.message}`)
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
