import { Module } from '@nestjs/common'
import { PrismaService } from '@main/app/shared/prisma.service'
import { PostJobController } from 'src/main/app/modules/dcinside/post-job/post-job.controller'
import { PostJobService } from 'src/main/app/modules/dcinside/post-job/post-job.service'
import { PostJobProcessor } from '@main/app/modules/dcinside/post-job/post-job.processor'
import { JobLogsModule } from '@main/app/modules/dcinside/job-logs/job-logs.module'
import { DcinsideApiModule } from '@main/app/modules/dcinside/api/api.module'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { CookieService } from '@main/app/modules/util/cookie.service'

@Module({
  imports: [JobLogsModule, DcinsideApiModule],
  controllers: [PostJobController],
  providers: [PostJobService, PrismaService, PostJobProcessor, SettingsService, CookieService],
  exports: [PostJobService],
})
export class PostJobModule {}
