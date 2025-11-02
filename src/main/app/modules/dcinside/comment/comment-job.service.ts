import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { JobProcessor, JobResult, JobType, JobStatus } from '@main/app/modules/dcinside/job/job.types'
import { Job as PrismaJob } from '@prisma/client'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { DcException, DcExceptionType } from '@main/common/errors/dc.exception'
import { CommentJobResponseDto } from './dto/dcinside-comment-job.dto'
import { BulkCommentJobCreateDto } from './dto/comment-excel-upload.dto'
import { DcinsideCommentAutomationService } from './dcinside-comment-automation.service'
import { HtmlTitleExtractor } from '@main/app/utils/html-title-extractor'
import { ErrorCodeMap } from '@main/common/errors/error-code.map'
import { JobContextService } from '@main/app/modules/common/job-context/job-context.service'

@Injectable()
export class CommentJobService implements JobProcessor {
  private readonly logger = new Logger(CommentJobService.name)

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jobLogsService: JobLogsService,
    private readonly commentAutomationService: DcinsideCommentAutomationService,
    private readonly jobContext: JobContextService,
  ) {}

  /**
   * URL에서 galleryId 추출
   * 예: https://gall.dcinside.com/board/view/?id=programming&no=1234 -> programming
   * 예: https://gall.dcinside.com/mgallery/board/view/?id=baseball_new10&no=5678 -> baseball_new10
   */
  private extractGalleryId(postUrl: string): string {
    try {
      const match = postUrl.match(/[?&]id=([^&]+)/)
      return match ? match[1] : 'unknown'
    } catch (error) {
      this.logger.warn(`Failed to extract galleryId from URL: ${postUrl}`)
      return 'unknown'
    }
  }

  /**
   * DcException을 CustomHttpException으로 매핑
   */
  private mapDcExceptionToCustomHttpException(dcException: DcException): CustomHttpException {
    switch (dcException.type) {
      case DcExceptionType.COMMENT_DISABLED_PAGE:
        return new CustomHttpException(ErrorCode.COMMENT_DISABLED_PAGE, dcException.metadata)
      case DcExceptionType.POST_NOT_FOUND_OR_DELETED:
        return new CustomHttpException(ErrorCode.POST_NOT_FOUND_OR_DELETED, dcException.metadata)
      case DcExceptionType.NICKNAME_REQUIRED_GALLERY:
        return new CustomHttpException(ErrorCode.NICKNAME_REQUIRED_GALLERY, dcException.metadata)
      case DcExceptionType.NICKNAME_REQUIRED:
        return new CustomHttpException(ErrorCode.NICKNAME_REQUIRED, dcException.metadata)
      case DcExceptionType.CAPTCHA_SOLVE_FAILED:
        return new CustomHttpException(ErrorCode.CAPTCHA_SOLVE_FAILED, dcException.metadata)
      case DcExceptionType.RECAPTCHA_SOLVE_FAILED:
        return new CustomHttpException(ErrorCode.RECAPTCHA_SOLVE_FAILED, dcException.metadata)
      case DcExceptionType.TWOCAPTCHA_API_KEY_REQUIRED:
        return new CustomHttpException(ErrorCode.TWOCAPTCHA_API_KEY_REQUIRED, dcException.metadata)
      case DcExceptionType.CHROME_NOT_INSTALLED:
        return new CustomHttpException(ErrorCode.CHROME_NOT_INSTALLED, dcException.metadata)
      case DcExceptionType.AUTH_REQUIRED:
        return new CustomHttpException(ErrorCode.AUTH_REQUIRED, dcException.metadata)
      case DcExceptionType.POST_PARAM_INVALID:
        return new CustomHttpException(ErrorCode.POST_PARAM_INVALID, dcException.metadata)
      case DcExceptionType.POST_SUBMIT_FAILED:
        return new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, dcException.metadata)
      case DcExceptionType.IMAGE_UPLOAD_FAILED:
        return new CustomHttpException(ErrorCode.IMAGE_UPLOAD_FAILED, dcException.metadata)
      case DcExceptionType.RECAPTCHA_NOT_SUPPORTED:
        return new CustomHttpException(ErrorCode.RECAPTCHA_NOT_SUPPORTED, dcException.metadata)
      case DcExceptionType.CAPTCHA_FAILED:
        return new CustomHttpException(ErrorCode.CAPTCHA_FAILED, dcException.metadata)
      case DcExceptionType.CAPTCHA_DISABLED:
        return new CustomHttpException(ErrorCode.CAPTCHA_DISABLED, dcException.metadata)
      case DcExceptionType.GALLERY_TYPE_UNSUPPORTED:
        return new CustomHttpException(ErrorCode.GALLERY_TYPE_UNSUPPORTED, dcException.metadata)
      default:
        return new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, dcException.metadata)
    }
  }

  canProcess(job: PrismaJob): boolean {
    return job.type === JobType.COMMENT
  }

  async process(jobId: string): Promise<JobResult | void> {
    this.logger.log(`Processing comment job: ${jobId}`)

    // JobContext를 설정하면서 작업 실행
    return this.jobContext.runWithContext(jobId, JobType.COMMENT, async () => {
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
          // ✅ jobId 파라미터 제거 - JobContext에서 자동으로 가져옴
          await this.commentAutomationService.commentOnPost(
            commentJob.postUrl,
            commentJob.comment,
            commentJob.nickname,
            commentJob.password,
            commentJob.loginId,
            commentJob.loginPassword,
          )

          const resultMessage = `댓글 작성 성공: ${commentJob.postUrl}`

          // ✅ jobId 파라미터 제거 - JobContext에서 자동으로 가져옴
          await this.jobLogsService.createJobLog(resultMessage, 'info')

          this.logger.log(`Comment job completed: ${jobId} - ${resultMessage}`)

          return {
            resultMsg: resultMessage,
          }
        } catch (error) {
          const resultMessage = `댓글 작성 실패: ${commentJob.postUrl} - ${error.message}`
          this.logger.error(`Failed to write comment to post: ${error.message}`)

          // ✅ jobId 파라미터 제거
          await this.jobLogsService.createJobLog(resultMessage, 'error')

          // DcException을 CustomHttpException으로 매핑
          if (error instanceof DcException) {
            throw this.mapDcExceptionToCustomHttpException(error)
          }

          throw error
        }
      } catch (error) {
        this.logger.error(`Failed to process comment job ${jobId}: ${error.message}`, error.stack)

        // ✅ jobId 파라미터 제거
        await this.jobLogsService.createJobLog(`댓글 작업 실패: ${error.message}`, 'error')

        throw error
      }
    })
  }

  /**
   * 여러 포스트 URL에 대해 개별 Job + CommentJob을 생성하는 메서드
   */
  async createJobWithCommentJob(commentJobData: {
    keyword: string
    comment: string
    postUrls: string[]
    postTitles?: string[]
    nickname?: string
    password?: string
    loginId?: string
    loginPassword?: string
    scheduledAt?: Date
    status?: JobStatus
  }) {
    const jobs = []

    // 모든 URL의 실제 제목을 병렬로 가져오기
    const actualTitles = await HtmlTitleExtractor.extractTitles(commentJobData.postUrls)
    this.logger.log(`게시물 제목 추출 완료: ${actualTitles.length}개 제목`)

    for (let i = 0; i < commentJobData.postUrls.length; i++) {
      const postUrl = commentJobData.postUrls[i]
      // 실제 제목을 가져오되, 실패한 경우 기본값 사용
      const postTitle = actualTitles[i] || commentJobData.postTitles?.[i] || '알 수 없는 제목'
      // URL에서 galleryId 추출
      const galleryId = this.extractGalleryId(postUrl)

      const job = await this.prismaService.job.create({
        data: {
          type: JobType.COMMENT,
          subject: `[댓글] ${commentJobData.keyword}`,
          status: commentJobData.status ?? JobStatus.PENDING,
          scheduledAt: commentJobData.scheduledAt || new Date(),
          commentJob: {
            create: {
              keyword: commentJobData.keyword,
              comment: commentJobData.comment,
              postUrl,
              postTitle,
              galleryId, // 추가: 갤러리 ID
              nickname: commentJobData.nickname ?? null,
              password: commentJobData.password ?? null,
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
        postTitle: commentJob.postTitle,
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
      // ErrorCodeMap에서 매핑
      let logMessage = `작업 처리 중 오류 발생: ${error.message}`
      if (error instanceof CustomHttpException) {
        const mapped = ErrorCodeMap[error.errorCode]
        if (mapped) {
          logMessage = `작업 처리 중 오류 발생: ${mapped.message(error.metadata)}`
        }
      }

      // 에러 로그를 위한 context 설정
      await this.jobContext.runWithContext(job.id, JobType.COMMENT, async () => {
        await this.jobLogsService.createJobLog(logMessage, 'error')
      })

      this.logger.error(logMessage, error.stack)

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

  /**
   * 엑셀 파일로 댓글 작업 일괄 생성
   */
  async createBulkCommentJobs(bulkDto: BulkCommentJobCreateDto): Promise<CommentJobResponseDto[]> {
    this.logger.log(`Creating bulk comment jobs: ${bulkDto.commentJobs.length} jobs`)

    const createdJobs: CommentJobResponseDto[] = []

    for (const commentJobData of bulkDto.commentJobs) {
      try {
        // 개별 댓글 작업 생성
        const createDto = {
          keyword: bulkDto.keyword,
          comment: commentJobData.comment,
          postUrls: [commentJobData.postUrl],
          nickname: commentJobData.nickname,
          password: commentJobData.password,
          loginId: commentJobData.loginId,
          loginPassword: commentJobData.loginPassword,
        }

        const jobs = await this.createJobWithCommentJob(createDto)
        createdJobs.push(...jobs)

        this.logger.log(`Created comment job for URL: ${commentJobData.postUrl}`)
      } catch (error) {
        this.logger.error(`Failed to create comment job for URL ${commentJobData.postUrl}: ${error.message}`)
        // 개별 작업 실패 시에도 계속 진행
      }
    }

    this.logger.log(`Bulk comment job creation completed: ${createdJobs.length} jobs created`)
    return createdJobs
  }
}
