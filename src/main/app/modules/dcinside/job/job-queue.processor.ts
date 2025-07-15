import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { JobProcessor, JobStatus, JobType } from './job.types'
import { Job } from '@prisma/client'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { PostJobService } from '@main/app/modules/dcinside/post-job/post-job.service'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'

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
    try {
      const pendingJobs = await this.prisma.job.findMany({
        where: {
          status: JobStatus.REQUEST,
          scheduledAt: { lte: new Date() },
        },
        orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
      })

      for (const job of pendingJobs) {
        await this.processJob(job)
      }
    } catch (error) {
      this.logger.error('Error processing jobs:', error)
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

      const result = await processor.process(job.id)

      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          ...(result && {
            resultUrl: result.resultUrl,
            resultMsg: result.resultMsg,
          }),
        },
      })

      this.logger.debug(`Completed job ${job.id}`)
    } catch (error) {
      await this.markJobAsFailed(job.id, error.message)
      this.logger.error(`Error processing job ${job.id}:`, error)
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
