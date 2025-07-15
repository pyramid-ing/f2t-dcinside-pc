import { ErrorCodeMap } from '@main/common/errors/error-code.map'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse()

    let status = 500
    let errorCode: ErrorCode = ErrorCode.INTERNAL_ERROR
    let message = '서버 오류가 발생했습니다.'
    let metadata = {}

    if (exception instanceof CustomHttpException) {
      errorCode = exception.errorCode
      metadata = exception.metadata || {}

      const mapped = ErrorCodeMap[errorCode]
      if (mapped) {
        status = mapped.status
        message = mapped.message(metadata)
      }
    }

    res.status(status).json({
      success: false,
      errorCode,
      message,
      metadata,
    })
  }
}
