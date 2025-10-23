import { Injectable, Logger } from '@nestjs/common'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { DcinsidePostingService } from '@main/app/modules/dcinside/posting/dcinside-posting.service'
import { Job, PostJob } from '@prisma/client'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobProcessor, JobStatus, JobType } from '@main/app/modules/dcinside/job/job.types'
import { TetheringService } from '@main/app/modules/util/tethering.service'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { IpMode } from '@main/app/modules/settings/settings.types'
import { BrowserManagerService } from '@main/app/modules/util/browser-manager.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCodeMap } from '@main/common/errors/error-code.map'
import { DcExceptionMapper } from '@main/app/modules/dcinside/utils/dc-exception-mapper.util'
import { DcException } from '@main/common/errors/dc.exception'
import * as XLSX from 'xlsx'

@Injectable()
export class PostJobService implements JobProcessor {
  private readonly logger = new Logger(PostJobService.name)

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
      // DcException을 CustomHttpException으로 변환
      if (error instanceof DcException) {
        error = DcExceptionMapper.mapDcExceptionToCustomHttpException(error)
      }

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

      await this.postingService.deleteArticleByResultUrl(job.postJob, job.id, this.browserManager)

      // 삭제 성공 시 원본 작업의 deletedAt 업데이트
      await this.prismaService.postJob.update({
        where: { id: job.postJob.id },
        data: { deletedAt: new Date() },
      })

      await this.markJobAsStatus(job.id, JobStatus.DELETE_COMPLETED)

      this.logger.log(`게시글 삭제 완료: ${job.postJob.resultUrl}`)
    } catch (error) {
      // DcException을 CustomHttpException으로 변환
      if (error instanceof DcException) {
        error = DcExceptionMapper.mapDcExceptionToCustomHttpException(error)
      }

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

    // 통합된 포스팅 처리 (브라우저 모드 + IP 모드 + 로그인 포함)
    const result = await this.postingService.postArticle(jobId, job.postJob)

    await this.jobLogsService.createJobLog(jobId, `포스팅 완료: ${result.url}`)

    // 포스팅 성공 시 resultUrl을 PostJob에 저장
    if (result.url) {
      const updateData: any = { resultUrl: result.url }

      // autoDeleteMinutes가 설정되어 있으면 deleteAt 계산 (현재시간 기준)
      const autoDeleteMinutes = job.postJob.autoDeleteMinutes
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
        where: { id: job.postJob.id },
        data: updateData,
      })

      // 테더링 모드에서 포스팅 수 카운트 증가
      const settings = await this.settingsService.getSettings()
      if (settings?.ipMode === IpMode.TETHERING) {
        this.tetheringService.onPostCompleted()
      }
    }
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

  /**
   * 선택된 작업들의 조회수를 업데이트합니다.
   */
  async updateViewCounts(
    jobIds: string[],
  ): Promise<{ success: boolean; updated: number; failed: number; results: any[] }> {
    const results = []
    let updated = 0
    let failed = 0

    for (const jobId of jobIds) {
      try {
        const job = await this.prismaService.job.findUnique({
          where: { id: jobId },
          include: { postJob: true },
        })

        if (!job || !job.postJob) {
          results.push({ jobId, success: false, error: 'Job not found' })
          failed++
          continue
        }

        const resultUrl = job.postJob.resultUrl
        if (!resultUrl) {
          results.push({ jobId, success: false, error: 'Result URL not found' })
          failed++
          continue
        }

        // 조회수 가져오기
        const viewCount = await this.postingService.getViewCount(resultUrl)

        // 조회수 업데이트
        await this.prismaService.postJob.update({
          where: { id: job.postJob.id },
          data: {
            viewCount,
            viewCountUpdatedAt: new Date(),
          } as any,
        })

        results.push({ jobId, success: true, viewCount })
        updated++
      } catch (error) {
        this.logger.error(`Failed to update view count for job ${jobId}: ${error.message}`)
        results.push({ jobId, success: false, error: error.message })
        failed++
      }
    }

    return {
      success: true,
      updated,
      failed,
      results,
    }
  }

  /**
   * 작업 목록을 엑셀로 내보냅니다.
   */
  async exportJobsToExcel(jobIds: string[]): Promise<Buffer> {
    try {
      // 작업 정보 가져오기
      const jobs = await this.prismaService.job.findMany({
        where: {
          id: { in: jobIds },
          type: JobType.POST,
        },
        include: {
          postJob: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      // 엑셀 데이터 생성
      const excelData = jobs.map((job, index) => ({
        번호: index + 1,
        제목: job.postJob?.title || '',
        갤러리URL: job.postJob?.galleryUrl || '',
        '포스팅 링크': job.postJob?.resultUrl || '',
        조회수: (job.postJob as any)?.viewCount || 0,
        '조회수 업데이트': (job.postJob as any)?.viewCountUpdatedAt
          ? new Date((job.postJob as any).viewCountUpdatedAt).toLocaleString('ko-KR')
          : '',
        상태: this.getStatusLabel(job.status),
        등록일시: new Date(job.createdAt).toLocaleString('ko-KR'),
        '자동삭제(분)': job.postJob?.autoDeleteMinutes || '',
        닉네임: job.postJob?.nickname || '',
        말머리: job.postJob?.headtext || '',
      }))

      // 워크북 생성
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(excelData)

      // 컬럼 너비 설정
      const columnWidths = [
        { wch: 8 }, // 번호
        { wch: 40 }, // 제목
        { wch: 50 }, // 갤러리URL
        { wch: 50 }, // 포스팅 링크
        { wch: 10 }, // 조회수
        { wch: 20 }, // 조회수 업데이트
        { wch: 10 }, // 상태
        { wch: 20 }, // 등록일시
        { wch: 15 }, // 자동삭제(분)
        { wch: 15 }, // 닉네임
        { wch: 15 }, // 말머리
      ]
      worksheet['!cols'] = columnWidths

      // 워크시트 추가
      XLSX.utils.book_append_sheet(workbook, worksheet, '포스팅 목록')

      // 엑셀 버퍼 생성
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      return excelBuffer as Buffer
    } catch (error) {
      this.logger.error(`엑셀 내보내기 실패: ${error.message}`)
      throw new Error(`엑셀 내보내기 실패: ${error.message}`)
    }
  }

  /**
   * 작업 상태 레이블 반환
   */
  private getStatusLabel(status: string): string {
    const statusMap: Record<string, string> = {
      [JobStatus.PENDING]: '대기중',
      [JobStatus.REQUEST]: '요청됨',
      [JobStatus.PROCESSING]: '처리중',
      [JobStatus.COMPLETED]: '완료',
      [JobStatus.FAILED]: '실패',
      [JobStatus.DELETE_COMPLETED]: '삭제완료',
      [JobStatus.DELETE_FAILED]: '삭제실패',
    }
    return statusMap[status] || status
  }
}
