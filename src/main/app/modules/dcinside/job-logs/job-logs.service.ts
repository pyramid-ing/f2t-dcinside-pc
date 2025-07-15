import { Injectable } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'

@Injectable()
export class JobLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async getJobLogs(jobId: string) {
    return this.prisma.jobLog.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        jobId: true,
        message: true,
        createdAt: true,
      },
    })
  }

  async getLatestJobLog(jobId: string) {
    return this.prisma.jobLog.findFirst({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        jobId: true,
        message: true,
        createdAt: true,
      },
    })
  }

  async createJobLog(jobId: string, message: string, level: 'info' | 'error' | 'warn' = 'info') {
    return this.prisma.jobLog.create({
      data: {
        jobId,
        message,
        level,
      },
    })
  }
}
