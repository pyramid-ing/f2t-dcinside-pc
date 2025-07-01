import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/main/app/shared/prisma.service'

@Injectable()
export class JobLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async getJobLogs(jobId: string) {
    return this.prisma.jobLog.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getLatestJobLog(jobId: string) {
    return this.prisma.jobLog.findFirst({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createJobLog(jobId: string, message: string) {
    return this.prisma.jobLog.create({
      data: {
        jobId,
        message,
      },
    })
  }

  async deleteJobLogsByJobId(jobId: string) {
    return this.prisma.jobLog.deleteMany({
      where: { jobId },
    })
  }
}
