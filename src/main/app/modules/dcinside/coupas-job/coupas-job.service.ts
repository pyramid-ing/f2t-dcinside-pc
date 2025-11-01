import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { JobProcessor, JobResult, JobType, JobStatus } from '@main/app/modules/dcinside/job/job.types'
import { Job as PrismaJob } from '@prisma/client'
import { CoupangWorkflowService } from '@main/app/modules/coupang-workflow/coupang-workflow.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { JobContextService } from '@main/app/modules/common/job-context/job-context.service'

export interface CreateCoupasJobParams {
  postUrl: string
  wordpressUrl: string
  wordpressUsername: string
  wordpressApiKey: string
  subject?: string
  desc?: string
  scheduledAt?: Date
  nickname?: string
  password?: string
  loginId?: string
  loginPassword?: string
}

export interface CreateCoupasJobResult {
  success: boolean
  jobId: string
  coupasJobId: string
  message?: string
  isExisting: boolean
}

@Injectable()
export class CoupasJobService implements JobProcessor {
  private readonly logger = new Logger(CoupasJobService.name)

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jobLogsService: JobLogsService,
    private readonly coupangWorkflowService: CoupangWorkflowService,
    private readonly jobContext: JobContextService,
  ) {}

  canProcess(job: PrismaJob): boolean {
    return job.type === JobType.COUPAS
  }

  /**
   * 쿠파스 작업 생성 (중복 체크 포함)
   */
  async createCoupasJob(params: CreateCoupasJobParams): Promise<CreateCoupasJobResult> {
    const scheduledAt = params.scheduledAt || new Date()

    // 동일한 postUrl을 가진 CoupasJob이 이미 존재하는지 확인
    const existingCoupasJob = await this.prismaService.coupasJob.findFirst({
      where: {
        postUrl: params.postUrl,
      },
      include: {
        job: true,
      },
    })

    // 이미 존재하면 해당 작업 정보 반환 (새로 생성하지 않음)
    if (existingCoupasJob) {
      this.logger.log(`동일한 postUrl을 가진 쿠파스 작업이 이미 존재합니다. 무시합니다: ${params.postUrl}`)

      return {
        success: true,
        jobId: existingCoupasJob.job.id,
        coupasJobId: existingCoupasJob.id,
        message: '동일한 postUrl을 가진 작업이 이미 존재합니다.',
        isExisting: true,
      }
    }

    // Job 생성
    const job = await this.prismaService.job.create({
      data: {
        type: JobType.COUPAS,
        subject: params.subject || `쿠파스 작업: ${params.postUrl}`,
        desc: params.desc,
        status: JobStatus.REQUEST,
        scheduledAt,
        coupasJob: {
          create: {
            postUrl: params.postUrl,
            wordpressUrl: params.wordpressUrl,
            wordpressUsername: params.wordpressUsername,
            wordpressApiKey: params.wordpressApiKey,
            nickname: params.nickname,
            password: params.password,
            loginId: params.loginId,
            loginPassword: params.loginPassword,
          },
        },
      },
      include: {
        coupasJob: true,
      },
    })

    this.logger.log(`쿠파스 작업 생성 완료: ${params.postUrl}`)

    return {
      success: true,
      jobId: job.id,
      coupasJobId: job.coupasJob.id,
      isExisting: false,
    }
  }

  async process(jobId: string): Promise<JobResult | void> {
    this.logger.log(`쿠파스 작업 처리 시작: ${jobId}`)

    // JobContext를 설정하면서 작업 실행
    return this.jobContext.runWithContext(jobId, JobType.COUPAS, async () => {
      try {
        // Job과 CoupasJob 정보 조회
        const job = await this.prismaService.job.findUnique({
          where: { id: jobId },
          include: { coupasJob: true },
        })

        if (!job || !job.coupasJob) {
          throw new Error(`쿠파스 작업을 찾을 수 없습니다: ${jobId}`)
        }

        const coupasJob = job.coupasJob

        this.logger.log(`쿠파스 워크플로우 실행: ${coupasJob.postUrl}`)
        await this.jobLogsService.createJobLog(`쿠파스 워크플로우 시작: ${coupasJob.postUrl}`)

        try {
          // 워드프레스 계정 정보 구성
          const wordpressAccount = {
            id: `wp-${jobId}`,
            name: 'wordpress-account',
            url: coupasJob.wordpressUrl,
            wpUsername: coupasJob.wordpressUsername,
            apiKey: coupasJob.wordpressApiKey,
          }

          // 쿠팡 워크플로우 실행
          const workflowResult = await this.coupangWorkflowService.executeWorkflow({
            postUrl: coupasJob.postUrl,
            wordpressAccount,
            nickname: coupasJob.nickname || undefined,
            password: coupasJob.password || undefined,
            loginId: coupasJob.loginId || undefined,
            loginPassword: coupasJob.loginPassword || undefined,
          })

          await this.jobLogsService.createJobLog(`블로그 링크: ${workflowResult.blogLink}`)
          await this.jobLogsService.createJobLog(`댓글 텍스트 생성 완료`)

          // CoupasJob 결과 업데이트
          await this.prismaService.coupasJob.update({
            where: { id: coupasJob.id },
            data: {
              resultBlogLink: workflowResult.blogLink,
              resultComment: workflowResult.commentText,
            },
          })

          return {
            resultUrl: workflowResult.blogLink,
            resultMsg: '쿠파스 워크플로우 실행 완료',
          }
        } catch (error) {
          this.logger.error('쿠파스 워크플로우 실패:', error)
          await this.jobLogsService.createJobLog(`쿠파스 워크플로우 실패: ${error.message}`, 'error')
          throw error
        }
      } catch (error) {
        this.logger.error('쿠파스 작업 처리 실패:', error)
        throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, {
          message: error.message || '쿠파스 작업 처리에 실패했습니다.',
        })
      }
    })
  }

  /**
   * 쿠파스 작업 처리 (외부에서 호출)
   */
  async processCoupasJob(job: PrismaJob): Promise<void> {
    // JobContext를 설정하면서 작업 실행
    return this.jobContext.runWithContext(job.id, JobType.COUPAS, async () => {
      try {
        // 상태를 processing으로 변경
        await this.prismaService.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.PROCESSING,
            startedAt: new Date(),
          },
        })

        await this.jobLogsService.createJobLog('쿠파스 작업 시작')

        // 작업 처리
        const result = await this.process(job.id)

        // 성공 시 상태 업데이트
        await this.prismaService.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.COMPLETED,
            completedAt: new Date(),
            resultMsg: (result && 'resultMsg' in result ? result.resultMsg : undefined) || '쿠파스 워크플로우 완료',
          },
        })

        await this.jobLogsService.createJobLog('쿠파스 작업 완료', 'info')
      } catch (error) {
        this.logger.error(`쿠파스 작업 실패 (${job.id}):`, error)

        // 실패 시 상태 업데이트
        await this.prismaService.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.FAILED,
            completedAt: new Date(),
            errorMsg: error.message || '쿠파스 작업 처리 실패',
          },
        })

        await this.jobLogsService.createJobLog(`쿠파스 작업 실패: ${error.message}`, 'error')
      }
    })
  }
}
