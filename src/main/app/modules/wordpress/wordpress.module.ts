import { Module } from '@nestjs/common'
import { WordPressApiService } from './wordpress-api.service'
import { CommonModule } from '@main/app/modules/common/common.module'
import { SettingsModule } from '@main/app/modules/settings/settings.module'

@Module({
  imports: [CommonModule, SettingsModule],
  providers: [WordPressApiService],
  exports: [WordPressApiService],
})
export class WordPressModule {}
