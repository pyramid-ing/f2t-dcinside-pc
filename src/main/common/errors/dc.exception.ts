/**
 * 디시인사이드 관련 예외 타입
 */
export enum DcExceptionType {
  COMMENT_DISABLED_PAGE = 'COMMENT_DISABLED_PAGE',
  POST_NOT_FOUND_OR_DELETED = 'POST_NOT_FOUND_OR_DELETED',
  NICKNAME_REQUIRED_GALLERY = 'NICKNAME_REQUIRED_GALLERY',
  NICKNAME_REQUIRED = 'NICKNAME_REQUIRED',
  CAPTCHA_SOLVE_FAILED = 'CAPTCHA_SOLVE_FAILED',
  CHROME_NOT_INSTALLED = 'CHROME_NOT_INSTALLED',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  POST_PARAM_INVALID = 'POST_PARAM_INVALID',
  POST_SUBMIT_FAILED = 'POST_SUBMIT_FAILED',
  IMAGE_UPLOAD_FAILED = 'IMAGE_UPLOAD_FAILED',
  RECAPTCHA_NOT_SUPPORTED = 'RECAPTCHA_NOT_SUPPORTED',
  CAPTCHA_FAILED = 'CAPTCHA_FAILED',
  GALLERY_TYPE_UNSUPPORTED = 'GALLERY_TYPE_UNSUPPORTED',
  VIEW_COUNT_FETCH_FAILED = 'VIEW_COUNT_FETCH_FAILED',
}

/**
 * 디시인사이드 관련 예외 클래스
 * 댓글 작성, 포스팅 등 디시인사이드 작업 중 발생하는 예외를 처리합니다.
 */
export class DcException extends Error {
  constructor(
    public readonly type: DcExceptionType,
    public readonly metadata?: Record<string, any>,
  ) {
    super(type.toString())
    this.name = 'DcException'
  }

  /**
   * 댓글 불가 페이지 예외
   */
  static commentDisabledPage(metadata?: Record<string, any>): DcException {
    return new DcException(DcExceptionType.COMMENT_DISABLED_PAGE, metadata)
  }

  /**
   * 삭제되었거나 존재하지 않는 포스팅 예외
   */
  static postNotFoundOrDeleted(metadata?: Record<string, any>): DcException {
    return new DcException(DcExceptionType.POST_NOT_FOUND_OR_DELETED, metadata)
  }

  /**
   * 닉네임이 필수인 갤러리 예외
   */
  static nicknameRequiredGallery(metadata?: Record<string, any>): DcException {
    return new DcException(DcExceptionType.NICKNAME_REQUIRED_GALLERY, metadata)
  }

  /**
   * 닉네임 필수 예외
   */
  static nicknameRequired(metadata?: Record<string, any>): DcException {
    return new DcException(DcExceptionType.NICKNAME_REQUIRED, metadata)
  }

  /**
   * 캡차 해결 실패 예외
   */
  static captchaSolveFailed(metadata?: Record<string, any>): DcException {
    return new DcException(DcExceptionType.CAPTCHA_SOLVE_FAILED, metadata)
  }

  /**
   * 크롬 브라우저 미설치 예외
   */
  static chromeNotInstalled(metadata?: Record<string, any>): DcException {
    return new DcException(DcExceptionType.CHROME_NOT_INSTALLED, metadata)
  }

  /**
   * 인증 필요 예외
   */
  static authRequired(metadata?: Record<string, any>): DcException {
    return new DcException(DcExceptionType.AUTH_REQUIRED, metadata)
  }

  /**
   * 게시물 파라미터 유효하지 않음 예외
   */
  static postParamInvalid(metadata?: Record<string, any>): DcException {
    return new DcException(DcExceptionType.POST_PARAM_INVALID, metadata)
  }

  /**
   * 게시물 제출 실패 예외
   */
  static postSubmitFailed(metadata?: Record<string, any>): DcException {
    return new DcException(DcExceptionType.POST_SUBMIT_FAILED, metadata)
  }

  /**
   * 이미지 업로드 실패 예외
   */
  static imageUploadFailed(metadata?: Record<string, any>): DcException {
    return new DcException(DcExceptionType.IMAGE_UPLOAD_FAILED, metadata)
  }

  /**
   * reCAPTCHA 미지원 예외
   */
  static recaptchaNotSupported(metadata?: Record<string, any>): DcException {
    return new DcException(DcExceptionType.RECAPTCHA_NOT_SUPPORTED, metadata)
  }

  /**
   * 캡차 실패 예외
   */
  static captchaFailed(metadata?: Record<string, any>): DcException {
    return new DcException(DcExceptionType.CAPTCHA_FAILED, metadata)
  }

  /**
   * 갤러리 타입 미지원 예외
   */
  static galleryTypeUnsupported(metadata?: Record<string, any>): DcException {
    return new DcException(DcExceptionType.GALLERY_TYPE_UNSUPPORTED, metadata)
  }

  /**
   * 조회수 가져오기 실패 예외
   */
  static viewCountFetchFailed(metadata?: Record<string, any>): DcException {
    return new DcException(DcExceptionType.VIEW_COUNT_FETCH_FAILED, metadata)
  }
}
