import { ErrorCodeMap } from '@main/common/errors/error-code.map'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse()
    const req = ctx.getRequest()

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

    // 에러 로깅
    const errorLog = {
      errorCode,
      status,
      message,
      metadata,
      url: req?.url,
      method: req?.method,
      stack: exception?.stack,
      timestamp: new Date().toISOString(),
    }

    if (status >= 500) {
      // 서버 에러 (5xx)는 error 레벨로 로깅
      this.logger.error('서버 에러 발생', errorLog)
    } else {
      // 클라이언트 에러 (4xx)는 warn 레벨로 로깅
      this.logger.warn('클라이언트 에러 발생', errorLog)
    }

    res.status(status).json({
      success: false,
      errorCode,
      message,
      metadata,
    })
  }
}
