import { Module } from '@nestjs/common'
import { SettingsController } from './settings.controller'
import { PrismaService } from '../../shared/prisma.service'
import { SettingsService } from '../../shared/settings.service'

@Module({
  providers: [PrismaService, SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
