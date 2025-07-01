import { Controller, Get, Param } from '@nestjs/common'
import { JobLogsService } from 'src/main/app/modules/dcinside/job-logs/job-logs.service'

@Controller('/job-logs')
export class JobLogsController {
  constructor(private readonly jobLogsService: JobLogsService) {}

  @Get('/:jobId')
  async getJobLogs(@Param('jobId') jobId: string) {
    return {
      jobLogs: await this.jobLogsService.getJobLogs(jobId),
    }
  }

  @Get('/:jobId/latest')
  async getLatestJobLog(@Param('jobId') jobId: string) {
    return {
      jobLog: await this.jobLogsService.getLatestJobLog(jobId),
    }
  }
}
