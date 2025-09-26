import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { JobProcessor, JobResult, JobType, JobStatus } from '@main/app/modules/dcinside/job/job.types'
import { Job as PrismaJob } from '@prisma/client'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { CommentJobResponseDto } from './dto/dcinside-comment-job.dto'
import { DcinsideCommentAutomationService } from './dcinside-comment-automation.service'

@Injectable()
export class CommentJobService implements JobProcessor {
  private readonly logger = new Logger(CommentJobService.name)

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jobLogsService: JobLogsService,
    private readonly commentAutomationService: DcinsideCommentAutomationService,
  ) {}

  canProcess(job: PrismaJob): boolean {
    return job.type === JobType.COMMENT
  }

  async process(jobId: string): Promise<JobResult | void> {
    this.logger.log(`Processing comment job: ${jobId}`)

    try {
      // Job과 CommentJob 정보 조회
      const job = await this.prismaService.job.findUnique({
        where: { id: jobId },
        include: { commentJob: true },
      })

      if (!job || !job.commentJob) {
        throw new Error(`Comment job not found: ${jobId}`)
      }

      const commentJob = job.commentJob

      this.logger.log(`Processing comment for post: ${commentJob.postUrl}`)

      try {
        await this.commentAutomationService.commentOnPost(
          commentJob.postUrl,
          commentJob.comment,
          commentJob.nickname,
          commentJob.password,
          commentJob.loginId,
          commentJob.loginPassword,
          jobId,
        )

        const resultMessage = `댓글 작성 성공: ${commentJob.postUrl}`

        // 작업 로그 기록
        await this.jobLogsService.createJobLog(jobId, resultMessage, 'info')

        this.logger.log(`Comment job completed: ${jobId} - ${resultMessage}`)

        return {
          resultMsg: resultMessage,
        }
      } catch (error) {
        const resultMessage = `댓글 작성 실패: ${commentJob.postUrl} - ${error.message}`
        this.logger.error(`Failed to write comment to post: ${error.message}`)

        // 에러 로그 기록
        await this.jobLogsService.createJobLog(jobId, resultMessage, 'error')

        throw error
      }
    } catch (error) {
      this.logger.error(`Failed to process comment job ${jobId}: ${error.message}`, error.stack)

      // 에러 로그 기록
      await this.jobLogsService.createJobLog(jobId, `댓글 작업 실패: ${error.message}`, 'error')

      throw error
    }
  }

  /**
   * 여러 포스트 URL에 대해 개별 Job + CommentJob을 생성하는 메서드
   */
  async createJobWithCommentJob(commentJobData: {
    keyword: string
    comment: string
    postUrls: string[]
    nickname?: string
    password?: string
    galleryUrl?: string
    loginId?: string
    loginPassword?: string
    scheduledAt?: Date
  }) {
    const jobs = []

    for (const postUrl of commentJobData.postUrls) {
      const job = await this.prismaService.job.create({
        data: {
          type: JobType.COMMENT,
          subject: `[댓글] ${commentJobData.keyword}`,
          status: JobStatus.PENDING,
          scheduledAt: commentJobData.scheduledAt || new Date(),
          commentJob: {
            create: {
              keyword: commentJobData.keyword,
              comment: commentJobData.comment,
              postUrl,
              nickname: commentJobData.nickname ?? null,
              password: commentJobData.password ?? null,
              galleryUrl: commentJobData.galleryUrl ?? null,
              loginId: commentJobData.loginId ?? null,
              loginPassword: commentJobData.loginPassword ?? null,
            },
          },
        },
        select: {
          id: true,
          commentJob: { select: { id: true } },
        },
      })
      jobs.push(job)
    }

    return jobs
  }

  /**
   * 댓글 작업 목록 조회
   */
  async getCommentJobs(): Promise<CommentJobResponseDto[]> {
    try {
      const commentJobs = await this.prismaService.commentJob.findMany({
        include: {
          job: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return commentJobs.map(commentJob => ({
        id: commentJob.id,
        keyword: commentJob.keyword,
        comment: commentJob.comment,
        postUrl: commentJob.postUrl,
        nickname: commentJob.nickname,
        password: commentJob.password,
        isRunning: commentJob.job.status === JobStatus.PROCESSING,
        createdAt: commentJob.createdAt,
        galleryUrl: commentJob.galleryUrl,
        loginId: commentJob.loginId,
        loginPassword: commentJob.loginPassword,
      }))
    } catch (error) {
      this.logger.error(`Failed to get comment jobs: ${error.message}`, error.stack)
      throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, {
        message: '댓글 작업 목록 조회에 실패했습니다.',
        originalError: error.message,
      })
    }
  }

  /**
   * 댓글 작업 상태 업데이트
   */
  async updateCommentJobStatus(jobId: string, status: 'RUNNING' | 'STOPPED'): Promise<void> {
    try {
      if (status === 'RUNNING') {
        // 작업 재시작
        await this.prismaService.job.update({
          where: { id: jobId },
          data: {
            status: JobStatus.REQUEST,
            startedAt: null,
            completedAt: null,
            errorMsg: null,
          },
        })
      } else {
        // 작업 중지
        await this.prismaService.job.update({
          where: { id: jobId },
          data: { status: JobStatus.PENDING },
        })
      }

      this.logger.log(`Updated comment job ${jobId} status to ${status}`)
    } catch (error) {
      this.logger.error(`Failed to update comment job status ${jobId}: ${error.message}`, error.stack)
      throw error
    }
  }

  /**
   * 댓글 작업 처리 (JobQueueProcessor에서 호출)
   */
  async processCommentJob(job: any): Promise<void> {
    try {
      // Job 상태를 processing으로 변경
      await this.prismaService.job.update({
        where: { id: job.id },
        data: { status: JobStatus.PROCESSING },
      })

      // CommentJobService를 통해 작업 처리
      const result = await this.process(job.id)

      // 작업 완료 처리
      await this.prismaService.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          resultMsg: result && 'resultMsg' in result ? result.resultMsg : null,
        },
      })

      this.logger.log(`Comment job completed: ${job.id}`)
    } catch (error) {
      this.logger.error(`Comment job failed: ${job.id} - ${error.message}`)

      // 작업 실패 처리
      await this.prismaService.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          completedAt: new Date(),
          errorMsg: error.message,
        },
      })
    }
  }
}
