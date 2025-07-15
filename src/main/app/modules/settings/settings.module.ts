import { Module } from '@nestjs/common'
import { SettingsService } from 'src/main/app/modules/settings/settings.service'
import { SettingsController } from './settings.controller'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [CommonModule],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
