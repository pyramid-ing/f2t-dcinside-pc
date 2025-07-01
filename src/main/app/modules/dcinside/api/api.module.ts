import { CookieService } from '@main/app/modules/util/cookie.service'
import { Module } from '@nestjs/common'
import { SettingsModule } from 'src/main/app/modules/settings/settings.module'
import { PrismaService } from 'src/main/app/shared/prisma.service'
import { DcinsideLoginService } from './dcinside-login.service'
import { DcinsidePostingService } from './dcinside-posting.service'
import { JobLogsModule } from 'src/main/app/modules/dcinside/job-logs/job-logs.module'
import { PostJobModule } from 'src/main/app/modules/dcinside/post-job/post-job.module'
import { UtilModule } from '@main/app/modules/util/util.module'

@Module({
  imports: [SettingsModule, UtilModule, PostJobModule, JobLogsModule],
  controllers: [],
  providers: [DcinsidePostingService, DcinsideLoginService, CookieService, PrismaService],
  exports: [DcinsidePostingService, DcinsideLoginService, PostJobModule, JobLogsModule],
})
export class DcinsideApiModule {}
