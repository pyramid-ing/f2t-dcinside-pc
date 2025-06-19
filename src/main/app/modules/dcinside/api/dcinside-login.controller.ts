import type { DcinsideLoginDto } from '@main/app/modules/dcinside/api/dto/dcinside-login.dto'
import { DcinsideLoginService } from '@main/app/modules/dcinside/api/dcinside-login.service'
import { Body, Controller, Post } from '@nestjs/common'

@Controller('login')
export class DcinsideLoginController {
  constructor(private readonly dcinsideLoginService: DcinsideLoginService) {}

  @Post()
  async login(@Body() dto: DcinsideLoginDto) {
    return await this.dcinsideLoginService.login(dto)
  }
}
