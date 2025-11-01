import { Injectable } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobContextService } from '@main/app/modules/common/job-context/job-context.service'

@Injectable()
export class JobLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobContext: JobContextService,
  ) {}

  /**
   * Job 로그 조회
   * jobId는 JobContext에서 자동으로 가져옴
   */
  async getJobLogs() {
    const jobId = this.jobContext.getJobId()
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

  /**
   * 최신 Job 로그 조회
   * jobId는 JobContext에서 자동으로 가져옴
   */
  async getLatestJobLog() {
    const jobId = this.jobContext.getJobId()
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

  /**
   * Job 로그 생성
   * jobId는 JobContext에서 자동으로 가져옴
   *
   * @param message - 로그 메시지
   * @param level - 로그 레벨 (기본값: 'info')
   *
   * @example
   * await createJobLog('로그인 성공')
   * await createJobLog('에러 발생', 'error')
   */
  async createJobLog(message: string, level: 'info' | 'error' | 'warn' = 'info') {
    const jobId = this.jobContext.getJobId()

    return this.prisma.jobLog.create({
      data: {
        jobId,
        message,
        level,
      },
    })
  }
}
