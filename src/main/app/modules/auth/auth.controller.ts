import { Controller, Get } from '@nestjs/common'
import { AuthService } from './auth.service'

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
}
