import { Module } from '@nestjs/common'
import { PostJobController } from 'src/main/app/modules/dcinside/post-job/post-job.controller'
import { PostJobService } from 'src/main/app/modules/dcinside/post-job/post-job.service'
import { JobLogsModule } from '@main/app/modules/dcinside/job-logs/job-logs.module'
import { DcinsidePostingModule } from '@main/app/modules/dcinside/posting/dcinside-posting.module'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { CookieService } from '@main/app/modules/util/cookie.service'
import { CommonModule } from '@main/app/modules/common/common.module'
import { UtilModule } from '@main/app/modules/util/util.module'

@Module({
  imports: [JobLogsModule, DcinsidePostingModule, CommonModule, UtilModule],
  controllers: [PostJobController],
  providers: [PostJobService, SettingsService, CookieService],
  exports: [PostJobService],
})
export class PostJobModule {}
