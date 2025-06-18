import type {
  ArgumentsHost,
  ExceptionFilter,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import {
  Catch,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'

@Catch(HttpException, NotFoundException, UnauthorizedException)
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException | NotFoundException | UnauthorizedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const status = exception instanceof HttpException ? exception.getStatus() : 500

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      errors: exception instanceof HttpException ? exception.getResponse().errors : null, // errors를 포함한 응답
      timestamp: new Date().toISOString(),
      path: request.url,
    })
  }
}
