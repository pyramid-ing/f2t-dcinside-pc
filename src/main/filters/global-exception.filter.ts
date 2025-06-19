import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import type { HttpAdapterHost } from '@nestjs/core'
import type { ErrorResponse } from './error.types'
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { AxiosError } from 'axios'
import {
  BingAuthError,
  BingConfigError,
  BingSubmissionError,
  BlogPostError,
  DaumAuthError,
  DaumConfigError,
  DaumSubmissionError,
  ErrorCode,
  GoogleAuthError,
  GoogleBloggerError,
  GoogleConfigError,
  GoogleIndexerError,
  GoogleTokenError,
  NaverAuthError,
  NaverBrowserError,
  NaverLoginError,
  NaverSubmissionError,
  QuizCrawlingError,
  ServiceError,
  VideoGenerationError,
} from './error.types'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost
    const ctx = host.switchToHttp()

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal server error'
    let error = 'Unknown Error'
    let code: ErrorCode | undefined
    let service: string | undefined
    let operation: string | undefined
    let details = null

    // 정규화된 에러 처리
    if (exception instanceof ServiceError) {
      statusCode = this.getStatusCodeForServiceError(exception.code)
      message = exception.message
      error = exception.name
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    }
    // Google 특화 에러들
    else if (exception instanceof GoogleAuthError) {
      statusCode = HttpStatus.UNAUTHORIZED
      message = exception.message
      error = 'Google 인증 실패'
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    } else if (exception instanceof GoogleTokenError) {
      statusCode = exception.details.additionalInfo?.isExpired ? HttpStatus.UNAUTHORIZED : HttpStatus.FORBIDDEN
      message = exception.message
      error = 'Google 토큰 오류'
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    } else if (exception instanceof GoogleIndexerError) {
      statusCode = HttpStatus.BAD_GATEWAY
      message = exception.message
      error = 'Google 인덱싱 실패'
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    } else if (exception instanceof GoogleBloggerError) {
      statusCode = HttpStatus.BAD_GATEWAY
      message = exception.message
      error = 'Google Blogger API 오류'
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    } else if (exception instanceof GoogleConfigError) {
      statusCode = HttpStatus.BAD_REQUEST
      message = exception.message
      error = 'Google 설정 오류'
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    }
    // Bing 관련 에러들
    else if (exception instanceof BingAuthError) {
      statusCode = HttpStatus.UNAUTHORIZED
      message = exception.message
      error = 'Bing 인증 실패'
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    } else if (exception instanceof BingSubmissionError) {
      statusCode = HttpStatus.BAD_GATEWAY
      message = exception.message
      error = 'Bing 제출 실패'
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    } else if (exception instanceof BingConfigError) {
      statusCode = HttpStatus.BAD_REQUEST
      message = exception.message
      error = 'Bing 설정 오류'
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    }
    // Naver 관련 에러들
    else if (exception instanceof NaverAuthError) {
      statusCode = HttpStatus.UNAUTHORIZED
      message = exception.message
      error = 'Naver 인증 실패'
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    } else if (exception instanceof NaverLoginError) {
      statusCode = HttpStatus.UNAUTHORIZED
      message = exception.message
      error = 'Naver 로그인 필요'
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    } else if (exception instanceof NaverSubmissionError) {
      statusCode = HttpStatus.BAD_GATEWAY
      message = exception.message
      error = 'Naver 제출 실패'
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    } else if (exception instanceof NaverBrowserError) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR
      message = exception.message
      error = 'Naver 브라우저 오류'
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    }
    // Daum 관련 에러들
    else if (exception instanceof DaumAuthError) {
      statusCode = HttpStatus.UNAUTHORIZED
      message = exception.message
      error = 'Daum 인증 실패'
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    } else if (exception instanceof DaumSubmissionError) {
      statusCode = HttpStatus.BAD_GATEWAY
      message = exception.message
      error = 'Daum 제출 실패'
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    } else if (exception instanceof DaumConfigError) {
      statusCode = HttpStatus.BAD_REQUEST
      message = exception.message
      error = 'Daum 설정 오류'
      code = exception.code
      service = exception.service
      operation = exception.operation
      details = {
        ...exception.details,
        stack: this.formatStackTrace(exception.stack),
      }
    }
    // 기존 에러들
    else if (exception instanceof QuizCrawlingError) {
      statusCode = HttpStatus.BAD_GATEWAY
      message = exception.message
      error = exception.name
      details = {
        url: exception.url,
        category: exception.category,
        stack: this.formatStackTrace(exception.stack),
      }
    } else if (exception instanceof BlogPostError) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR
      message = exception.message
      error = exception.name
      details = {
        category: exception.category,
        postData: exception.postData,
        stack: this.formatStackTrace(exception.stack),
      }
    } else if (exception instanceof VideoGenerationError) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR
      message = exception.message
      error = exception.name
      details = {
        ffmpegError: exception.ffmpegError,
        inputData: exception.inputData,
        stack: this.formatStackTrace(exception.stack),
      }
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus()
      const response = exception.getResponse()
      if (typeof response === 'object') {
        message = (response as any).message || message
        error = (response as any).error || error
      } else {
        message = response
      }
    } else if (exception instanceof AxiosError) {
      statusCode = exception.response?.status || HttpStatus.BAD_GATEWAY
      message = this.getAxiosErrorMessage(exception)
      error = 'External API Error'
      details = {
        url: exception.config?.url,
        method: exception.config?.method?.toUpperCase(),
        response: exception.response?.data,
        code: exception.code,
      }
    } else if (exception instanceof Error) {
      message = exception.message
      error = exception.name
      details = {
        stack: this.formatStackTrace(exception.stack),
        name: exception.name,
      }
    }

    const responseBody: ErrorResponse = {
      success: false,
      statusCode,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      error,
      message,
      code,
      service,
      operation,
      details,
    }

    // 에러 로깅 (구조화된 로그)
    this.logger.error({
      message: `[${service || 'Unknown'}/${operation || 'Unknown'}] ${error}: ${message}`,
      path: responseBody.path,
      code,
      service,
      operation,
      details: responseBody.details,
      stack: exception instanceof Error ? exception.stack : undefined,
    })

    httpAdapter.reply(ctx.getResponse(), responseBody, statusCode)
  }

  private getStatusCodeForServiceError(code: ErrorCode): number {
    switch (code) {
      case ErrorCode.GOOGLE_AUTH_FAILED:
      case ErrorCode.GOOGLE_TOKEN_EXPIRED:
      case ErrorCode.BING_AUTH_FAILED:
      case ErrorCode.NAVER_AUTH_FAILED:
      case ErrorCode.NAVER_LOGIN_REQUIRED:
      case ErrorCode.NAVER_SESSION_EXPIRED:
      case ErrorCode.DAUM_AUTH_FAILED:
      case ErrorCode.UNAUTHORIZED:
        return HttpStatus.UNAUTHORIZED

      case ErrorCode.GOOGLE_TOKEN_INVALID:
      case ErrorCode.GOOGLE_API_PERMISSION_DENIED:
      case ErrorCode.BING_API_KEY_INVALID:
      case ErrorCode.BING_SITE_NOT_VERIFIED:
      case ErrorCode.FORBIDDEN:
        return HttpStatus.FORBIDDEN

      case ErrorCode.GOOGLE_OAUTH_CONFIG_MISSING:
      case ErrorCode.BING_API_KEY_MISSING:
      case ErrorCode.BING_INVALID_URL:
      case ErrorCode.NAVER_SITE_NOT_REGISTERED:
      case ErrorCode.DAUM_INVALID_URL:
      case ErrorCode.DAUM_SITE_NOT_REGISTERED:
      case ErrorCode.VALIDATION_ERROR:
        return HttpStatus.BAD_REQUEST

      case ErrorCode.NAVER_PAGE_NOT_FOUND:
      case ErrorCode.NOT_FOUND:
        return HttpStatus.NOT_FOUND

      case ErrorCode.GOOGLE_API_QUOTA_EXCEEDED:
      case ErrorCode.BING_API_QUOTA_EXCEEDED:
        return HttpStatus.TOO_MANY_REQUESTS

      case ErrorCode.GOOGLE_INDEXER_FAILED:
      case ErrorCode.GOOGLE_BLOGGER_API_FAILED:
      case ErrorCode.BING_SUBMISSION_FAILED:
      case ErrorCode.NAVER_SUBMISSION_FAILED:
      case ErrorCode.DAUM_SUBMISSION_FAILED:
      case ErrorCode.DAUM_REQUEST_FAILED:
      case ErrorCode.EXTERNAL_API_ERROR:
        return HttpStatus.BAD_GATEWAY

      case ErrorCode.GOOGLE_SERVICE_ACCOUNT_INVALID:
      case ErrorCode.NAVER_BROWSER_ERROR:
      case ErrorCode.INTERNAL_SERVER_ERROR:
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR
    }
  }

  private getAxiosErrorMessage(error: AxiosError): string {
    if (error.response) {
      // 서버가 2xx 범위를 벗어난 상태 코드로 응답한 경우
      return `External API responded with status ${error.response.status}: ${error.message}`
    } else if (error.request) {
      // 요청은 보냈지만 응답을 받지 못한 경우
      return 'No response received from external API'
    } else {
      // 요청 설정 중에 문제가 발생한 경우
      return `Error setting up the request: ${error.message}`
    }
  }

  private formatStackTrace(stack: string | undefined): string[] | undefined {
    if (!stack) return undefined

    return stack
      .split('\n')
      .slice(1) // 첫 번째 줄(에러 메시지) 제외
      .map(line => line.trim())
      .filter(line => !line.includes('node_modules')) // node_modules 경로 제외
      .map(line => {
        // 파일 경로에서 프로젝트 루트 기준 상대 경로만 표시
        const match = line.match(/\((.+)\)/)
        if (match) {
          const path = match[1]
          const projectPath = path.split('/f2t-dcinside-pc/').pop()
          return projectPath ? `at ${projectPath}` : line
        }
        return line
      })
  }
}
