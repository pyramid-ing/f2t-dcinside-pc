import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { JobProcessor, JobStatus, JobType } from './job.types'
import { Job } from '@prisma/client'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { PostJobService } from '@main/app/modules/dcinside/post-job/post-job.service'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCodeMap } from '@main/common/errors/error-code.map'

@Injectable()
export class JobQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(JobQueueProcessor.name)
  private processors: Partial<Record<JobType, JobProcessor>>

  constructor(
    private readonly prisma: PrismaService,
    private readonly postJobService: PostJobService,
    private readonly jobLogsService: JobLogsService,
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
        where: {
          status: {
            in: [JobStatus.PROCESSING, JobStatus.DELETE_PROCESSING],
          },
        },
      })
      for (const job of processingJobs) {
        const errorMsg =
          job.status === JobStatus.PROCESSING
            ? '시스템 재시작으로 인한 작업 중단'
            : '시스템 재시작으로 인한 삭제 작업 중단'

        const failedStatus = job.status === JobStatus.PROCESSING ? JobStatus.FAILED : JobStatus.DELETE_FAILED

        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            status: failedStatus,
            errorMsg,
            completedAt: new Date(),
          },
        })
        await this.jobLogsService.createJobLog(job.id, errorMsg, 'error')
      }
      this.logger.log(`처리 중이던 ${processingJobs.length}개 작업을 실패 처리했습니다.`)
    } catch (error) {
      this.logger.error('처리 중이던 작업 정리 실패:', error)
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processNextJobs() {
    // 현재 processing 중인 등록 job이 있는지 확인 (등록 작업만)
    const processingCount = await this.prisma.job.count({
      where: {
        status: JobStatus.PROCESSING,
        type: JobType.POST, // 등록 작업만 확인
      },
    })

    if (processingCount === 0) {
      // processing 중인 등록 job이 없을 때만 pending job을 하나만 가져와서 처리
      const requestJobs = await this.prisma.job.findMany({
        where: {
          status: JobStatus.REQUEST,
          type: JobType.POST,
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

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledDeletions() {
    const processingDeleteCount = await this.prisma.job.count({
      where: { status: JobStatus.DELETE_PROCESSING },
    })

    if (processingDeleteCount === 0) {
      const jobsToDelete = await this.prisma.job.findMany({
        where: {
          type: JobType.POST,
          status: {
            in: [JobStatus.COMPLETED, JobStatus.DELETE_REQUEST],
          },
          postJob: {
            deleteAt: {
              lte: new Date(), // 현재 시간보다 이전
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

      // 4. 삭제 대상 작업들을 원자적으로 처리하고 바로 삭제 진행
      for (const job of jobsToDelete) {
        await this.postJobService.processDeleteJob(job)
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
}
