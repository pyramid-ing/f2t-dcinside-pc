import { Injectable, Logger } from '@nestjs/common'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { DcinsidePostingService } from '@main/app/modules/dcinside/posting/dcinside-posting.service'
import { BrowserContext, Page } from 'playwright'
import { Job, PostJob } from '@prisma/client'
import { sleep } from '@main/app/utils/sleep'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobProcessor, JobStatus, JobType } from '@main/app/modules/dcinside/job/job.types'
import { getExternalIp } from '@main/app/utils/ip'
import { TetheringService } from '@main/app/modules/util/tethering.service'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { Permission } from '@main/app/modules/auth/auth.guard'
import { assertPermission } from '@main/app/utils/permission.assert'
import { IpMode, Settings } from '@main/app/modules/settings/settings.types'
import { BrowserManagerService } from '@main/app/modules/util/browser-manager.service'
import { ErrorCodeMap } from '@main/common/errors/error-code.map'

@Injectable()
export class PostJobService implements JobProcessor {
  private readonly logger = new Logger(PostJobService.name)

  // 브라우저 ID 상수
  private static readonly BROWSER_IDS = {
    DCINSIDE_REUSE: 'dcinside',
    POST_JOB_NEW: (jobId: string) => `post-job-new-${jobId}`,
    PROXY: 'dcinside-posting-proxy',
    FALLBACK: 'dcinside-posting-fallback',
  } as const

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jobLogsService: JobLogsService,
    private readonly postingService: DcinsidePostingService,
    private readonly settingsService: SettingsService,
    private readonly tetheringService: TetheringService,
    private readonly browserManager: BrowserManagerService,
  ) {}

  canProcess(job: any): boolean {
    return job.type === JobType.POST
  }

  async processPostingJob(job: Job) {
    const processor = this
    if (!processor || !processor.canProcess(job)) {
      this.logger.error(`No valid processor for job type ${job.type}`)
      await this.markJobAsStatus(job.id, JobStatus.FAILED, `해당 작업 타입이 없습니다. ${job.type}`)
      return
    }

    try {
      const updateResult = await this.prismaService.job.updateMany({
        where: {
          id: job.id,
          status: JobStatus.REQUEST, // 이 조건이 중복 처리를 방지합니다
        },
        data: {
          status: JobStatus.PROCESSING,
          startedAt: new Date(),
        },
      })

      // 다른 프로세스가 이미 처리 중인 경우 건너뛰기
      if (updateResult.count === 0) {
        this.logger.debug(`Job ${job.id} is already being processed by another instance`)
        return
      }

      this.logger.debug(`Starting job ${job.id} (${job.type})`)

      await processor.process(job.id)

      await this.prismaService.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
        },
      })

      this.logger.debug(`Completed job ${job.id}`)
    } catch (error) {
      // ErrorCodeMap에서 매핑
      let logMessage = `작업 처리 중 오류 발생: ${error.message}`
      if (error instanceof CustomHttpException) {
        const mapped = ErrorCodeMap[error.errorCode]
        if (mapped) {
          logMessage = `작업 처리 중 오류 발생: ${mapped.message(error.metadata)}`
        }
      }
      await this.jobLogsService.createJobLog(job.id, logMessage, 'error')
      this.logger.error(logMessage, error.stack)
      await this.markJobAsStatus(job.id, JobStatus.FAILED, error.message)
    }
  }

  /**
   * 게시글 삭제 작업 처리 (DELETE_REQUEST 상태인 작업용)
   */
  async processDeleteJob(job: any): Promise<void> {
    if (!job.postJob?.resultUrl) {
      throw new Error('삭제할 게시글의 URL이 없습니다.')
    }

    try {
      // 삭제 시작 - DELETE_PROCESSING 상태로 변경
      await this.prismaService.job.updateMany({
        where: {
          id: job.id,
          status: JobStatus.DELETE_REQUEST, // DELETE_REQUEST 상태인 것만 처리
        },
        data: {
          status: JobStatus.DELETE_PROCESSING,
        },
      })

      this.logger.log(`게시글 삭제 시작: ${job.postJob.resultUrl}`)
      await this.jobLogsService.createJobLog(job.id, `게시글 삭제 시작: ${job.postJob.resultUrl}`)

      // 통합된 삭제 로직 호출
      await this.postingService.deleteArticleByResultUrl(job.postJob, job.id, this.browserManager)

      // 삭제 성공 시 원본 작업의 deletedAt 업데이트
      await this.prismaService.postJob.update({
        where: { id: job.postJob.id },
        data: { deletedAt: new Date() },
      })

      await this.markJobAsStatus(job.id, JobStatus.DELETE_COMPLETED)

      this.logger.log(`게시글 삭제 완료: ${job.postJob.resultUrl}`)
    } catch (error) {
      // ErrorCodeMap에서 매핑
      let logMessage = `작업 처리 중 오류 발생: ${error.message}`
      if (error instanceof CustomHttpException) {
        const mapped = ErrorCodeMap[error.errorCode]
        if (mapped) {
          logMessage = `작업 처리 중 오류 발생: ${mapped.message(error.metadata)}`
        }
      }
      await this.jobLogsService.createJobLog(job.id, logMessage, 'error')
      this.logger.error(logMessage, error.stack)

      await this.markJobAsStatus(job.id, JobStatus.DELETE_FAILED, `삭제 실패: ${error.message}`)
    }
  }

  async markJobAsStatus(jobId: string, status: JobStatus, errorMsg?: string) {
    await this.prismaService.job.update({
      where: { id: jobId },
      data: {
        status,
        errorMsg,
        completedAt: new Date(),
      },
    })
  }

  async process(jobId: string): Promise<void> {
    const job = await this.prismaService.job.findUniqueOrThrow({
      where: { id: jobId },
      include: {
        postJob: true,
      },
    })

    const settings = await this.settingsService.getSettings()

    // IP 모드에 따른 처리
    switch (settings?.ipMode) {
      case IpMode.TETHERING:
        await this.handleTetheringMode(jobId, settings)
        // 테더링 후 브라우저 재사용/신규 생성 분기
        if (settings.reuseWindowBetweenTasks) {
          await this.handleBrowserReuseMode(jobId, settings, job.postJob)
        } else {
          await this.handleBrowserNewMode(jobId, settings, job.postJob)
        }
        break

      case IpMode.PROXY:
        await this.handleProxyMode(jobId, settings, job.postJob)
        break

      case IpMode.NONE:
      default:
        // IP 변경 없음 - 브라우저 재사용/신규 생성 분기
        if (settings.reuseWindowBetweenTasks) {
          await this.handleBrowserReuseMode(jobId, settings, job.postJob)
        } else {
          await this.handleBrowserNewMode(jobId, settings, job.postJob)
        }
        break
    }
  }
  private async checkPermission(permission: Permission): Promise<void> {
    const settings = await this.settingsService.getSettings()
    const licenseCache = settings.licenseCache
    assertPermission(licenseCache, permission)
  }

  /**
   * 테더링 모드 처리
   */
  private async handleTetheringMode(jobId: string, settings: Settings): Promise<void> {
    await this.checkPermission(Permission.TETHERING)

    // IP 변경이 필요한지 확인
    const shouldChange = this.tetheringService.shouldChangeIp(settings?.tethering?.changeInterval)

    if (shouldChange) {
      try {
        const prev = this.tetheringService.getCurrentIp()
        await this.jobLogsService.createJobLog(jobId, `테더링 전 현재 IP: ${prev.ip || '조회 실패'}`)
        const changed = await this.tetheringService.checkIpChanged(prev)
        await this.jobLogsService.createJobLog(jobId, `테더링으로 IP 변경됨: ${prev.ip} → ${changed.ip}`)
      } catch (e: any) {
        await this.jobLogsService.createJobLog(jobId, `테더링 IP 변경 실패: ${e?.message || e}`)
        throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, { message: '테더링 IP 변경 실패' })
      }
    } else {
      await this.jobLogsService.createJobLog(jobId, `테더링 IP 변경 주기에 따라 변경하지 않음`)
    }
  }

  /**
   * 프록시 모드 처리
   */
  private async handleProxyMode(jobId: string, settings: Settings, postJob: PostJob): Promise<void> {
    const { browser, context, page, proxyInfo } = await this.postingService.launch({
      browserId: PostJobService.BROWSER_IDS.POST_JOB_NEW(jobId),
      headless: !settings.showBrowserWindow,
      reuseExisting: settings.reuseWindowBetweenTasks,
      respectProxy: true,
    })

    try {
      // 로그인 처리 (launch 직후)
      if (postJob.loginId && postJob.loginPassword) {
        await this.jobLogsService.createJobLog(jobId, `로그인 시도: ${postJob.loginId}`)
        await this.postingService.handleBrowserLogin(context, page, postJob.loginId, postJob.loginPassword)
        await this.jobLogsService.createJobLog(jobId, '로그인 성공')
      } else {
        await this.jobLogsService.createJobLog(jobId, '비로그인 모드로 진행')
      }

      // 프록시 정보 로깅
      if (proxyInfo) {
        const proxyStr = proxyInfo.id
          ? `${proxyInfo.id}@${proxyInfo.ip}:${proxyInfo.port}`
          : `${proxyInfo.ip}:${proxyInfo.port}`
        await this.jobLogsService.createJobLog(jobId, `프록시 적용: ${proxyStr}`)
      } else {
        await this.jobLogsService.createJobLog(jobId, '프록시 미적용')
      }

      // 실제 외부 IP 로깅 (별도 페이지 사용 후 닫기)
      await this.logExternalIp(jobId, page)

      await this.applyTaskDelay(jobId, settings)

      // 페이지는 launch에서 공통 생성됨
      await this.handlePostJob(jobId, context, page, postJob)
    } finally {
      // 새 창 모드일 때만 브라우저 종료
      if (!settings.reuseWindowBetweenTasks) {
        try {
          await this.browserManager.closeManagedBrowser(PostJobService.BROWSER_IDS.POST_JOB_NEW(jobId))
          await this.jobLogsService.createJobLog(jobId, '브라우저 창 종료 완료')
        } catch (error) {
          this.logger.warn(`브라우저 종료 중 오류: ${error.message}`)
        }
      }
    }
  }

  /**
   * 브라우저 재사용 모드 처리
   */
  private async handleBrowserReuseMode(jobId: string, settings: Settings, postJob: PostJob): Promise<void> {
    const { context, page } = await this.postingService.launch({
      browserId: PostJobService.BROWSER_IDS.DCINSIDE_REUSE,
      headless: !settings.showBrowserWindow,
      reuseExisting: true,
      respectProxy: false,
    })

    // 로그인 처리 (launch 직후)
    if (postJob.loginId && postJob.loginPassword) {
      await this.jobLogsService.createJobLog(jobId, `로그인 시도: ${postJob.loginId}`)
      await this.postingService.handleBrowserLogin(context, page, postJob.loginId, postJob.loginPassword)
      await this.jobLogsService.createJobLog(jobId, '로그인 성공')
    } else {
      await this.jobLogsService.createJobLog(jobId, '비로그인 모드로 진행')
    }

    // 실제 외부 IP 로깅: 동일 페이지에서 이동하여 조회
    await this.logExternalIp(jobId, page)

    await this.applyTaskDelay(jobId, settings)

    await this.handlePostJob(jobId, context, page, postJob)
  }

  /**
   * 브라우저 신규 생성 모드 처리
   */
  private async handleBrowserNewMode(jobId: string, settings: Settings, postJob: PostJob): Promise<void> {
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      const launched = await this.postingService.launch({
        browserId: PostJobService.BROWSER_IDS.POST_JOB_NEW(jobId),
        headless: !settings.showBrowserWindow,
        reuseExisting: false,
        respectProxy: false,
      })
      context = launched.context
      page = launched.page

      // 로그인 처리 (launch 직후)
      if (postJob.loginId && postJob.loginPassword) {
        await this.jobLogsService.createJobLog(jobId, `로그인 시도: ${postJob.loginId}`)
        await this.postingService.handleBrowserLogin(context, page, postJob.loginId, postJob.loginPassword)
        await this.jobLogsService.createJobLog(jobId, '로그인 성공')
      } else {
        await this.jobLogsService.createJobLog(jobId, '비로그인 모드로 진행')
      }

      // 실제 외부 IP 로깅: 동일 페이지에서 이동하여 조회
      await this.logExternalIp(jobId, page)

      await this.applyTaskDelay(jobId, settings)

      // 포스팅 처리
      await this.handlePostJob(jobId, context, page, postJob)
    } finally {
      // 작업 완료 후 브라우저 종료 (등록 전용 브라우저)
      await this.browserManager.closeManagedBrowser(PostJobService.BROWSER_IDS.POST_JOB_NEW(jobId))
    }
  }

  /**
   * 외부 IP 로깅
   */
  private async logExternalIp(jobId: string, target: Page): Promise<void> {
    try {
      const externalIp = await getExternalIp(target)

      await this.jobLogsService.createJobLog(jobId, `실제 외부 IP: ${externalIp}`)
    } catch (e) {
      await this.jobLogsService.createJobLog(jobId, `외부 IP 조회 실패: ${e instanceof Error ? e.message : e}`)
    }
  }

  /**
   * 작업 간 딜레이 적용
   */
  private async applyTaskDelay(jobId: string, settings: Settings): Promise<void> {
    if (settings?.taskDelay > 0) {
      await this.jobLogsService.createJobLog(jobId, `작업 간 딜레이: ${settings.taskDelay}초`)
      await sleep(settings.taskDelay * 1000)
    }
  }

  /**
   * 큐 처리 (엑셀 순서대로, 세션별 브라우저 관리)
   */
  async handlePostJob(jobId: string, context: BrowserContext, page: Page, postJob: PostJob) {
    this.logger.log(`작업 시작: ID ${jobId})`)
    await this.jobLogsService.createJobLog(jobId, '작업 시작')

    // 로그인 처리 및 회원/비회원 여부 판정
    let isMember = false
    if (postJob.loginId && postJob.loginPassword) {
      await this.jobLogsService.createJobLog(jobId, `로그인 시도: ${postJob.loginId}`)
      await this.postingService.handleBrowserLogin(context, page, postJob.loginId, postJob.loginPassword)
      await this.jobLogsService.createJobLog(jobId, '로그인 성공')
      isMember = true
    } else {
      this.logger.log(`비로그인 모드로 진행`)
      await this.jobLogsService.createJobLog(jobId, '비로그인 모드로 진행')
    }

    // 작업 처리
    await this.jobLogsService.createJobLog(jobId, '포스팅 시작')
    const result = await this.postingService.postArticle(postJob, context, page, jobId, isMember)

    await this.jobLogsService.createJobLog(jobId, `포스팅 완료: ${result.url}`)

    // 포스팅 성공 시 resultUrl을 PostJob에 저장
    if (result.url) {
      const updateData: any = { resultUrl: result.url }

      // autoDeleteMinutes가 설정되어 있으면 deleteAt 계산 (현재시간 기준)
      const autoDeleteMinutes = postJob.autoDeleteMinutes
      if (autoDeleteMinutes && autoDeleteMinutes > 0) {
        const now = new Date()
        const deleteAt = new Date(now.getTime() + autoDeleteMinutes * 60 * 1000)
        updateData.deleteAt = deleteAt
        await this.jobLogsService.createJobLog(
          jobId,
          `등록후자동삭제 설정: ${autoDeleteMinutes}분 후 (${deleteAt.toLocaleString()})`,
        )
      }

      await this.prismaService.postJob.update({
        where: { id: postJob.id },
        data: updateData,
      })

      // 테더링 모드에서 포스팅 수 카운트 증가
      const settings = await this.settingsService.getSettings()
      if (settings?.ipMode === IpMode.TETHERING) {
        this.tetheringService.onPostCompleted()
      }
    }

    return result
  }

  // 예약 작업 목록 조회 (최신 업데이트가 위로 오게 정렬)
  async getPostJobs(options?: { search?: string; orderBy?: string; order?: 'asc' | 'desc' }) {
    const where: any = {}

    // 검색 필터 (제목, 갤러리URL, 말머리에서 검색)
    if (options?.search) {
      where.OR = [
        { title: { contains: options.search } },
        { galleryUrl: { contains: options.search } },
        { headtext: { contains: options.search } },
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

  // PostJob 단일 조회, 생성, 수정, 삭제 등 포스팅 데이터만 관리
  async getPostJobById(id: string) {
    return this.prismaService.postJob.findUnique({ where: { id } })
  }

  async createPostJob(data: Omit<PostJob, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.prismaService.postJob.create({ data })
  }

  async updatePostJob(id: string, data: Partial<Omit<PostJob, 'id' | 'createdAt' | 'updatedAt'>>) {
    return this.prismaService.postJob.update({ where: { id }, data })
  }

  async deletePostJob(id: string) {
    return this.prismaService.postJob.delete({ where: { id } })
  }

  /**
   * Job + PostJob을 1:1로 생성하는 메서드
   */
  async createJobWithPostJob(postJobData: {
    galleryUrl: string
    title: string
    contentHtml: string
    password?: string
    nickname?: string
    headtext?: string
    imagePaths?: string
    loginId?: string
    loginPassword?: string
    scheduledAt?: Date
    imagePosition?: string
    resultUrl?: string
    deleteAt?: Date
    autoDeleteMinutes?: number
  }) {
    const job = await this.prismaService.job.create({
      data: {
        type: JobType.POST,
        subject: `[${postJobData.galleryUrl}] ${postJobData.title}`,
        status: JobStatus.PENDING,
        scheduledAt: postJobData.scheduledAt || new Date(),
        postJob: {
          create: {
            galleryUrl: postJobData.galleryUrl,
            title: postJobData.title,
            contentHtml: postJobData.contentHtml,
            password: postJobData.password ?? null,
            nickname: postJobData.nickname ?? null,
            headtext: postJobData.headtext ?? null,
            imagePaths: postJobData.imagePaths ?? null,
            loginId: postJobData.loginId ?? null,
            loginPassword: postJobData.loginPassword ?? null,
            imagePosition: postJobData.imagePosition ?? null,
            ...(postJobData.resultUrl !== undefined && { resultUrl: postJobData.resultUrl }),
            ...(postJobData.deleteAt !== undefined && { deleteAt: postJobData.deleteAt }),
            ...(postJobData.autoDeleteMinutes !== undefined && { autoDeleteMinutes: postJobData.autoDeleteMinutes }),
          },
        },
      },
      select: {
        id: true,
        postJob: { select: { id: true } },
      },
    })
    return job
  }
}
