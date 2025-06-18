// 정규화된 에러 클래스들
export enum ErrorCode {
  // Google API 에러들
  GOOGLE_AUTH_FAILED = 'GOOGLE_AUTH_FAILED',
  GOOGLE_TOKEN_EXPIRED = 'GOOGLE_TOKEN_EXPIRED',
  GOOGLE_TOKEN_INVALID = 'GOOGLE_TOKEN_INVALID',
  GOOGLE_API_QUOTA_EXCEEDED = 'GOOGLE_API_QUOTA_EXCEEDED',
  GOOGLE_API_PERMISSION_DENIED = 'GOOGLE_API_PERMISSION_DENIED',
  GOOGLE_INDEXER_FAILED = 'GOOGLE_INDEXER_FAILED',
  GOOGLE_BLOGGER_API_FAILED = 'GOOGLE_BLOGGER_API_FAILED',
  GOOGLE_OAUTH_CONFIG_MISSING = 'GOOGLE_OAUTH_CONFIG_MISSING',
  GOOGLE_SERVICE_ACCOUNT_INVALID = 'GOOGLE_SERVICE_ACCOUNT_INVALID',

  // Bing API 에러들
  BING_AUTH_FAILED = 'BING_AUTH_FAILED',
  BING_API_KEY_MISSING = 'BING_API_KEY_MISSING',
  BING_API_KEY_INVALID = 'BING_API_KEY_INVALID',
  BING_API_QUOTA_EXCEEDED = 'BING_API_QUOTA_EXCEEDED',
  BING_SUBMISSION_FAILED = 'BING_SUBMISSION_FAILED',
  BING_INVALID_URL = 'BING_INVALID_URL',
  BING_SITE_NOT_VERIFIED = 'BING_SITE_NOT_VERIFIED',

  // Naver API 에러들
  NAVER_AUTH_FAILED = 'NAVER_AUTH_FAILED',
  NAVER_LOGIN_REQUIRED = 'NAVER_LOGIN_REQUIRED',
  NAVER_SESSION_EXPIRED = 'NAVER_SESSION_EXPIRED',
  NAVER_SUBMISSION_FAILED = 'NAVER_SUBMISSION_FAILED',
  NAVER_SITE_NOT_REGISTERED = 'NAVER_SITE_NOT_REGISTERED',
  NAVER_BROWSER_ERROR = 'NAVER_BROWSER_ERROR',
  NAVER_PAGE_NOT_FOUND = 'NAVER_PAGE_NOT_FOUND',

  // Daum API 에러들
  DAUM_AUTH_FAILED = 'DAUM_AUTH_FAILED',
  DAUM_SUBMISSION_FAILED = 'DAUM_SUBMISSION_FAILED',
  DAUM_INVALID_URL = 'DAUM_INVALID_URL',
  DAUM_SITE_NOT_REGISTERED = 'DAUM_SITE_NOT_REGISTERED',
  DAUM_REQUEST_FAILED = 'DAUM_REQUEST_FAILED',

  // 일반 에러들
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
}

export interface ErrorDetails {
  code: ErrorCode
  service: string
  operation: string
  url?: string
  siteUrl?: string
  additionalInfo?: Record<string, any>
}

// 정규화된 기본 에러 클래스
export class ServiceError extends Error {
  public readonly code: ErrorCode
  public readonly service: string
  public readonly operation: string
  public readonly details: ErrorDetails

  constructor(
    code: ErrorCode,
    message: string,
    service: string,
    operation: string,
    additionalInfo?: Record<string, any>,
  ) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.service = service
    this.operation = operation
    this.details = {
      code,
      service,
      operation,
      additionalInfo,
    }
  }
}

// Google 특화 에러 클래스들
export class GoogleAuthError extends ServiceError {
  constructor(message: string, operation: string, additionalInfo?: Record<string, any>) {
    super(ErrorCode.GOOGLE_AUTH_FAILED, message, 'Google', operation, additionalInfo)
    this.name = 'GoogleAuthError'
  }
}

export class GoogleTokenError extends ServiceError {
  constructor(message: string, operation: string, isExpired: boolean = false, additionalInfo?: Record<string, any>) {
    const code = isExpired ? ErrorCode.GOOGLE_TOKEN_EXPIRED : ErrorCode.GOOGLE_TOKEN_INVALID
    super(code, message, 'Google', operation, { isExpired, ...additionalInfo })
    this.name = 'GoogleTokenError'
  }
}

export class GoogleIndexerError extends ServiceError {
  constructor(
    message: string,
    operation: string,
    url?: string,
    siteUrl?: string,
    additionalInfo?: Record<string, any>,
  ) {
    super(ErrorCode.GOOGLE_INDEXER_FAILED, message, 'Google Indexer', operation, { url, siteUrl, ...additionalInfo })
    this.name = 'GoogleIndexerError'
    this.details.url = url
    this.details.siteUrl = siteUrl
  }
}

export class GoogleBloggerError extends ServiceError {
  constructor(
    message: string,
    operation: string,
    blogId?: string,
    postId?: string,
    additionalInfo?: Record<string, any>,
  ) {
    super(ErrorCode.GOOGLE_BLOGGER_API_FAILED, message, 'Google Blogger', operation, {
      blogId,
      postId,
      ...additionalInfo,
    })
    this.name = 'GoogleBloggerError'
  }
}

export class GoogleConfigError extends ServiceError {
  constructor(message: string, operation: string, configType?: string, additionalInfo?: Record<string, any>) {
    super(ErrorCode.GOOGLE_OAUTH_CONFIG_MISSING, message, 'Google Config', operation, {
      configType,
      ...additionalInfo,
    })
    this.name = 'GoogleConfigError'
  }
}

// Bing 관련 에러 클래스들
export class BingAuthError extends ServiceError {
  constructor(message: string, operation: string, additionalInfo?: Record<string, any>) {
    super(ErrorCode.BING_AUTH_FAILED, message, 'Bing', operation, additionalInfo)
    this.name = 'BingAuthError'
  }
}

export class BingSubmissionError extends ServiceError {
  constructor(
    message: string,
    operation: string,
    url?: string,
    siteUrl?: string,
    additionalInfo?: Record<string, any>,
  ) {
    super(ErrorCode.BING_SUBMISSION_FAILED, message, 'Bing Webmaster', operation, {
      url,
      siteUrl,
      ...additionalInfo,
    })
    this.name = 'BingSubmissionError'
  }
}

export class BingConfigError extends ServiceError {
  constructor(message: string, operation: string, configType?: string, additionalInfo?: Record<string, any>) {
    super(ErrorCode.BING_API_KEY_MISSING, message, 'Bing Config', operation, { configType, ...additionalInfo })
    this.name = 'BingConfigError'
  }
}

// Naver 관련 에러 클래스들
export class NaverAuthError extends ServiceError {
  constructor(message: string, operation: string, additionalInfo?: Record<string, any>) {
    super(ErrorCode.NAVER_AUTH_FAILED, message, 'Naver', operation, additionalInfo)
    this.name = 'NaverAuthError'
  }
}

export class NaverLoginError extends ServiceError {
  constructor(message: string, operation: string, loginRequired: boolean = true, additionalInfo?: Record<string, any>) {
    super(ErrorCode.NAVER_LOGIN_REQUIRED, message, 'Naver Webmaster', operation, {
      loginRequired,
      ...additionalInfo,
    })
    this.name = 'NaverLoginError'
  }
}

export class NaverSubmissionError extends ServiceError {
  constructor(
    message: string,
    operation: string,
    url?: string,
    siteUrl?: string,
    additionalInfo?: Record<string, any>,
  ) {
    super(ErrorCode.NAVER_SUBMISSION_FAILED, message, 'Naver Webmaster', operation, {
      url,
      siteUrl,
      ...additionalInfo,
    })
    this.name = 'NaverSubmissionError'
  }
}

export class NaverBrowserError extends ServiceError {
  constructor(message: string, operation: string, additionalInfo?: Record<string, any>) {
    super(ErrorCode.NAVER_BROWSER_ERROR, message, 'Naver Browser', operation, additionalInfo)
    this.name = 'NaverBrowserError'
  }
}

// Daum 관련 에러 클래스들
export class DaumAuthError extends ServiceError {
  constructor(message: string, operation: string, additionalInfo?: Record<string, any>) {
    super(ErrorCode.DAUM_AUTH_FAILED, message, 'Daum', operation, additionalInfo)
    this.name = 'DaumAuthError'
  }
}

export class DaumSubmissionError extends ServiceError {
  constructor(
    message: string,
    operation: string,
    url?: string,
    siteUrl?: string,
    additionalInfo?: Record<string, any>,
  ) {
    super(ErrorCode.DAUM_SUBMISSION_FAILED, message, 'Daum Search', operation, { url, siteUrl, ...additionalInfo })
    this.name = 'DaumSubmissionError'
  }
}

export class DaumConfigError extends ServiceError {
  constructor(message: string, operation: string, configType?: string, additionalInfo?: Record<string, any>) {
    super(ErrorCode.DAUM_REQUEST_FAILED, message, 'Daum Config', operation, { configType, ...additionalInfo })
    this.name = 'DaumConfigError'
  }
}

// 에러 응답 타입 정의 (업데이트됨)
export interface ErrorResponse {
  success: false
  statusCode: number
  timestamp: string
  path: string
  error: string
  message: string
  code?: ErrorCode
  service?: string
  operation?: string
  details?: {
    stack?: string[]
    name?: string
    url?: string
    method?: string
    response?: any
    code?: string
    category?: string
    postData?: any
    ffmpegError?: string
    inputData?: any
    siteUrl?: string
    blogId?: string
    postId?: string
    configType?: string
    isExpired?: boolean
    additionalInfo?: Record<string, any>
  }
}

// 블로그 포스트 관련 에러
export class BlogPostError extends Error {
  public readonly category: string
  public readonly postData: any

  constructor(message: string, category: string, postData?: any) {
    super(message)
    this.name = 'BlogPostError'
    this.category = category
    this.postData = postData
  }
}

// 퀴즈 크롤링 관련 에러
export class QuizCrawlingError extends Error {
  public readonly url: string
  public readonly category: string

  constructor(message: string, url: string, category: string) {
    super(message)
    this.name = 'QuizCrawlingError'
    this.url = url
    this.category = category
  }
}

// 비디오 생성 관련 에러
export class VideoGenerationError extends Error {
  public readonly ffmpegError: string
  public readonly inputData: any

  constructor(message: string, ffmpegError: string, inputData?: any) {
    super(message)
    this.name = 'VideoGenerationError'
    this.ffmpegError = ffmpegError
    this.inputData = inputData
  }
}
