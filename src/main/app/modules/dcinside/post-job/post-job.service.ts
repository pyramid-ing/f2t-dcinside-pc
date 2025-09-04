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
import { IpMode } from '@main/app/modules/settings/settings.types'
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

    // 테더링 모드면 권한 확인 후 포스팅 전 IP 변경
    if (settings?.ipMode === IpMode.TETHERING) {
      await this.checkPermission(Permission.TETHERING)
      try {
        const prev = this.tetheringService.getCurrentIp()
        await this.jobLogsService.createJobLog(jobId, `테더링 전 현재 IP: ${prev.ip || '조회 실패'}`)
        const changed = await this.tetheringService.checkIpChanged(prev, {
          attempts: settings?.tethering?.attempts ?? 3,
          waitSeconds: settings?.tethering?.waitSeconds ?? 3,
          adbPath: settings?.tethering?.adbPath,
        })
        await this.jobLogsService.createJobLog(jobId, `테더링으로 IP 변경됨: ${prev.ip} → ${changed.ip}`)
      } catch (e: any) {
        await this.jobLogsService.createJobLog(jobId, `테더링 IP 변경 실패: ${e?.message || e}`)
        throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, { message: '테더링 IP 변경 실패' })
      }
    }

    if (settings?.ipMode === IpMode.PROXY) {
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
      try {
        const ipCheckPage = await context.newPage()
        const externalIp = await getExternalIp(ipCheckPage)
        await this.jobLogsService.createJobLog(jobId, `실제 외부 IP: ${externalIp}`)
        await ipCheckPage.close()
      } catch (e) {
        await this.jobLogsService.createJobLog(jobId, `외부 IP 조회 실패: ${e instanceof Error ? e.message : e}`)
      }

      try {
        if (settings?.taskDelay > 0) {
          await this.jobLogsService.createJobLog(jobId, `작업 간 딜레이: ${settings.taskDelay}초`)
          await sleep(settings.taskDelay * 1000)
        }
        // 프록시 모드는 매 작업마다 새 페이지 생성/종료 (기존 동작 유지)
        const page = await context.newPage()
        try {
          await this.handlePostJob(jobId, context, page, job.postJob)
        } finally {
          await page.close()
        }
      } catch (error) {
        throw error
      } finally {
        await browser.close()
      }
    } else {
      // 테더링/NONE 모드: 브라우저/페이지 재사용
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
      try {
        const externalIp = await getExternalIp(page)
        await this.jobLogsService.createJobLog(jobId, `실제 외부 IP: ${externalIp}`)
      } catch (e) {
        await this.jobLogsService.createJobLog(jobId, `외부 IP 조회 실패: ${e instanceof Error ? e.message : e}`)
      }

      if (settings?.taskDelay > 0) {
        await this.jobLogsService.createJobLog(jobId, `작업 간 딜레이: ${settings.taskDelay}초`)
        await sleep(settings.taskDelay * 1000)
      }

      // 동일 페이지에서 포스팅 처리 (페이지 종료/브라우저 종료 없음)
      await this.handlePostJob(jobId, context, page, job.postJob)
    }
  }
  private async checkPermission(permission: Permission): Promise<void> {
    const settings = await this.settingsService.getSettings()
    const licenseCache = settings.licenseCache
    assertPermission(licenseCache, permission)
  }

  /**
   * 큐 처리 (엑셀 순서대로, 세션별 브라우저 관리)
   */
  async handlePostJob(jobId: string, context: BrowserContext, page: Page, postJob: PostJob) {
    this.logger.log(`작업 시작: ID ${jobId})`)
    await this.jobLogsService.createJobLog(jobId, '작업 시작')

    // 해당 브라우저에서 로그인이 아직 처리되지 않았다면 로그인 처리
    if (postJob.loginId && postJob.loginPassword) {
      await this.jobLogsService.createJobLog(jobId, `로그인 시도: ${postJob.loginId}`)
      await this.handleBrowserLogin(context, page, postJob.loginId, postJob.loginPassword)
      await this.jobLogsService.createJobLog(jobId, '로그인 성공')
    } else {
      this.logger.log(`비로그인 모드로 진행`)
      await this.jobLogsService.createJobLog(jobId, '비로그인 모드로 진행')
    }

    // 작업 처리
    await this.jobLogsService.createJobLog(jobId, '포스팅 시작')
    // 실제 로그인 상태로 회원/비회원 여부 판정 (브라우저 재사용 시 쿠키로 로그인 상태가 유지될 수 있음)
    const isMember = await this.postingService.isLogin(page)
    const result = await this.postingService.postArticle(postJob, context, page, jobId, isMember)

    await this.jobLogsService.createJobLog(jobId, `포스팅 완료: ${result.url}`)

    // 포스팅 성공 시 resultUrl을 PostJob에 저장
    if (result.url) {
      await this.prismaService.postJob.update({
        where: { id: postJob.id },
        data: { resultUrl: result.url },
      })
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
