import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { JobProcessor, JobStatus, JobType } from './job.types'
import { Job } from '@prisma/client'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { PostJobService } from '@main/app/modules/dcinside/post-job/post-job.service'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCodeMap } from '@main/common/errors/error-code.map'
import { DcinsidePostingService } from '@main/app/modules/dcinside/api/dcinside-posting.service'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { BrowserManagerService } from '@main/app/modules/util/browser-manager.service'

@Injectable()
export class JobQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(JobQueueProcessor.name)
  private processors: Partial<Record<JobType, JobProcessor>>

  constructor(
    private readonly prisma: PrismaService,
    private readonly postJobService: PostJobService,
    private readonly jobLogsService: JobLogsService,
    private readonly postingService: DcinsidePostingService,
    private readonly browserManager: BrowserManagerService,
  ) {}

  async onModuleInit() {
    this.processors = {
      [JobType.POST]: this.postJobService,
    }
    // 1. 시작 직후 processing 상태인 것들을 error 처리 (중간에 강제종료된 경우)
    await this.removeUnprocessedJobs()
  }

  private async removeUnprocessedJobs() {
    try {
      const processingJobs = await this.prisma.job.findMany({
        where: { status: JobStatus.PROCESSING },
      })
      for (const job of processingJobs) {
        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.FAILED,
            errorMsg: '시스템 재시작으로 인한 작업 중단',
            completedAt: new Date(),
          },
        })
        await this.jobLogsService.createJobLog(job.id, '시스템 재시작으로 인한 작업 중단', 'error')
      }
      this.logger.log(`처리 중이던 ${processingJobs.length}개 작업을 실패 처리했습니다.`)
    } catch (error) {
      this.logger.error('처리 중이던 작업 정리 실패:', error)
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processNextJobs() {
    // 현재 processing 중인 job이 있는지 확인
    const processingCount = await this.prisma.job.count({
      where: { status: JobStatus.PROCESSING },
    })

    if (processingCount === 0) {
      // processing 중인 job이 없을 때만 pending job을 하나만 가져와서 처리
      const requestJobs = await this.prisma.job.findMany({
        where: {
          status: JobStatus.REQUEST,
          scheduledAt: { lte: new Date() },
        },
        orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
        take: 1, // 한 번에 하나만 처리
      })

      for (const job of requestJobs) {
        await this.processJob(job)
      }
    }
  }

  public async processJob(job: Job) {
    const processor = this.processors[job.type as JobType]
    if (!processor || !processor.canProcess(job)) {
      this.logger.error(`No valid processor for job type ${job.type}`)
      await this.markJobAsFailed(job.id, `해당 작업 타입이 없습니다. ${job.type}`)
      return
    }

    try {
      const updateResult = await this.prisma.job.updateMany({
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

      await this.prisma.job.update({
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
      await this.markJobAsFailed(job.id, error.message)
    } finally {
      const remaining = await this.prisma.job.count({
        where: {
          OR: [{ status: JobStatus.PROCESSING }, { status: JobStatus.REQUEST, scheduledAt: { lte: new Date() } }],
        },
      })
      if (remaining === 0) {
        await this.browserManager.closeManagedBrowser('dcinside')
      }
    }
  }

  private async markJobAsFailed(jobId: string, errorMsg: string) {
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        errorMsg,
        completedAt: new Date(),
      },
    })
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledDeletions() {
    const now = new Date()
    const postJobs = await this.prisma.postJob.findMany({
      where: {
        deleteAt: { lte: now },
        deletedAt: null,
        resultUrl: { not: null },
      },
      include: { job: true },
    })

    for (const postJob of postJobs) {
      const jobId = postJob.jobId
      try {
        await this.jobLogsService.createJobLog(jobId, '삭제 예정시간 도달. 삭제를 시작합니다.')

        const { browser, context } = await this.postingService.launch()
        const page = await context.newPage()

        try {
          let isMember = false
          // 로그인 필요 시 처리
          if (postJob.loginId && postJob.loginPassword) {
            await this.jobLogsService.createJobLog(jobId, `삭제용 로그인 시도: ${postJob.loginId}`)
            const loginRes = await this.postingService.login(page, {
              id: postJob.loginId,
              password: postJob.loginPassword,
            })
            if (!loginRes.success) {
              throw new CustomHttpException(ErrorCode.AUTH_REQUIRED, { message: loginRes.message })
            }
            await this.jobLogsService.createJobLog(jobId, '삭제용 로그인 완료')
            isMember = true
          }

          await this.postingService.deleteArticleByResultUrl(postJob, page, jobId, isMember)

          await this.prisma.postJob.update({
            where: { id: postJob.id },
            data: { deletedAt: new Date() } as any,
          })
          await this.jobLogsService.createJobLog(jobId, '게시글 삭제 완료')
        } finally {
          await page.close()
          await browser.close()
        }
      } catch (error) {
        // ErrorCodeMap에서 매핑
        let logMessage = `작업 처리 중 오류 발생: ${error.message}`
        if (error instanceof CustomHttpException) {
          const mapped = ErrorCodeMap[error.errorCode]
          if (mapped) {
            logMessage = `작업 처리 중 오류 발생: ${mapped.message(error.metadata)}`
          }
        }
        await this.jobLogsService.createJobLog(jobId, logMessage, 'error')
        this.logger.error(logMessage, error.stack)
        // 에러 발생 시에도 재시도되지 않도록 삭제 완료로 간주 처리
        try {
          await this.prisma.postJob.update({
            where: { id: postJob.id },
            data: { deletedAt: new Date() } as any,
          })
          await this.jobLogsService.createJobLog(jobId, '에러로 인해 삭제 완료 처리(더 이상 재시도하지 않음).')
        } catch (_) {}
      }
    }
  }
}
