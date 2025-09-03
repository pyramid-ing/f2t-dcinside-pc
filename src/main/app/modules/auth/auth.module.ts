import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AuthInitializer } from './auth.initializer'
import { SettingsModule } from '@main/app/modules/settings/settings.module'

@Module({
  imports: [SettingsModule],
  controllers: [AuthController],
  providers: [AuthService, AuthInitializer],
})
export class AuthModule {}
