import { CookieService } from '@main/app/modules/util/cookie.service'
import { Module } from '@nestjs/common'
import { PostJobController } from 'src/main/app/modules/dcinside/api/post-job.controller'
import { PostJobService } from 'src/main/app/modules/dcinside/api/post-job.service'
import { SettingsModule } from 'src/main/app/modules/settings/settings.module'
import { PrismaService } from 'src/main/app/shared/prisma.service'
import { DcinsideLoginController } from './dcinside-login.controller'
import { DcinsideLoginService } from './dcinside-login.service'
import { DcinsidePostingController } from './dcinside-posting.controller'
import { DcinsidePostingService } from './dcinside-posting.service'

@Module({
  imports: [SettingsModule],
  controllers: [DcinsidePostingController, DcinsideLoginController, PostJobController],
  providers: [DcinsidePostingService, DcinsideLoginService, CookieService, PostJobService, PrismaService],
  exports: [DcinsidePostingService, DcinsideLoginService, PostJobService],
})
export class DcinsideApiModule {}
