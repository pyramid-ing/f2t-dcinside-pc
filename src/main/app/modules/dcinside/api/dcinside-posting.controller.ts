import type { DcinsidePostDto } from '@main/app/modules/dcinside/api/dto/dcinside-post.dto'
import { DcinsidePostingService } from '@main/app/modules/dcinside/api/dcinside-posting.service'
import { Body, Controller, Post } from '@nestjs/common'

@Controller('posting')
export class DcinsidePostingController {
  constructor(private readonly dcinsidePostingService: DcinsidePostingService) {}

  @Post()
  async postArticle(@Body() dto: DcinsidePostDto) {
    return await this.dcinsidePostingService.postArticle(dto)
  }
}
