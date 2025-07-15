import { ErrorCode } from './error-code.enum'

export class CustomHttpException extends Error {
  constructor(
    public readonly errorCode: ErrorCode,
    public readonly metadata?: Record<string, any>,
  ) {
    super(errorCode.toString()) // message는 사용하지 않음
  }
}
