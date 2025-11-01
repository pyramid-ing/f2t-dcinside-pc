import { Module } from '@nestjs/common'
import { CoupangPartnersService } from './coupang-partners.service'
import { CoupangRateLimiterService } from './coupang-rate-limiter.service'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [SettingsModule],
  controllers: [],
  providers: [CoupangPartnersService, CoupangRateLimiterService],
  exports: [CoupangPartnersService, CoupangRateLimiterService],
})
export class CoupangPartnersModule {}
