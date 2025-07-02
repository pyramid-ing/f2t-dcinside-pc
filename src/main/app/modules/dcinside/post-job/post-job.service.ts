import { PrismaService } from '@main/app/shared/prisma.service'
import { Injectable, Logger } from '@nestjs/common'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { DcinsidePostingService } from '@main/app/modules/dcinside/api/dcinside-posting.service'
import { AppSettings, SettingsService } from '@main/app/modules/settings/settings.service'
import { CookieService } from '@main/app/modules/util/cookie.service'
import { BrowserContext, Page } from 'playwright'
import { PostJob } from '@prisma/client'
import _ from 'lodash'
import { sleep } from '@main/app/utils/sleep'

@Injectable()
export class PostJobService {
  private readonly logger = new Logger(PostJobService.name)

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jobLogsService: JobLogsService,
    private readonly postingService: DcinsidePostingService,
    private readonly settingsService: SettingsService,
    private readonly cookieService: CookieService,
  ) {}

  // 예약 작업 목록 조회 (최신 업데이트가 위로 오게 정렬)
  async getPostJobs(options?: { status?: string; search?: string; orderBy?: string; order?: 'asc' | 'desc' }) {
    const where: any = {}

    // 상태 필터
    if (options?.status) {
      where.status = options.status
    }

    // 검색 필터 (제목, 갤러리URL, 말머리에서 검색)
    if (options?.search) {
      where.OR = [
        { title: { contains: options.search } },
        { galleryUrl: { contains: options.search } },
        { headtext: { contains: options.search } },
        { resultMsg: { contains: options.search } },
      ]
    }

    // 정렬 설정
    const orderBy: any = {}
    const sortField = options?.orderBy || 'updatedAt'
    const sortOrder = options?.order || 'desc'
    orderBy[sortField] = sortOrder

    return this.prismaService.postJob.findMany({
      where,
      orderBy,
    })
  }

  // 예약 작업 상태/결과 갱신
  async updateStatus(id: string, status: string, resultMsg?: string) {
    return this.prismaService.postJob.update({
      where: { id },
      data: { status, resultMsg },
    })
  }

  // 예약 작업 상태/결과/URL 갱신 (포스팅 완료 시 사용)
  async updateStatusWithUrl(id: string, status: string, resultMsg?: string, resultUrl?: string) {
    return this.prismaService.postJob.update({
      where: { id },
      data: { status, resultMsg, resultUrl },
    })
  }

  // 특정 상태인 작업들 조회
  async findByStatus(status: string) {
    return this.prismaService.postJob.findMany({
      where: { status },
      orderBy: { scheduledAt: 'asc' },
    })
  }

  // 실패한 작업 재시도 (상태를 pending으로 변경)
  async retryPostJob(id: string) {
    const job = await this.prismaService.postJob.findUnique({ where: { id } })

    if (!job) {
      return { success: false, message: '작업을 찾을 수 없습니다.' }
    }

    if (job.status !== 'failed') {
      return { success: false, message: '실패한 작업만 재시도할 수 있습니다.' }
    }

    await this.prismaService.postJob.update({
      where: { id },
      data: {
        status: 'pending',
        resultMsg: null,
        resultUrl: null,
      },
    })

    return { success: true, message: '재시도 요청이 완료되었습니다.' }
  }

  // 작업 삭제
  async deletePostJob(id: string) {
    const job = await this.prismaService.postJob.findUnique({ where: { id } })

    if (!job) {
      return { success: false, message: '작업을 찾을 수 없습니다.' }
    }

    if (job.status === 'processing') {
      return { success: false, message: '실행 중인 작업은 삭제할 수 없습니다.' }
    }

    await this.prismaService.postJob.delete({ where: { id } })

    return { success: true, message: '작업이 삭제되었습니다.' }
  }

  private async getAppSettings(): Promise<{ showBrowserWindow: boolean; taskDelay: number }> {
    try {
      const setting = await this.settingsService.findByKey('app')
      const data = setting?.data as unknown as AppSettings
      return {
        showBrowserWindow: data?.showBrowserWindow ?? true,
        taskDelay: data?.taskDelay ?? 10,
      }
    } catch {
      return { showBrowserWindow: true, taskDelay: 10 }
    }
  }

  /**
   * 브라우저별 로그인 처리 (브라우저 생성 직후 한 번만 실행)
   */
  private async handleBrowserLogin(
    browserContext: BrowserContext,
    page: Page,
    loginId: string,
    loginPassword: string,
  ): Promise<void> {
    this.logger.log(`로그인 처리 시작: ${loginId}`)

    // 브라우저 생성 직후 쿠키 로드 및 적용
    const cookies = this.cookieService.loadCookies('dcinside', loginId)

    // 쿠키가 있으면 먼저 적용해보기
    if (cookies && cookies.length > 0) {
      this.logger.log('저장된 쿠키를 브라우저에 적용합니다.')
      await browserContext.addCookies(cookies)
    }

    // 로그인 상태 확인
    const isLoggedIn = await this.postingService.isLogin(page)

    if (!isLoggedIn) {
      // 로그인이 안되어 있으면 로그인 실행
      if (!loginPassword) {
        throw new Error('로그인이 필요하지만 로그인 패스워드가 제공되지 않았습니다.')
      }

      this.logger.log('로그인이 필요합니다. 자동 로그인을 시작합니다.')
      const loginResult = await this.postingService.login(page, {
        id: loginId,
        password: loginPassword,
      })

      if (!loginResult.success) {
        throw new Error(`자동 로그인 실패: ${loginResult.message}`)
      }

      // 로그인 성공 후 새로운 쿠키 저장
      const newCookies = await browserContext.cookies()
      this.cookieService.saveCookies('dcinside', loginId, newCookies)
      this.logger.log('로그인 성공 후 쿠키를 저장했습니다.')
    } else {
      this.logger.log('기존 쿠키로 로그인 상태가 유지되고 있습니다.')
    }
  }

  async processPostJobs(): Promise<void> {
    const postJobs = await this.prismaService.postJob.findMany({
      where: {
        status: 'pending',
        scheduledAt: {
          lte: new Date(),
        },
      },
    })
    await this.prismaService.postJob.updateMany({
      where: {
        id: {
          in: postJobs.map(postJob => postJob.id),
        },
      },
      data: {
        status: 'processing',
      },
    })
    const appSettings = await this.getAppSettings()

    const groupedPostJobs = _.groupBy(postJobs, postJob => postJob.loginId)
    for (const loginId in groupedPostJobs) {
      const { browser, context } = await this.postingService.launch(!appSettings.showBrowserWindow)
      try {
        const postJobs = groupedPostJobs[loginId]

        for (const postJob of postJobs) {
          await this.handlePostJob(context, postJob)

          // 작업 간 딜레이
          this.logger.log(`작업 간 딜레이: ${appSettings.taskDelay}초`)
          await sleep(appSettings.taskDelay * 1000)
        }
      } catch (error) {
        await this.prismaService.postJob.updateMany({
          where: {
            id: {
              in: postJobs.map(postJob => postJob.id),
            },
          },
          data: {
            status: 'failed',
            resultMsg: error.message,
          },
        })
      } finally {
        await browser.close()
      }
    }
  }

  /**
   * 큐 처리 (엑셀 순서대로, 세션별 브라우저 관리)
   */
  async handlePostJob(context: BrowserContext, postJob: PostJob) {
    const page = await context.newPage()

    try {
      this.logger.log(`작업 시작: ID ${postJob.id})`)
      await this.jobLogsService.createJobLog(postJob.id, '작업 시작')

      // 해당 브라우저에서 로그인이 아직 처리되지 않았다면 로그인 처리
      if (postJob.loginId && postJob.loginPassword) {
        await this.jobLogsService.createJobLog(postJob.id, `로그인 시도: ${postJob.loginId}`)
        await this.handleBrowserLogin(context, page, postJob.loginId, postJob.loginPassword)
        await this.jobLogsService.createJobLog(postJob.id, '로그인 성공')
      } else {
        this.logger.log(`비로그인 모드로 진행`)
        await this.jobLogsService.createJobLog(postJob.id, '비로그인 모드로 진행')
      }

      // 작업 처리
      await this.jobLogsService.createJobLog(postJob.id, '포스팅 시작')
      const result = await this.postingService.postArticle(postJob, context, page, postJob.id)
      await this.updateStatusWithUrl(postJob.id, 'completed', result.message, result.url)
      await this.jobLogsService.createJobLog(postJob.id, `포스팅 완료: ${result.url}`)

      this.logger.log(`작업 완료: ID ${postJob.id}, URL: ${result.url}`)
    } catch (error) {
      await this.updateStatus(postJob.id, 'failed', error.message)
      await this.jobLogsService.createJobLog(postJob.id, `작업 실패: ${error.message}`)
      this.logger.error(`작업 실패: ID ${postJob.id} - ${error.message}`)
    } finally {
      await page.close()
    }
  }
}
