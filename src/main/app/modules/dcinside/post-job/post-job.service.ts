import { Injectable, Logger } from '@nestjs/common'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { DcinsidePostingService } from '@main/app/modules/dcinside/api/dcinside-posting.service'
import { CookieService } from '@main/app/modules/util/cookie.service'
import { BrowserContext, Page } from 'playwright'
import { PostJob } from '@prisma/client'
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
import UserAgent from 'user-agents'

@Injectable()
export class PostJobService implements JobProcessor {
  private readonly logger = new Logger(PostJobService.name)

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jobLogsService: JobLogsService,
    private readonly postingService: DcinsidePostingService,
    private readonly settingsService: SettingsService,
    private readonly cookieService: CookieService,
    private readonly tetheringService: TetheringService,
    private readonly browserManager: BrowserManagerService,
  ) {}

  canProcess(job: any): boolean {
    return job.type === JobType.POST
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
        await this.handleBrowserReuseMode(jobId, settings, job.postJob)
        break

      case IpMode.PROXY:
        await this.handleProxyMode(jobId, settings, job.postJob)
        break

      case IpMode.NONE:
      default:
        await this.handleBrowserReuseMode(jobId, settings, job.postJob)
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
    const { browser, context, proxyInfo } = await this.postingService.launch()

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
    await this.logExternalIp(jobId, context, true)

    try {
      await this.applyTaskDelay(jobId, settings)

      // 프록시 모드는 매 작업마다 새 페이지 생성/종료 (기존 동작 유지)
      const page = await context.newPage()
      try {
        await this.handlePostJob(jobId, context, page, postJob)
      } finally {
        await page.close()
      }
    } catch (error) {
      throw error
    } finally {
      await browser.close()
    }
  }

  /**
   * 브라우저 재사용 모드 처리 (테더링/NONE 모드)
   */
  private async handleBrowserReuseMode(jobId: string, settings: Settings, postJob: PostJob): Promise<void> {
    const browser = await this.browserManager.getOrCreateBrowser('dcinside', {
      headless: !settings.showBrowserWindow,
    })

    let context = browser.contexts()[0]
    if (!context) {
      context = await browser.newContext({
        viewport: { width: 1200, height: 1142 },
        userAgent: new UserAgent({ deviceCategory: 'desktop' }).toString(),
      })
      await context.addInitScript(() => {
        window.sessionStorage.clear()
      })
    }

    // 동일 컨텍스트의 첫 페이지 재사용, 없으면 해당 컨텍스트에서 생성
    let page = context.pages()[0]
    if (!page) {
      page = await context.newPage()
    }

    // 실제 외부 IP 로깅: 동일 페이지에서 이동하여 조회
    await this.logExternalIp(jobId, page, false)

    await this.applyTaskDelay(jobId, settings)

    // 동일 페이지에서 포스팅 처리 (페이지 종료/브라우저 종료 없음)
    await this.handlePostJob(jobId, context, page, postJob)
  }

  /**
   * 외부 IP 로깅
   */
  private async logExternalIp(jobId: string, target: any, useNewPage: boolean): Promise<void> {
    try {
      let externalIp: string

      if (useNewPage) {
        // 프록시 모드: 별도 페이지 사용 후 닫기
        const ipCheckPage = await target.newPage()
        externalIp = await getExternalIp(ipCheckPage)
        await ipCheckPage.close()
      } else {
        // 테더링/NONE 모드: 동일 페이지에서 이동하여 조회
        externalIp = await getExternalIp(target)
      }

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
      await this.handleBrowserLogin(context, page, postJob.loginId, postJob.loginPassword)
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
      const autoDeleteMinutes = (postJob as any).autoDeleteMinutes
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
   * 예약된 삭제 처리: 완료된 게시글 중 deleteAt 시간이 된 것들을 삭제
   */
  async processScheduledDeletions() {
    const now = new Date()

    // 완료된 게시글 중 삭제 예정시간이 지난 것들을 찾기
    const jobsToDelete = await this.prismaService.job.findMany({
      where: {
        type: JobType.POST,
        status: JobStatus.COMPLETED,
        postJob: {
          deleteAt: {
            lte: now, // 현재 시간보다 이전
          },
          deletedAt: null, // 아직 삭제되지 않음
          resultUrl: {
            not: null, // 결과 URL이 있어야 삭제 가능
          },
        },
      },
      include: {
        postJob: true,
      },
    })

    this.logger.log(`예약된 삭제 대상 작업 ${jobsToDelete.length}개 발견`)

    // 각 작업에 대해 삭제 처리
    for (const job of jobsToDelete) {
      try {
        await this.jobLogsService.createJobLog(job.id, `예약된 삭제 시간 도달: ${job.postJob!.deleteAt}`)
        await this.processDeleteJob(job)
        this.logger.log(`게시글 삭제 완료: ${job.id}`)
      } catch (error) {
        this.logger.error(`게시글 삭제 실패: ${job.id}`, error)
      }
    }
  }

  /**
   * 게시글 삭제 작업 처리
   */
  private async processDeleteJob(job: any): Promise<void> {
    if (!job.postJob?.resultUrl) {
      throw new Error('삭제할 게시글의 URL이 없습니다.')
    }

    this.logger.log(`게시글 삭제 시작: ${job.postJob.resultUrl}`)
    await this.jobLogsService.createJobLog(job.id, `게시글 삭제 시작: ${job.postJob.resultUrl}`)

    try {
      // 브라우저 실행
      const { browser, context } = await this.postingService.launch()
      const page = await context.newPage()

      try {
        // 로그인 처리
        if (job.postJob.loginId && job.postJob.loginPassword) {
          await this.handleBrowserLogin(context, page, job.postJob.loginId, job.postJob.loginPassword)
        }

        // 게시글 삭제 실행
        await this.postingService.deleteArticleByResultUrl(job.postJob, page, job.id, !!job.postJob.loginId)

        // 삭제 성공 시 원본 작업의 deletedAt 업데이트
        await this.prismaService.postJob.update({
          where: { id: job.postJob.id },
          data: { deletedAt: new Date() },
        })

        await this.jobLogsService.createJobLog(job.id, '게시글 삭제 완료')
        this.logger.log(`게시글 삭제 완료: ${job.postJob.resultUrl}`)
      } finally {
        await browser.close()
      }
    } catch (error) {
      const errorMessage = `게시글 삭제 실패: ${error.message}`
      await this.jobLogsService.createJobLog(job.id, errorMessage, 'error')
      this.logger.error(errorMessage, error.stack)
      throw error
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
        throw new CustomHttpException(ErrorCode.AUTH_REQUIRED, {
          message: '로그인이 필요하지만 로그인 패스워드가 제공되지 않았습니다.',
        })
      }

      this.logger.log('로그인이 필요합니다. 자동 로그인을 시작합니다.')
      const loginResult = await this.postingService.login(page, {
        id: loginId,
        password: loginPassword,
      })

      if (!loginResult.success) {
        throw new CustomHttpException(ErrorCode.AUTH_REQUIRED, { message: `자동 로그인 실패: ${loginResult.message}` })
      }

      // 로그인 성공 후 새로운 쿠키 저장
      const newCookies = await browserContext.cookies()
      this.cookieService.saveCookies('dcinside', loginId, newCookies)
      this.logger.log('로그인 성공 후 쿠키를 저장했습니다.')
    } else {
      this.logger.log('기존 쿠키로 로그인 상태가 유지되고 있습니다.')
    }
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

  /**
   * 여러 Job + PostJob을 배치로 생성하는 메서드 (성능 최적화)
   */
  async bulkCreateJobsWithPostJobs(
    inputDataList: Array<{
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
    }>,
  ) {
    // 트랜잭션으로 배치 처리
    return this.prismaService.$transaction(async tx => {
      // Job 데이터 준비
      const jobDataList = inputDataList.map(postJobData => ({
        type: JobType.POST,
        subject: `[${postJobData.galleryUrl}] ${postJobData.title}`,
        status: JobStatus.PENDING,
        scheduledAt: postJobData.scheduledAt || new Date(),
      }))

      // Job 테이블에 벌크 INSERT
      await tx.job.createMany({
        data: jobDataList,
      })

      // 생성된 Job들의 ID를 가져오기 위해 다시 조회
      const jobRecords = await tx.job.findMany({
        where: {
          type: JobType.POST,
          status: JobStatus.PENDING,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: inputDataList.length,
        select: {
          id: true,
        },
      })

      // PostJob 데이터 준비
      const postJobDataList = inputDataList.map((postJobData, index) => ({
        jobId: jobRecords[index].id,
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
      }))

      // PostJob 테이블에 벌크 INSERT
      await tx.postJob.createMany({
        data: postJobDataList,
      })

      // 결과 반환을 위해 Job과 PostJob 정보를 조합
      return jobRecords.map((job, index) => ({
        id: job.id,
        postJob: { id: job.id }, // PostJob ID는 Job ID와 동일
        originalData: inputDataList[index],
      }))
    })
  }
}
