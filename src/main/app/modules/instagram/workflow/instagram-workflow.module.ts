import { InstagramApiModule } from '../api/instagram-api.module'
import { Module } from '@nestjs/common'
import { SettingsModule } from '../../settings/settings.module'
import { InstagramWorkflowController } from './instagram-workflow.controller'

@Module({
  imports: [InstagramApiModule, SettingsModule],
  controllers: [InstagramWorkflowController],
  providers: [],
})
export class InstagramWorkflowModule {}
