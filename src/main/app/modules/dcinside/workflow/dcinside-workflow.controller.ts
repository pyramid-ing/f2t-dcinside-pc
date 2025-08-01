import { Body, Controller, Post, Req, UploadedFile, UseInterceptors, UseGuards } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { DcinsideWorkflowService } from './dcinside-workflow.service'
import { AuthGuard, Permissions } from '../../auth/auth.guard'

@Controller('posting')
export class DcinsideWorkflowController {
  constructor(private readonly workflowService: DcinsideWorkflowService) {}

  @UseGuards(AuthGuard)
  @Permissions('posting')
  @Post('excel-upload')
  @UseInterceptors(FileInterceptor('file'))
  async excelUpload(@UploadedFile() file: any, @Body() body: any, @Req() req: any) {
    return await this.workflowService.handleExcelUpload(file)
  }
}
