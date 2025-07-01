import { Module } from '@nestjs/common'
import { SettingsModule } from 'src/main/app/modules/settings/settings.module'
import { PrismaService } from 'src/main/app/shared/prisma.service'
import { DcinsidePostingService } from './dcinside-posting.service'
import { JobLogsModule } from 'src/main/app/modules/dcinside/job-logs/job-logs.module'
import { UtilModule } from '@main/app/modules/util/util.module'

@Module({
  imports: [SettingsModule, UtilModule, JobLogsModule],
  controllers: [],
  providers: [DcinsidePostingService, PrismaService],
  exports: [DcinsidePostingService, JobLogsModule],
})
export class DcinsideApiModule {}
