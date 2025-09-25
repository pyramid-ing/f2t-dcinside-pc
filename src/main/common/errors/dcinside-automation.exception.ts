import { ErrorCode } from './error-code.enum'

export class DcinsideAutomationError extends Error {
  constructor(
    public readonly errorCode: ErrorCode,
    public readonly metadata?: Record<string, any>,
  ) {
    super(errorCode.toString())
  }
}
