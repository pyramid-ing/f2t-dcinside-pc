import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { UpdateJobDto } from './dto/update-job.dto'
import { BulkActionDto } from './dto/bulk-action.dto'
import { BulkRetryDeleteDto } from './dto/bulk-retry-delete.dto'
import { JobService } from './job.service'
import { JobStatus, JobType } from './job.types'
import { AuthGuard, Permissions, Permission } from '@main/app/modules/auth/auth.guard'

@Controller('api/jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

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
    return await this.jobService.getJobs({ status, type, search, orderBy, order, page, limit })
  }

  @Get('ids')
  async getJobIds(
    @Query('status') status?: JobStatus,
    @Query('type') type?: JobType,
    @Query('search') search?: string,
    @Query('orderBy') orderBy: string = 'updatedAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    return await this.jobService.getJobIds({ status, type, search, orderBy, order })
  }

  @UseGuards(AuthGuard)
  @Permissions(Permission.POSTING)
  @Post('bulk/retry')
  async retryJobs(@Body() body: BulkActionDto) {
    return await this.jobService.retryJobs(body)
  }

  @Post('bulk/delete')
  async deleteJobs(@Body() body: BulkActionDto) {
    return await this.jobService.deleteJobs(body)
  }

  @Post('bulk/pending-to-request')
  async bulkPendingToRequest(@Body() body: BulkActionDto) {
    return await this.jobService.bulkPendingToRequest(body)
  }

  @Post('bulk/retry-delete')
  async bulkRetryDeleteJobs(@Body() request: BulkRetryDeleteDto) {
    return await this.jobService.bulkRetryDeleteJobs(request)
  }

  @Post('bulk/apply-interval')
  async bulkApplyInterval(@Body() body: BulkActionDto) {
    return await this.jobService.bulkApplyInterval(body)
  }

  @Post('bulk/auto-delete')
  async bulkUpdateAutoDelete(@Body() body: BulkActionDto) {
    return await this.jobService.bulkUpdateAutoDelete(body)
  }

  @Get(':id/logs')
  async getJobLogs(@Param('id') jobId: string) {
    return await this.jobService.getJobLogs(jobId)
  }

  @Get(':id/logs/latest')
  async getLatestJobLog(@Param('id') jobId: string) {
    return await this.jobService.getLatestJobLog(jobId)
  }

  @UseGuards(AuthGuard)
  @Permissions(Permission.POSTING)
  @Post(':id/retry')
  async retryJob(@Param('id') jobId: string) {
    return await this.jobService.retryJob(jobId)
  }

  @Post(':id/request-to-pending')
  async requestToPending(@Param('id') jobId: string) {
    return await this.jobService.requestToPending(jobId)
  }

  @UseGuards(AuthGuard)
  @Permissions(Permission.POSTING)
  @Post(':id/pending-to-request')
  async pendingToRequest(@Param('id') jobId: string) {
    return await this.jobService.pendingToRequest(jobId)
  }

  @Post(':id/retry-delete')
  async retryDeleteJob(@Param('id') jobId: string) {
    return await this.jobService.retryDeleteJob(jobId)
  }

  @Get('scheduled')
  async getScheduledJobs() {
    return await this.jobService.getScheduledJobs()
  }

  @Delete(':id')
  async deleteJob(@Param('id') jobId: string) {
    return await this.jobService.deleteJob(jobId)
  }

  @Patch(':id')
  async updateJob(@Param('id') jobId: string, @Body() body: UpdateJobDto) {
    return await this.jobService.updateJob(jobId, body)
  }
}
