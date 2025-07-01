import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { UtilModule } from '@main/app/modules/util/util.module'
import { PrismaService } from '@main/app/shared/prisma.service'
import { Module } from '@nestjs/common'
import { PostJobModule } from 'src/main/app/modules/dcinside/post-job/post-job.module'
import { DcinsideWorkflowController } from './dcinside-workflow.controller'
import { DcinsideWorkflowService } from './dcinside-workflow.service'

@Module({
  imports: [SettingsModule, UtilModule, PostJobModule],
  controllers: [DcinsideWorkflowController],
  providers: [DcinsideWorkflowService, PrismaService],
})
export class DcinsideWorkflowModule {}
