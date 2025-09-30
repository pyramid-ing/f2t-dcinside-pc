import { DcException, DcExceptionType } from '@main/common/errors/dc.exception'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

/**
 * DcException을 CustomHttpException으로 매핑하는 공통 유틸리티 클래스
 */
export class DcExceptionMapper {
  /**
   * DcException을 CustomHttpException으로 매핑
   */
  static mapDcExceptionToCustomHttpException(dcException: DcException): CustomHttpException {
    switch (dcException.type) {
      case DcExceptionType.COMMENT_DISABLED_PAGE:
        return new CustomHttpException(ErrorCode.COMMENT_DISABLED_PAGE, dcException.metadata)
      case DcExceptionType.POST_NOT_FOUND_OR_DELETED:
        return new CustomHttpException(ErrorCode.POST_NOT_FOUND_OR_DELETED, dcException.metadata)
      case DcExceptionType.NICKNAME_REQUIRED_GALLERY:
        return new CustomHttpException(ErrorCode.NICKNAME_REQUIRED_GALLERY, dcException.metadata)
      case DcExceptionType.NICKNAME_REQUIRED:
        return new CustomHttpException(ErrorCode.NICKNAME_REQUIRED, dcException.metadata)
      case DcExceptionType.CAPTCHA_SOLVE_FAILED:
        return new CustomHttpException(ErrorCode.CAPTCHA_SOLVE_FAILED, dcException.metadata)
      case DcExceptionType.CHROME_NOT_INSTALLED:
        return new CustomHttpException(ErrorCode.CHROME_NOT_INSTALLED, dcException.metadata)
      case DcExceptionType.AUTH_REQUIRED:
        return new CustomHttpException(ErrorCode.AUTH_REQUIRED, dcException.metadata)
      case DcExceptionType.POST_PARAM_INVALID:
        return new CustomHttpException(ErrorCode.POST_PARAM_INVALID, dcException.metadata)
      case DcExceptionType.POST_SUBMIT_FAILED:
        return new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, dcException.metadata)
      case DcExceptionType.IMAGE_UPLOAD_FAILED:
        return new CustomHttpException(ErrorCode.IMAGE_UPLOAD_FAILED, dcException.metadata)
      case DcExceptionType.RECAPTCHA_NOT_SUPPORTED:
        return new CustomHttpException(ErrorCode.RECAPTCHA_NOT_SUPPORTED, dcException.metadata)
      case DcExceptionType.CAPTCHA_FAILED:
        return new CustomHttpException(ErrorCode.CAPTCHA_FAILED, dcException.metadata)
      case DcExceptionType.GALLERY_TYPE_UNSUPPORTED:
        return new CustomHttpException(ErrorCode.GALLERY_TYPE_UNSUPPORTED, dcException.metadata)
      default:
        return new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, dcException.metadata)
    }
  }
}
