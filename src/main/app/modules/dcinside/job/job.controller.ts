import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { UpdateJobDto } from './dto/update-job.dto'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobQueueProcessor } from './job-queue.processor'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { JobStatus } from './job.types'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'
import { Prisma } from '@prisma/client'

export const JOB_TYPE = {
  POST: 'post',
  GENERATE_TOPIC: 'generate_topic',
} as const

export type JobType = (typeof JOB_TYPE)[keyof typeof JOB_TYPE]

@Controller('api/jobs')
export class JobController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobProcessor: JobQueueProcessor,
  ) {}

  @Get()
  async getJobs(
    @Query('status') status?: JobStatus,
    @Query('type') type?: JobType,
    @Query('search') search?: string,
    @Query('orderBy') orderBy: string = 'updatedAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
    @Query('page') page: string = '1',
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

  @UseGuards(AuthGuard)
  @Permissions(Permission.POSTING)
  @Post('bulk/retry')
  async retryJobs(@Body() body: { jobIds: string[] }) {
    try {
      const { jobIds } = body

      if (!jobIds || jobIds.length === 0) {
        throw new CustomHttpException(ErrorCode.JOB_ID_REQUIRED)
      }

      const jobs = await this.prisma.job.findMany({
        where: {
          id: { in: jobIds },
        },
      })

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
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.JOB_BULK_RETRY_FAILED)
    }
  }

  @Post('bulk/delete')
  async deleteJobs(@Body() body: { jobIds: string[] }) {
    try {
      const { jobIds } = body

      if (!jobIds || jobIds.length === 0) {
        throw new CustomHttpException(ErrorCode.JOB_ID_REQUIRED)
      }

      const jobs = await this.prisma.job.findMany({
        where: {
          id: { in: jobIds },
        },
      })

      if (jobs.length === 0) {
        throw new CustomHttpException(ErrorCode.JOB_NOT_FOUND, { jobIds })
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
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.JOB_BULK_DELETE_FAILED)
    }
  }

  @Get(':id/logs')
  async getJobLogs(@Param('id') jobId: string) {
    try {
      const logs = await this.prisma.jobLog.findMany({
        where: { jobId },
        orderBy: { createdAt: 'desc' },
      })

      return logs
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_LOG_FETCH_FAILED)
    }
  }

  @Get(':id/logs/latest')
  async getLatestJobLog(@Param('id') jobId: string) {
    try {
      const log = await this.prisma.jobLog.findFirst({
        where: { jobId },
        orderBy: { createdAt: 'desc' },
      })

      return log
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_LOG_FETCH_FAILED)
    }
  }

  @UseGuards(AuthGuard)
  @Permissions(Permission.POSTING)
  @Post(':id/retry')
  async retryJob(@Param('id') jobId: string) {
    try {
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
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.JOB_RETRY_FAILED)
    }
  }

  @Delete(':id')
  async deleteJob(@Param('id') jobId: string) {
    try {
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
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.JOB_DELETE_FAILED)
    }
  }

  @Post(':id/request-to-pending')
  async requestToPending(@Param('id') jobId: string) {
    try {
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
    } catch (error) {
      if (error instanceof CustomHttpException) throw error
      throw new CustomHttpException(ErrorCode.JOB_STATUS_CHANGE_FAILED)
    }
  }

  @UseGuards(AuthGuard)
  @Permissions(Permission.POSTING)
  @Post(':id/pending-to-request')
  async pendingToRequest(@Param('id') jobId: string) {
    try {
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
    } catch (error) {
      if (error instanceof CustomHttpException) throw error
      throw new CustomHttpException(ErrorCode.JOB_STATUS_CHANGE_FAILED)
    }
  }

  @Get('scheduled')
  async getScheduledJobs() {
    try {
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
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  @Patch(':id')
  async updateJob(@Param('id') jobId: string, @Body() body: UpdateJobDto) {
    try {
      const updateData: any = {}
      if (typeof body.scheduledAt !== 'undefined') {
        // Job.scheduledAt은 non-nullable이므로 null이 오면 즉시 실행(now)로 대체
        updateData.scheduledAt = body.scheduledAt === null ? new Date() : new Date(body.scheduledAt)
      }
      if ('deleteAt' in body) {
        updateData.postJob = {
          update: {
            deleteAt: body.deleteAt ? new Date(body.deleteAt) : null,
            deletedAt: null,
          },
        }
      }
      // 필요시 다른 필드도 추가 가능
      await this.prisma.job.update({
        where: { id: jobId },
        data: updateData,
      })
      return { success: true }
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }
}
