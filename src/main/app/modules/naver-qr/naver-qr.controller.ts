import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { NaverQRService } from './naver-qr.service'
import { CreateNaverQRDto, NaverQRResultDto, NaverQRBatchRequestDto, NaverQRBatchResultDto } from './dto/naver-qr.dto'

@Controller('naver-qr')
export class NaverQRController {
  constructor(private readonly naverQRService: NaverQRService) {}

  @Post('create')
  async createQRCode(@Body() dto: CreateNaverQRDto): Promise<NaverQRResultDto> {
    return this.naverQRService.createQRCodeWithBrowser(dto)
  }

  @Post('batch')
  async createBatchQRCodes(@Body() dto: NaverQRBatchRequestDto): Promise<NaverQRBatchResultDto> {
    return this.naverQRService.createBatchQRCodes(dto)
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadExcel(@UploadedFile() file: any): Promise<NaverQRBatchResultDto> {
    return this.naverQRService.processExcelFile(file)
  }
}
