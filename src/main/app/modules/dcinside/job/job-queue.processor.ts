import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { JobStatus, JobType } from './job.types'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { PostJobService } from '@main/app/modules/dcinside/post-job/post-job.service'
import { CommentJobService } from '@main/app/modules/dcinside/comment/comment-job.service'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'

@Injectable()
export class JobQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(JobQueueProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly postJobService: PostJobService,
    private readonly commentJobService: CommentJobService,
    private readonly jobLogsService: JobLogsService,
  ) {}

  async onModuleInit() {
    // 1. 시작 직후 processing 상태인 것들을 error 처리 (중간에 강제종료된 경우)
    await this._removeUnprocessedJobs()
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processNextJobs() {
    // 현재 processing 중인 작업이 있는지 확인 (포스팅과 댓글 모두)
    const processingCount = await this.prisma.job.count({
      where: {
        status: JobStatus.PROCESSING,
        type: {
          in: [JobType.POST, JobType.COMMENT],
        },
      },
    })

    if (processingCount === 0) {
      // processing 중인 작업이 없을 때만 pending job을 하나만 가져와서 처리
      const requestJobs = await this.prisma.job.findMany({
        where: {
          status: JobStatus.REQUEST,
          type: {
            in: [JobType.POST, JobType.COMMENT],
          },
          scheduledAt: { lte: new Date() },
        },
        orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
        take: 1, // 한 번에 하나만 처리
      })

      for (const job of requestJobs) {
        switch (job.type) {
          case JobType.POST:
            await this.postJobService.processPostingJob(job)
            break
          case JobType.COMMENT:
            await this.commentJobService.processCommentJob(job)
            break
        }
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

  private async _removeUnprocessedJobs() {
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
}
