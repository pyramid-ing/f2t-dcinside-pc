import { DcinsidePostingService } from '@main/app/modules/dcinside/api/dcinside-posting.service'
import { Controller } from '@nestjs/common'

@Controller('posting')
export class DcinsidePostingController {
  constructor(private readonly dcinsidePostingService: DcinsidePostingService) {}
}
