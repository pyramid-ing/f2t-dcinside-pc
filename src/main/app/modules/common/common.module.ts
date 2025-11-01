import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { JobContextModule } from './job-context/job-context.module'

@Module({
  imports: [PrismaModule, JobContextModule],
  exports: [PrismaModule, JobContextModule],
})
export class CommonModule {}
