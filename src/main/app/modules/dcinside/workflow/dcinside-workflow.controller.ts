import { Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { DcinsideWorkflowService } from './dcinside-workflow.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { AuthGuard, Permission, Permissions } from '@main/app/modules/auth/auth.guard'

@Controller('posting')
export class DcinsideWorkflowController {
  constructor(private readonly dcinsideWorkflowService: DcinsideWorkflowService) {}

  @UseGuards(AuthGuard)
  @Permissions(Permission.POSTING)
  @Post('upload-excel')
  @UseInterceptors(FileInterceptor('file'))
  async uploadExcel(@UploadedFile() file: any) {
    try {
      if (!file) {
        throw new CustomHttpException(ErrorCode.POST_PARAM_INVALID, {
          message: '파일이 업로드되지 않았습니다.',
        })
      }

      const result = await this.dcinsideWorkflowService.handleExcelUpload(file)
      return result
    } catch (error) {
      if (error instanceof CustomHttpException) {
        throw error
      }
      throw new CustomHttpException(ErrorCode.POST_PARAM_INVALID, {
        message: '엑셀 파일 처리 중 오류가 발생했습니다.',
      })
    }
  }
}
