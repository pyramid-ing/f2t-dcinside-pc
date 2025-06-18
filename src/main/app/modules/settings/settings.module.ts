import { Module } from '@nestjs/common'
import { SettingsService } from 'src/main/app/modules/settings/settings.service'
import { PrismaService } from 'src/main/app/shared/prisma.service'
import { SettingsController } from './settings.controller'

@Module({
  providers: [PrismaService, SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
