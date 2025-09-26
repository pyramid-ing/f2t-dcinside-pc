import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { JobQueueProcessor } from './job-queue.processor'
import { PostJobService } from '@main/app/modules/dcinside/post-job/post-job.service'
import { CommentJobService } from '@main/app/modules/dcinside/comment/comment-job.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { JobStatus, JobType } from './job.types'
import { SelectionMode } from './enums/selection-mode.enum'
import { JobFiltersDto, BulkActionDto } from './dto/bulk-action.dto'
import { UpdateJobDto } from './dto/update-job.dto'
import { BulkRetryDeleteDto } from './dto/bulk-retry-delete.dto'

@Injectable()
export class JobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobLogsService: JobLogsService,
    private readonly jobProcessor: JobQueueProcessor,
    private readonly postJobService: PostJobService,
    private readonly commentJobService: CommentJobService,
  ) {}

  private buildWhere(filters: JobFiltersDto): Prisma.JobWhereInput {
    const where: Prisma.JobWhereInput = {}

    if (filters.status) {
      where.status = filters.status as JobStatus
    }

    if (filters.type) {
      where.type = filters.type as JobType
    }

    if (filters.search) {
      where.OR = [
        { subject: { contains: filters.search } },
        { desc: { contains: filters.search } },
        { resultMsg: { contains: filters.search } },
      ]
    }

    return where
  }

  async getJobs(params: {
    status?: JobStatus
    type?: JobType
    search?: string
    orderBy?: string
    order?: 'asc' | 'desc'
    page?: string
    limit?: string
  }) {
    const { status, type, search, orderBy = 'updatedAt', order = 'desc', page = '1', limit = '20' } = params

    const where: Prisma.JobWhereInput = {}

    // 상태 필터
    if (status) {
      where.status = status
    }

    // 타입 필터
    if (type) {
      where.type = type
    }

    // 검색 필터
    if (search) {
      where.OR = [
        { subject: { contains: search } },
        { desc: { contains: search } },
        { resultMsg: { contains: search } },
      ]
    }

    // 페이지네이션 파라미터
    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10))) // 최대 100개로 제한
    const skip = (pageNum - 1) * limitNum

    // 총 개수 조회
    const totalCount = await this.prisma.job.count({ where })

    // 페이지네이션된 데이터 조회
    const jobs = await this.prisma.job.findMany({
      where,
      orderBy: {
        [orderBy]: order,
      },
      include: {
        logs: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
        postJob: true,
        commentJob: true,
      },
      skip,
      take: limitNum,
    })

    // 페이지네이션 정보 계산
    const totalPages = Math.ceil(totalCount / limitNum)
    const hasNextPage = pageNum < totalPages
    const hasPrevPage = pageNum > 1

    return {
      data: jobs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    }
  }

  async getJobIds(params: {
    status?: JobStatus
    type?: JobType
    search?: string
    orderBy?: string
    order?: 'asc' | 'desc'
  }) {
    const { status, type, search, orderBy = 'updatedAt', order = 'desc' } = params

    const where: Prisma.JobWhereInput = {}

    // 상태 필터
    if (status) {
      where.status = status
    }

    // 타입 필터
    if (type) {
      where.type = type
    }

    // 검색 필터
    if (search) {
      where.OR = [
        { subject: { contains: search } },
        { desc: { contains: search } },
        { resultMsg: { contains: search } },
      ]
    }

    // 필터 조건에 맞는 모든 작업의 ID만 조회 (페이지네이션 없음)
    const jobs = await this.prisma.job.findMany({
      where,
      orderBy: {
        [orderBy]: order,
      },
      select: {
        id: true,
      },
    })

    return {
      jobIds: jobs.map(job => job.id),
      totalCount: jobs.length,
    }
  }

  async retryJobs(body: BulkActionDto) {
    const { mode, filters, includeIds, excludeIds } = body

    const where = this.buildWhere(filters)

    if (mode === SelectionMode.PAGE) {
      // 페이지 모드: includeIds로 특정 작업들만 처리
      if (!includeIds || includeIds.length === 0) {
        throw new CustomHttpException(ErrorCode.JOB_ID_REQUIRED)
      }
      where.id = { in: includeIds }
    } else {
      // all 모드: 필터 조건에 맞는 모든 작업에서 excludeIds 제외
      if (excludeIds && excludeIds.length > 0) {
        where.id = { notIn: excludeIds }
      }
    }

    const jobs = await this.prisma.job.findMany({ where })

    if (jobs.length === 0) {
      throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND)
    }

    // 실패한 작업만 필터링
    const failedJobs = jobs.filter(job => job.status === JobStatus.FAILED)
    const nonFailedJobs = jobs.filter(job => job.status !== JobStatus.FAILED)

    const errors: string[] = []

    for (const job of failedJobs) {
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.REQUEST,
          resultMsg: null,
          errorMsg: null,
        },
      })

      // 작업 로그 추가
      await this.prisma.jobLog.create({
        data: {
          jobId: job.id,
          message: '작업이 재시도됩니다.',
        },
      })

      // 작업 큐에 다시 추가 (타입에 따라 적절한 서비스 사용)
      if (job.type === JobType.POST) {
        await this.postJobService.processPostingJob(job)
      } else if (job.type === JobType.COMMENT) {
        await this.commentJobService.processCommentJob(job)
      }
    }

    // 실패하지 않은 작업이 있다면 메시지에 포함
    if (nonFailedJobs.length > 0) {
      errors.push(`실패하지 않은 작업 ${nonFailedJobs.length}개는 재시도에서 제외되었습니다.`)
    }

    return {
      success: true,
      message: `${failedJobs.length}개 작업이 재시도되었습니다.`,
      details: {
        errors,
      },
    }
  }

  async deleteJobs(body: BulkActionDto) {
    const { mode, filters, includeIds, excludeIds } = body

    const where = this.buildWhere(filters)

    if (mode === SelectionMode.PAGE) {
      // 페이지 모드: includeIds로 특정 작업들만 처리
      if (!includeIds || includeIds.length === 0) {
        throw new CustomHttpException(ErrorCode.JOB_ID_REQUIRED)
      }
      where.id = { in: includeIds }
    } else {
      // all 모드: 필터 조건에 맞는 모든 작업에서 excludeIds 제외
      if (excludeIds && excludeIds.length > 0) {
        where.id = { notIn: excludeIds }
      }
    }

    const jobs = await this.prisma.job.findMany({ where })

    if (jobs.length === 0) {
      throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND)
    }

    // 처리 중인 작업 제외 및 삭제 가능한 작업 필터링
    const processingJobs = jobs.filter(job => job.status === JobStatus.PROCESSING)
    const deletableJobs = jobs.filter(job => job.status !== JobStatus.PROCESSING)

    const errors: string[] = []

    for (const job of deletableJobs) {
      // 작업과 관련된 로그 삭제는 Prisma의 onDelete: Cascade로 자동 처리됨
      await this.prisma.job.delete({
        where: { id: job.id },
      })
    }

    // 처리 중인 작업이 있다면 메시지에 포함
    if (processingJobs.length > 0) {
      errors.push(`처리 중인 작업 ${processingJobs.length}개는 삭제에서 제외되었습니다.`)
    }

    return {
      success: true,
      message: `${deletableJobs.length}개 작업이 삭제되었습니다.`,
      details: {
        errors,
      },
    }
  }

  async bulkPendingToRequest(body: BulkActionDto) {
    const { mode, filters, includeIds, excludeIds } = body

    const where = this.buildWhere(filters)

    if (mode === SelectionMode.PAGE) {
      // 페이지 모드: includeIds로 특정 작업들만 처리
      if (!includeIds || includeIds.length === 0) {
        throw new CustomHttpException(ErrorCode.JOB_ID_REQUIRED)
      }
      where.id = { in: includeIds }
    } else {
      // all 모드: 필터 조건에 맞는 모든 작업에서 excludeIds 제외
      if (excludeIds && excludeIds.length > 0) {
        where.id = { notIn: excludeIds }
      }
    }

    // 등록대기(PENDING) 상태인 작업만 필터링
    where.status = JobStatus.PENDING

    const jobs = await this.prisma.job.findMany({ where })

    if (jobs.length === 0) {
      throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND)
    }

    const errors: string[] = []

    for (const job of jobs) {
      await this.prisma.job.update({
        where: { id: job.id },
        data: { status: JobStatus.REQUEST },
      })
    }

    return {
      success: true,
      message: `${jobs.length}개 작업이 등록요청으로 변경되었습니다.`,
      details: {
        errors,
      },
    }
  }

  async getJobLogs(jobId: string) {
    const logs = await this.prisma.jobLog.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    })

    return logs
  }

  async getLatestJobLog(jobId: string) {
    const log = await this.prisma.jobLog.findFirst({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    })

    return log
  }

  async retryJob(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND, { jobId })
    }

    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.REQUEST,
        resultMsg: null,
        errorMsg: null,
      },
    })

    // 작업 로그 추가
    await this.prisma.jobLog.create({
      data: {
        jobId,
        message: '작업이 재시도됩니다.',
      },
    })

    // 작업 큐에 다시 추가 (타입에 따라 적절한 서비스 사용)
    if (job.type === JobType.POST) {
      await this.postJobService.processPostingJob(job)
    } else if (job.type === JobType.COMMENT) {
      await this.commentJobService.processCommentJob(job)
    }

    return {
      success: true,
      message: '작업이 재시도됩니다.',
    }
  }

  async deleteJob(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND, { jobId })
    }

    if (job.status === JobStatus.PROCESSING) {
      throw new CustomHttpException(ErrorCode.JOB_DELETE_PROCESSING)
    }

    // 작업과 관련된 로그 삭제는 Prisma의 onDelete: Cascade로 자동 처리됨
    await this.prisma.job.delete({
      where: { id: jobId },
    })

    return {
      success: true,
      message: '작업이 삭제되었습니다.',
    }
  }

  async requestToPending(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } })
    if (!job) {
      throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND, { jobId })
    }
    if (job.status !== JobStatus.REQUEST) {
      throw new CustomHttpException(ErrorCode.JOB_STATUS_INVALID, { jobId, status: job.status })
    }
    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.PENDING },
    })
    return { success: true, message: '상태가 등록대기(pending)로 변경되었습니다.' }
  }

  async pendingToRequest(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } })
    if (!job) {
      throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND, { jobId })
    }
    if (job.status !== JobStatus.PENDING) {
      throw new CustomHttpException(ErrorCode.JOB_STATUS_INVALID, { jobId, status: job.status })
    }
    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.REQUEST },
    })
    return { success: true, message: '상태가 등록요청(request)로 변경되었습니다.' }
  }

  async getScheduledJobs() {
    const jobs = await this.prisma.job.findMany({
      where: {
        scheduledAt: { not: null },
      },
      orderBy: {
        scheduledAt: 'asc',
      },
      include: {
        logs: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
        postJob: true,
      },
    })
    return jobs
  }

  async bulkApplyInterval(body: BulkActionDto) {
    const { mode, filters, includeIds, excludeIds, intervalStart, intervalEnd } = body

    if (!intervalStart || !intervalEnd) {
      throw new CustomHttpException(ErrorCode.JOB_ID_REQUIRED)
    }

    if (intervalStart > intervalEnd) {
      throw new CustomHttpException(ErrorCode.JOB_ID_REQUIRED)
    }

    const where = this.buildWhere(filters)

    if (mode === SelectionMode.PAGE) {
      // 페이지 모드: includeIds로 특정 작업들만 처리
      if (!includeIds || includeIds.length === 0) {
        throw new CustomHttpException(ErrorCode.JOB_ID_REQUIRED)
      }
      where.id = { in: includeIds }
    } else {
      // all 모드: 필터 조건에 맞는 모든 작업에서 excludeIds 제외
      if (excludeIds && excludeIds.length > 0) {
        where.id = { notIn: excludeIds }
      }
    }

    // 등록대기(PENDING) 상태인 작업만 필터링
    where.status = JobStatus.PENDING

    const jobs = await this.prisma.job.findMany({
      where,
      orderBy: { id: 'asc' }, // id 기준 오름차순 정렬(순서 고정)
    })

    if (jobs.length < 2) {
      throw new CustomHttpException(ErrorCode.JOB_ID_REQUIRED)
    }

    const errors: string[] = []

    // 기준 시간: 항상 현재 시간
    let base = new Date()
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]
      if (i === 0) {
        // 첫 Job은 기준 시간 그대로
        await this.prisma.job.update({
          where: { id: job.id },
          data: { scheduledAt: base },
        })
      } else {
        // 랜덤 간격(초) 추가
        const interval = Math.floor(Math.random() * (intervalEnd - intervalStart + 1)) + intervalStart
        base = new Date(base.getTime() + interval * 1000)
        await this.prisma.job.update({
          where: { id: job.id },
          data: { scheduledAt: base },
        })
      }
    }

    return {
      success: true,
      message: `${jobs.length}개 작업에 간격이 적용되었습니다.`,
      details: {
        errors,
      },
    }
  }

  async bulkUpdateAutoDelete(body: BulkActionDto) {
    const { mode, filters, includeIds, excludeIds, autoDeleteMinutes } = body

    // autoDeleteMinutes가 null이면 자동삭제 제거, 숫자면 설정
    if (autoDeleteMinutes === undefined) {
      throw new CustomHttpException(ErrorCode.JOB_ID_REQUIRED)
    }

    const where = this.buildWhere(filters)

    if (mode === SelectionMode.PAGE) {
      // 페이지 모드: includeIds로 특정 작업들만 처리
      if (!includeIds || includeIds.length === 0) {
        throw new CustomHttpException(ErrorCode.JOB_ID_REQUIRED)
      }
      where.id = { in: includeIds }
    } else {
      // all 모드: 필터 조건에 맞는 모든 작업에서 excludeIds 제외
      if (excludeIds && excludeIds.length > 0) {
        where.id = { notIn: excludeIds }
      }
    }

    const jobs = await this.prisma.job.findMany({
      where,
      include: { postJob: true },
    })

    if (jobs.length === 0) {
      throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND)
    }

    // 이미 삭제되지 않은 작업만 필터링
    const eligibleJobs = jobs.filter(job => !job.postJob?.deletedAt)

    const errors: string[] = []

    for (const job of eligibleJobs) {
      const updateData: any = {
        postJob: {
          update: {
            autoDeleteMinutes,
            // 자동삭제 제거 시 deleteAt도 null로 설정
            ...(autoDeleteMinutes === null && {
              deleteAt: null,
            }),
            // 자동삭제 설정 시 deleteAt 계산
            ...(autoDeleteMinutes !== null &&
              autoDeleteMinutes > 0 &&
              job.status === JobStatus.COMPLETED && {
                deleteAt: new Date(Date.now() + autoDeleteMinutes * 60 * 1000),
              }),
          },
        },
      }

      await this.prisma.job.update({
        where: { id: job.id },
        data: updateData,
      })
    }

    const actionMessage =
      autoDeleteMinutes === null
        ? `${eligibleJobs.length}개 작업의 자동삭제 설정이 제거되었습니다.`
        : `${eligibleJobs.length}개 작업의 등록후자동삭제(분)이 설정되었습니다.`

    return {
      success: true,
      message: actionMessage,
      details: {
        errors,
      },
    }
  }

  async updateJob(jobId: string, body: UpdateJobDto) {
    const updateData: any = {}
    if (typeof body.scheduledAt !== 'undefined') {
      // Job.scheduledAt은 non-nullable이므로 null이 오면 즉시 실행(now)로 대체
      updateData.scheduledAt = body.scheduledAt === null ? new Date() : new Date(body.scheduledAt)
    }
    if ('deleteAt' in body || 'autoDeleteMinutes' in body) {
      updateData.postJob = {
        update: {
          ...(body.deleteAt !== undefined && { deleteAt: body.deleteAt ? new Date(body.deleteAt) : null }),
          ...(body.autoDeleteMinutes !== undefined && { autoDeleteMinutes: body.autoDeleteMinutes }),
          // 자동삭제 제거 시 deleteAt도 null로 설정
          ...(body.autoDeleteMinutes === null && { deleteAt: null }),
          ...(body.deleteAt !== undefined && { deletedAt: null }),
        },
      }
    }
    // 필요시 다른 필드도 추가 가능
    await this.prisma.job.update({
      where: { id: jobId },
      data: updateData,
    })
    return { success: true }
  }

  async retryDeleteJob(jobId: string) {
    // 작업 조회
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { postJob: true },
    })

    if (!job) {
      throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND)
    }

    // 삭제 실패 상태인지 확인
    if (job.status !== JobStatus.DELETE_FAILED) {
      throw new CustomHttpException(ErrorCode.JOB_STATUS_INVALID)
    }

    // postJob이 있고 resultUrl이 있는지 확인
    if (!job.postJob || !job.postJob.resultUrl) {
      throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND)
    }

    // DELETE_FAILED -> DELETE_REQUEST로 변경하고 deleteAt을 현재 시간으로 설정
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.DELETE_REQUEST,
        errorMsg: null, // 에러 메시지 초기화
        postJob: {
          update: {
            deleteAt: new Date(), // 현재 시간으로 설정하여 바로 삭제되도록 함
            deletedAt: null,
          },
        },
      },
    })

    // 재시도 로그 추가
    await this.jobLogsService.createJobLog(jobId, '삭제 재시도 요청')

    return { success: true, message: '삭제 재시도 요청이 완료되었습니다.' }
  }

  async bulkRetryDeleteJobs(request: BulkRetryDeleteDto) {
    const { mode: selectionMode, includeIds: selectedIds, excludeIds: excludedIds, filters } = request

    let whereCondition: Prisma.JobWhereInput = {
      status: JobStatus.DELETE_FAILED, // 삭제 실패한 작업만
      type: JobType.POST,
      postJob: {
        deletedAt: null, // 아직 삭제되지 않음
        resultUrl: { not: null }, // 결과 URL이 있어야 삭제 가능
      },
    }

    // 필터 조건 추가
    if (filters) {
      if (filters.status) {
        // 이미 DELETE_FAILED로 제한하고 있으므로 status 필터는 무시
      }
      if (filters.type) {
        whereCondition.type = filters.type
      }
      if (filters.search) {
        whereCondition.OR = [
          { subject: { contains: filters.search } },
          { desc: { contains: filters.search } },
          { resultMsg: { contains: filters.search } },
        ]
      }
    }

    // 선택 모드에 따른 필터 조건 추가
    if (selectionMode === SelectionMode.PAGE && selectedIds && selectedIds.length > 0) {
      whereCondition.id = { in: selectedIds }
    } else if (selectionMode === SelectionMode.ALL && excludedIds && excludedIds.length > 0) {
      whereCondition.id = { notIn: excludedIds }
    }

    // 삭제 실패한 작업들 조회
    const failedDeleteJobs = await this.prisma.job.findMany({
      where: whereCondition,
      include: { postJob: true },
    })

    if (failedDeleteJobs.length === 0) {
      return { success: true, message: '재시도할 삭제 실패 작업이 없습니다.', count: 0 }
    }

    // DELETE_FAILED -> DELETE_REQUEST로 변경하고 deleteAt을 현재 시간으로 설정
    // updateMany에서는 중첩 관계 업데이트가 불가능하므로 각 작업을 개별적으로 업데이트
    const updatePromises = failedDeleteJobs.map(job =>
      this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.DELETE_REQUEST,
          errorMsg: null, // 에러 메시지 초기화
          postJob: {
            update: {
              deleteAt: new Date(), // 현재 시간으로 설정하여 바로 삭제되도록 함
            },
          },
        },
      }),
    )

    await Promise.all(updatePromises)
    const updateResult = { count: failedDeleteJobs.length }

    // 각 작업에 재시도 로그 추가
    const logPromises = failedDeleteJobs.map(job => this.jobLogsService.createJobLog(job.id, '삭제 재시도 요청 (벌크)'))
    await Promise.all(logPromises)

    return {
      success: true,
      message: `${updateResult.count}개 작업의 삭제 재시도 요청이 완료되었습니다.`,
      count: updateResult.count,
    }
  }
}
