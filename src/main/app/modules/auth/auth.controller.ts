import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common'
import { AuthGuard, Permission } from './auth.guard'
import { AuthService } from './auth.service'
import { RegisterLicenseDto } from './dto/register-license.dto'
import { SettingsService } from '@main/app/modules/settings/settings.service'

interface CheckPermissionsDto {
  permissions: Permission[]
}

interface LicenseInfoResponse {
  permissions: Permission[]
  isValid: boolean
  expiresAt?: number
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get('machine-id')
  async getMachineId() {
    const machineId = await this.authService.getMachineId()
    return {
      machineId,
    }
  }

  @Post('register-license')
  async registerLicense(@Body() registerLicenseDto: RegisterLicenseDto) {
    return await this.authService.registerLicense(registerLicenseDto)
  }

  @Post('check-permissions')
  @UseGuards(AuthGuard)
  async checkPermissions(@Body() body: CheckPermissionsDto): Promise<LicenseInfoResponse> {
    const settings = await this.settingsService.getSettings()
    const licenseCache = settings.licenseCache

    if (!licenseCache || !licenseCache.isValid) {
      return {
        permissions: [],
        isValid: false,
      }
    }

    return {
      permissions: licenseCache.permissions,
      isValid: licenseCache.isValid,
      expiresAt: licenseCache.expiresAt,
    }
  }

  @Get('license-info')
  async getLicenseInfo(): Promise<LicenseInfoResponse> {
    const settings = await this.settingsService.getSettings()
    const licenseCache = settings.licenseCache

    if (!licenseCache || !licenseCache.isValid) {
      return {
        permissions: [],
        isValid: false,
      }
    }

    return {
      permissions: licenseCache.permissions,
      isValid: licenseCache.isValid,
      expiresAt: licenseCache.expiresAt,
    }
  }
}
