import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { UpdateJobDto } from './dto/update-job.dto'
import { BulkActionDto, JobFiltersDto } from './dto/bulk-action.dto'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobQueueProcessor } from './job-queue.processor'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { JobStatus } from './job.types'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'
import { Prisma } from '@prisma/client'
import { SelectionMode } from '@main/app/modules/dcinside/job/enums/selection-mode.enum'

export const JOB_TYPE = {
  POST: 'post',
} as const

export type JobType = (typeof JOB_TYPE)[keyof typeof JOB_TYPE]

@Controller('api/jobs')
export class JobController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobProcessor: JobQueueProcessor,
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

  @Get()
  async getJobs(
    @Query('status') status?: JobStatus,
    @Query('type') type?: JobType,
    @Query('search') search?: string,
    @Query('orderBy') orderBy: string = 'updatedAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
    @Query(SelectionMode.PAGE) page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    try {
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
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  @Get('ids')
  async getJobIds(
    @Query('status') status?: JobStatus,
    @Query('type') type?: JobType,
    @Query('search') search?: string,
    @Query('orderBy') orderBy: string = 'updatedAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
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

  @UseGuards(AuthGuard)
  @Permissions(Permission.POSTING)
  @Post('bulk/retry')
  async retryJobs(@Body() body: BulkActionDto) {
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

    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (const job of failedJobs) {
      try {
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

        // 작업 큐에 다시 추가
        await this.jobProcessor.processJob(job)
        successCount++
      } catch (error) {
        failedCount++
        errors.push(`작업 ${job.id}: ${error.message}`)
      }
    }

    // 실패하지 않은 작업이 있다면 메시지에 포함
    if (nonFailedJobs.length > 0) {
      errors.push(`실패하지 않은 작업 ${nonFailedJobs.length}개는 재시도에서 제외되었습니다.`)
    }

    return {
      success: true,
      message: `${successCount}개 작업이 재시도되었습니다.`,
      details: {
        successCount,
        failedCount,
        errors,
      },
    }
  }

  @Post('bulk/delete')
  async deleteJobs(@Body() body: BulkActionDto) {
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

    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (const job of deletableJobs) {
      try {
        // 작업과 관련된 로그 삭제는 Prisma의 onDelete: Cascade로 자동 처리됨
        await this.prisma.job.delete({
          where: { id: job.id },
        })
        successCount++
      } catch (error) {
        failedCount++
        errors.push(`작업 ${job.id}: ${error.message}`)
      }
    }

    // 처리 중인 작업이 있다면 메시지에 포함
    if (processingJobs.length > 0) {
      errors.push(`처리 중인 작업 ${processingJobs.length}개는 삭제에서 제외되었습니다.`)
    }

    return {
      success: true,
      message: `${successCount}개 작업이 삭제되었습니다.`,
      details: {
        successCount,
        failedCount,
        errors,
      },
    }
  }

  @Post('bulk/pending-to-request')
  async bulkPendingToRequest(@Body() body: BulkActionDto) {
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

    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (const job of jobs) {
      try {
        await this.prisma.job.update({
          where: { id: job.id },
          data: { status: JobStatus.REQUEST },
        })
        successCount++
      } catch (error) {
        failedCount++
        errors.push(`작업 ${job.id}: ${error.message}`)
      }
    }

    return {
      success: true,
      message: `${successCount}개 작업이 등록요청으로 변경되었습니다.`,
      details: {
        successCount,
        failedCount,
        errors,
      },
    }
  }

  @Get(':id/logs')
  async getJobLogs(@Param('id') jobId: string) {
    const logs = await this.prisma.jobLog.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    })

    return logs
  }

  @Get(':id/logs/latest')
  async getLatestJobLog(@Param('id') jobId: string) {
    const log = await this.prisma.jobLog.findFirst({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    })

    return log
  }

  @UseGuards(AuthGuard)
  @Permissions(Permission.POSTING)
  @Post(':id/retry')
  async retryJob(@Param('id') jobId: string) {
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

    // 작업 큐에 다시 추가
    await this.jobProcessor.processJob(job)

    return {
      success: true,
      message: '작업이 재시도됩니다.',
    }
  }

  @Delete(':id')
  async deleteJob(@Param('id') jobId: string) {
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

  @Post(':id/request-to-pending')
  async requestToPending(@Param('id') jobId: string) {
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

  @UseGuards(AuthGuard)
  @Permissions(Permission.POSTING)
  @Post(':id/pending-to-request')
  async pendingToRequest(@Param('id') jobId: string) {
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

  @Get('scheduled')
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

  @Post('bulk/preview')
  async previewBulk(@Body() body: BulkActionDto) {
    const { mode, filters, includeIds, excludeIds } = body

    const where = this.buildWhere(filters)

    if (mode === SelectionMode.PAGE) {
      // 페이지 모드: includeIds 개수 반환
      return { count: includeIds?.length ?? 0 }
    } else {
      // all 모드: 필터 조건에 맞는 모든 작업에서 excludeIds 제외한 개수
      if (excludeIds && excludeIds.length > 0) {
        where.id = { notIn: excludeIds }
      }
      const count = await this.prisma.job.count({ where })
      return { count }
    }
  }

  @Post('bulk/apply-interval')
  async bulkApplyInterval(@Body() body: BulkActionDto) {
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

    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    // 기준 시간: 항상 현재 시간
    let base = new Date()
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]
      try {
        if (i === 0) {
          // 첫 Job은 기준 시간 그대로
          await this.prisma.job.update({
            where: { id: job.id },
            data: { scheduledAt: base },
          })
        } else {
          // 랜덤 간격(분) 추가
          const interval = Math.floor(Math.random() * (intervalEnd - intervalStart + 1)) + intervalStart
          base = new Date(base.getTime() + interval * 60000)
          await this.prisma.job.update({
            where: { id: job.id },
            data: { scheduledAt: base },
          })
        }
        successCount++
      } catch (error) {
        failedCount++
        errors.push(`작업 ${job.id}: ${error.message}`)
      }
    }

    return {
      success: true,
      message: `${successCount}개 작업에 간격이 적용되었습니다.`,
      details: {
        successCount,
        failedCount,
        errors,
      },
    }
  }

  @Post('bulk/auto-delete')
  async bulkUpdateAutoDelete(@Body() body: BulkActionDto) {
    const { mode, filters, includeIds, excludeIds, autoDeleteMinutes } = body

    if (!autoDeleteMinutes && autoDeleteMinutes !== 0) {
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

    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (const job of eligibleJobs) {
      try {
        const updateData: any = {
          postJob: {
            update: {
              autoDeleteMinutes,
              ...(job.status === JobStatus.COMPLETED && {
                deleteAt: autoDeleteMinutes === 0 ? new Date() : new Date(Date.now() + autoDeleteMinutes * 60000),
              }),
            },
          },
        }

        await this.prisma.job.update({
          where: { id: job.id },
          data: updateData,
        })
        successCount++
      } catch (error) {
        failedCount++
        errors.push(`작업 ${job.id}: ${error.message}`)
      }
    }

    return {
      success: true,
      message: `${successCount}개 작업의 등록후자동삭제(분)이 설정되었습니다.`,
      details: {
        successCount,
        failedCount,
        errors,
      },
    }
  }

  @Patch(':id')
  async updateJob(@Param('id') jobId: string, @Body() body: UpdateJobDto) {
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
}
