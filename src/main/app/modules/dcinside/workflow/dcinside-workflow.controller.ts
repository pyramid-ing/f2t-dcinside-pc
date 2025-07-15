import { Body, Controller, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { DcinsideWorkflowService } from './dcinside-workflow.service'

@Controller('posting')
export class DcinsideWorkflowController {
  constructor(private readonly workflowService: DcinsideWorkflowService) {}

  @Post('excel-upload')
  @UseInterceptors(FileInterceptor('file'))
  async excelUpload(@UploadedFile() file: any, @Body() body: any, @Req() req: any) {
    return await this.workflowService.handleExcelUpload(file)
  }
}
