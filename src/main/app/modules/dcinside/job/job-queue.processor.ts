import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { JobStatus, JobType } from './job.types'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { PostJobService } from '@main/app/modules/dcinside/post-job/post-job.service'
import { CommentJobService } from '@main/app/modules/dcinside/comment/comment-job.service'
import { CoupasJobService } from '@main/app/modules/dcinside/coupas-job/coupas-job.service'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { JobContextService } from '@main/app/modules/common/job-context/job-context.service'

@Injectable()
export class JobQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(JobQueueProcessor.name)
  private readonly COMMENT_BATCH_SIZE = 5 // 동시 처리할 댓글 작업 수

  constructor(
    private readonly prisma: PrismaService,
    private readonly postJobService: PostJobService,
    private readonly commentJobService: CommentJobService,
    private readonly coupasJobService: CoupasJobService,
    private readonly jobLogsService: JobLogsService,
    private readonly jobContext: JobContextService,
  ) {}

  async onModuleInit() {
    // 1. 시작 직후 processing 상태인 것들을 error 처리 (중간에 강제종료된 경우)
    await this._removeUnprocessedJobs()
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processNextJobs() {
    // 각 작업 타입별로 병렬 처리 가능하도록 독립적으로 확인
    await Promise.allSettled([this.processPostJobs(), this.processCommentJobs(), this.processCoupasJobs()])
  }

  /**
   * POST 타입 작업 처리
   */
  private async processPostJobs() {
    try {
      // POST 타입의 처리 중인 작업이 있는지 확인
      const processingCount = await this.prisma.job.count({
        where: {
          status: JobStatus.PROCESSING,
          type: JobType.POST,
        },
      })

      // 처리 중인 작업이 없으면 새 작업 시작
      if (processingCount === 0) {
        const requestJobs = await this.prisma.job.findMany({
          where: {
            status: JobStatus.REQUEST,
            type: JobType.POST,
            scheduledAt: { lte: new Date() },
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
          take: 1,
        })

        if (requestJobs.length > 0) {
          await this.postJobService.processPostingJob(requestJobs[0])
        }
      }
    } catch (error) {
      this.logger.error(`POST 작업 처리 중 오류: ${error.message}`, error.stack)
    }
  }

  /**
   * COMMENT 타입 작업 처리 (배치)
   */
  private async processCommentJobs() {
    try {
      // COMMENT 타입의 처리 중인 작업이 있는지 확인
      const processingCount = await this.prisma.job.count({
        where: {
          status: JobStatus.PROCESSING,
          type: JobType.COMMENT,
        },
      })

      // 처리 중인 작업 수가 배치 사이즈보다 적으면 새 작업들을 배치로 시작
      if (processingCount < this.COMMENT_BATCH_SIZE) {
        const availableSlots = this.COMMENT_BATCH_SIZE - processingCount

        // 댓글 작업은 갤러리 분산 로직 적용하여 배치로 가져오기
        const commentRequestJobs = await this.findNextCommentJobsWithDistribution(availableSlots)

        if (commentRequestJobs.length > 0) {
          this.logger.log(`Starting batch processing of ${commentRequestJobs.length} comment jobs`)

          // 배치로 작업 처리 - 병렬로 실행하되 각각 독립적으로 처리
          const promises = commentRequestJobs.map(async job => {
            try {
              await this.commentJobService.processCommentJob(job)
              return { success: true, jobId: job.id }
            } catch (error) {
              this.logger.error(`Failed to process comment job ${job.id}: ${error.message}`)
              return { success: false, jobId: job.id, error: error.message }
            }
          })

          // 모든 작업이 완료될 때까지 대기하지 않고, 시작만 하고 넘어감 (비동기 처리)
          Promise.allSettled(promises)
            .then(results => {
              const successful = results.filter(result => result.status === 'fulfilled' && result.value.success).length
              const failed = results.length - successful

              this.logger.log(`Comment batch processing completed: ${successful} successful, ${failed} failed`)
            })
            .catch(error => {
              this.logger.error(`Error in comment batch processing: ${error.message}`)
            })
        }
      }
    } catch (error) {
      this.logger.error(`COMMENT 작업 처리 중 오류: ${error.message}`, error.stack)
    }
  }

  /**
   * COUPAS 타입 작업 처리
   */
  private async processCoupasJobs() {
    try {
      // COUPAS 타입의 처리 중인 작업이 있는지 확인
      const processingCount = await this.prisma.job.count({
        where: {
          status: JobStatus.PROCESSING,
          type: JobType.COUPAS,
        },
      })

      // 처리 중인 작업이 없으면 새 작업 시작
      if (processingCount === 0) {
        const requestJobs = await this.prisma.job.findMany({
          where: {
            status: JobStatus.REQUEST,
            type: JobType.COUPAS,
            scheduledAt: { lte: new Date() },
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
          take: 1,
        })

        if (requestJobs.length > 0) {
          await this.coupasJobService.processCoupasJob(requestJobs[0])
        }
      }
    } catch (error) {
      this.logger.error(`COUPAS 작업 처리 중 오류: ${error.message}`, error.stack)
    }
  }

  /**
   * 갤러리 분산을 고려한 다음 댓글 작업들 찾기 (배치)
   * - 최근 N개 작업과 다른 갤러리의 작업을 우선 선택
   * - 갤러리별로 고르게 분산하여 배치 사이즈만큼 선택
   */
  private async findNextCommentJobsWithDistribution(batchSize: number) {
    const RECENT_CHECK_COUNT = 50 // 최근 50개 작업 확인

    try {
      // 1. 최근 처리된 댓글 작업의 갤러리 목록 조회
      const recentJobs = await this.prisma.job.findMany({
        where: {
          type: JobType.COMMENT,
          status: {
            in: [JobStatus.COMPLETED, JobStatus.PROCESSING, JobStatus.FAILED],
          },
        },
        include: { commentJob: true },
        orderBy: { completedAt: 'desc' },
        take: RECENT_CHECK_COUNT,
      })

      const recentGalleryIds = recentJobs
        .filter(job => job.commentJob?.galleryId && job.commentJob.galleryId !== 'unknown')
        .map(job => job.commentJob!.galleryId)

      // 최근 갤러리의 빈도 계산 (더 최근일수록 높은 가중치)
      const galleryFrequency = new Map<string, number>()
      recentGalleryIds.forEach((galleryId, index) => {
        const weight = recentGalleryIds.length - index // 더 최근일수록 높은 가중치
        galleryFrequency.set(galleryId, (galleryFrequency.get(galleryId) || 0) + weight)
      })

      this.logger.debug(`최근 처리된 갤러리 빈도: ${JSON.stringify(Object.fromEntries(galleryFrequency))}`)

      // 2. 모든 대기 중인 댓글 작업 조회 (갤러리별로 그룹화하여 분산 선택을 위함)
      const allRequestJobs = await this.prisma.job.findMany({
        where: {
          status: JobStatus.REQUEST,
          type: JobType.COMMENT,
          scheduledAt: { lte: new Date() },
        },
        include: { commentJob: true },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      })

      if (allRequestJobs.length === 0) {
        return []
      }

      // 3. 갤러리별로 그룹화
      const jobsByGallery = new Map<string, any[]>()
      allRequestJobs.forEach(job => {
        const galleryId = job.commentJob?.galleryId || 'unknown'
        if (!jobsByGallery.has(galleryId)) {
          jobsByGallery.set(galleryId, [])
        }
        jobsByGallery.get(galleryId)!.push(job)
      })

      // 4. 갤러리별 우선순위 계산 (최근 빈도가 낮을수록 우선)
      const sortedGalleries = Array.from(jobsByGallery.keys()).sort((a, b) => {
        const freqA = galleryFrequency.get(a) || 0
        const freqB = galleryFrequency.get(b) || 0
        return freqA - freqB // 빈도가 낮을수록 우선
      })

      // 5. 배치 사이즈만큼 갤러리를 순환하면서 작업 선택
      const selectedJobs: any[] = []
      let galleryIndex = 0

      while (selectedJobs.length < batchSize && sortedGalleries.length > 0) {
        const currentGallery = sortedGalleries[galleryIndex]
        const galleryJobs = jobsByGallery.get(currentGallery)!

        if (galleryJobs.length > 0) {
          const job = galleryJobs.shift()! // 첫 번째 작업 선택
          selectedJobs.push(job)

          this.logger.debug(
            `배치 선택: ${job.commentJob?.galleryId || 'unknown'} (${selectedJobs.length}/${batchSize})`,
          )
        }

        // 해당 갤러리에 더 이상 작업이 없으면 목록에서 제거
        if (galleryJobs.length === 0) {
          jobsByGallery.delete(currentGallery)
          sortedGalleries.splice(galleryIndex, 1)
          if (galleryIndex >= sortedGalleries.length) {
            galleryIndex = 0
          }
        } else {
          galleryIndex = (galleryIndex + 1) % sortedGalleries.length
        }
      }

      if (selectedJobs.length > 0) {
        const galleryDistribution = selectedJobs.reduce(
          (acc, job) => {
            const galleryId = job.commentJob?.galleryId || 'unknown'
            acc[galleryId] = (acc[galleryId] || 0) + 1
            return acc
          },
          {} as Record<string, number>,
        )

        this.logger.log(`배치 선택 완료 (${selectedJobs.length}개): ${JSON.stringify(galleryDistribution)}`)
      }

      return selectedJobs
    } catch (error) {
      this.logger.error(`갤러리 분산 배치 로직 오류: ${error.message}`, error.stack)
      // 오류 발생 시 기존 방식으로 fallback (단순히 배치 사이즈만큼)
      return this.prisma.job.findMany({
        where: {
          status: JobStatus.REQUEST,
          type: JobType.COMMENT,
          scheduledAt: { lte: new Date() },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: batchSize,
      })
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

        // 에러 로그를 위한 context 설정
        await this.jobContext.runWithContext(job.id, job.type, async () => {
          await this.jobLogsService.createJobLog(errorMsg, 'error')
        })
      }
      this.logger.log(`처리 중이던 ${processingJobs.length}개 작업을 실패 처리했습니다.`)
    } catch (error) {
      this.logger.error('처리 중이던 작업 정리 실패:', error)
    }
  }
}
