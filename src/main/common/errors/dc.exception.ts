/**
 * 디시인사이드 관련 예외 타입
 */
export enum DcExceptionType {
  COMMENT_DISABLED_PAGE = 'COMMENT_DISABLED_PAGE',
  POST_NOT_FOUND_OR_DELETED = 'POST_NOT_FOUND_OR_DELETED',
  NICKNAME_REQUIRED_GALLERY = 'NICKNAME_REQUIRED_GALLERY',
  NICKNAME_REQUIRED = 'NICKNAME_REQUIRED',
  CAPTCHA_SOLVE_FAILED = 'CAPTCHA_SOLVE_FAILED',
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
}
