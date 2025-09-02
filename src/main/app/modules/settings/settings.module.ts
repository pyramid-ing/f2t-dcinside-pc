import { Module } from '@nestjs/common'
import { SettingsService } from 'src/main/app/modules/settings/settings.service'
import { SettingsController } from './settings.controller'
import { CommonModule } from '@main/app/modules/common/common.module'
import { UtilModule } from '@main/app/modules/util/util.module'

@Module({
  imports: [CommonModule, UtilModule],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
