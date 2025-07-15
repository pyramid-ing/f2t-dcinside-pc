import { SettingsModule } from '@main/app/modules/settings/settings.module'
import { Module } from '@nestjs/common'
import { PostJobModule } from 'src/main/app/modules/dcinside/post-job/post-job.module'
import { DcinsideWorkflowController } from './dcinside-workflow.controller'
import { DcinsideWorkflowService } from './dcinside-workflow.service'

@Module({
  imports: [SettingsModule, PostJobModule],
  controllers: [DcinsideWorkflowController],
  providers: [DcinsideWorkflowService],
})
export class DcinsideWorkflowModule {}
