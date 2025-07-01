import { Module } from '@nestjs/common'
import { PrismaService } from '@main/app/shared/prisma.service'
import { JobLogsController } from 'src/main/app/modules/dcinside/job-logs/job-logs.controller'
import { JobLogsService } from 'src/main/app/modules/dcinside/job-logs/job-logs.service'

@Module({
  controllers: [JobLogsController],
  providers: [JobLogsService, PrismaService],
  exports: [JobLogsService],
})
export class JobLogsModule {}
