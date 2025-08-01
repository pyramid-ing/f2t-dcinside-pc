import { Body, Controller, Get, Post } from '@nestjs/common'
import { AuthService } from './auth.service'
import { RegisterLicenseDto } from './dto/register-license.dto'

@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('/machine-id')
  async getMachineId() {
    const machineId = await this.authService.getMachineId()
    return {
      machineId,
    }
  }

  @Post('/register-license')
  async registerLicense(@Body() registerLicenseDto: RegisterLicenseDto) {
    return await this.authService.registerLicense(registerLicenseDto)
  }
}
