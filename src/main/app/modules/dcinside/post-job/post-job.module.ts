import { Module } from '@nestjs/common'
import { PrismaService } from '@main/app/shared/prisma.service'
import { PostJobController } from 'src/main/app/modules/dcinside/post-job/post-job.controller'
import { PostJobService } from 'src/main/app/modules/dcinside/post-job/post-job.service'

@Module({
  controllers: [PostJobController],
  providers: [PostJobService, PrismaService],
  exports: [PostJobService],
})
export class PostJobModule {}
