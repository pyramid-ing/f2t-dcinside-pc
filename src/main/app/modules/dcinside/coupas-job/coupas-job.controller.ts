import { Controller, Post, Body, Get, Param, Delete } from '@nestjs/common'
import { CreateCoupasJobDto } from './dto/create-coupas-job.dto'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { JobType } from '@main/app/modules/dcinside/job/job.types'
import { CoupasJobService } from './coupas-job.service'

@Controller('coupas-jobs')
export class CoupasJobController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly coupasJobService: CoupasJobService,
  ) {}

  /**
   * 쿠파스 작업 생성
   */
  @Post()
  async createCoupasJob(@Body() dto: CreateCoupasJobDto) {
    return this.coupasJobService.createCoupasJob({
      postUrl: dto.postUrl,
      wordpressUrl: dto.wordpressUrl,
      wordpressUsername: dto.wordpressUsername,
      wordpressApiKey: dto.wordpressApiKey,
      subject: dto.subject,
      desc: dto.desc,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      nickname: dto.nickname,
      password: dto.password,
      loginId: dto.loginId,
      loginPassword: dto.loginPassword,
    })
  }

  /**
   * 쿠파스 작업 목록 조회
   */
  @Get()
  async getCoupasJobs() {
    const jobs = await this.prismaService.job.findMany({
      where: {
        type: JobType.COUPAS,
      },
      include: {
        coupasJob: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return jobs
  }

  /**
   * 쿠파스 작업 상세 조회
   */
  @Get(':id')
  async getCoupasJob(@Param('id') id: string) {
    const job = await this.prismaService.job.findUnique({
      where: { id },
      include: {
        coupasJob: true,
        logs: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!job) {
      throw new Error('쿠파스 작업을 찾을 수 없습니다.')
    }

    return job
  }

  /**
   * 쿠파스 작업 삭제
   */
  @Delete(':id')
  async deleteCoupasJob(@Param('id') id: string) {
    await this.prismaService.job.delete({
      where: { id },
    })

    return {
      success: true,
      message: '쿠파스 작업이 삭제되었습니다.',
    }
  }
}
