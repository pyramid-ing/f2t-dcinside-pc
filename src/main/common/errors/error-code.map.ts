import { ErrorCode } from './error-code.enum'

export interface ErrorCodeMeta {
  status: number
  message: (metadata?: Record<string, any>) => string
}

export const ErrorCodeMap: Record<ErrorCode, ErrorCodeMeta> = {
  // 인증 관련
  [ErrorCode.AUTH_REQUIRED]: { status: 401, message: () => '로그인이 필요합니다.' },
  [ErrorCode.TOKEN_EXPIRED]: { status: 401, message: () => '토큰이 만료되었습니다.' },

  // 권한
  [ErrorCode.NO_PERMISSION]: { status: 403, message: () => '권한이 없습니다.' },

  // 라이센스 관련
  [ErrorCode.LICENSE_INVALID]: { status: 403, message: () => '유효하지 않은 라이센스입니다.' },
  [ErrorCode.LICENSE_EXPIRED]: { status: 403, message: () => '라이센스가 만료되었습니다.' },
  [ErrorCode.LICENSE_NOT_FOUND]: {
    status: 403,
    message: meta => meta?.message || '라이센스를 찾을 수 없습니다. 먼저 라이센스를 등록해주세요.',
  },
  [ErrorCode.LICENSE_CHECK_FAILED]: { status: 500, message: () => '라이센스 확인에 실패했습니다.' },
  [ErrorCode.LICENSE_PERMISSION_DENIED]: {
    status: 403,
    message: meta => `권한이 없습니다.${meta?.permissions ? ` (필요한 권한: ${meta.permissions.join(', ')})` : ''}`,
  },
  [ErrorCode.LICENSE_REGISTRATION_FAILED]: { status: 500, message: () => '라이센스 등록에 실패했습니다.' },
  [ErrorCode.LICENSE_ALREADY_REGISTERED]: { status: 409, message: () => '이미 등록된 라이센스입니다.' },
  [ErrorCode.LICENSE_KEY_INVALID]: { status: 400, message: () => '유효하지 않은 라이센스 키입니다.' },

  // 유저 관련
  [ErrorCode.USER_NOT_FOUND]: { status: 404, message: () => '사용자를 찾을 수 없습니다.' },
  [ErrorCode.USER_DUPLICATE]: { status: 409, message: () => '이미 존재하는 사용자입니다.' },
  [ErrorCode.INTERNAL_ERROR]: undefined,

  // 디시인사이드 포스팅/이미지/캡챠/갤러리 관련
  [ErrorCode.POST_PARAM_INVALID]: { status: 400, message: m => m?.message || '포스팅 파라미터 검증 실패' },
  [ErrorCode.GALLERY_TYPE_UNSUPPORTED]: { status: 400, message: m => `지원하지 않는 갤러리 타입: ${m?.type}` },
  [ErrorCode.OPENAI_APIKEY_REQUIRED]: { status: 400, message: () => 'OpenAI API 키가 설정되어 있지 않습니다.' },
  [ErrorCode.IMAGE_UPLOAD_FAILED]: { status: 500, message: m => m?.message || '이미지 업로드 실패' },
  [ErrorCode.POST_SUBMIT_FAILED]: { status: 500, message: m => m?.message || '글 등록 실패' },
  [ErrorCode.CAPTCHA_FAILED]: { status: 400, message: () => '캡챠 해제 실패' },
  [ErrorCode.RECAPTCHA_NOT_SUPPORTED]: { status: 400, message: () => 'reCAPTCHA는 지원하지 않습니다.' },
  [ErrorCode.SCHEDULED_DATE_FORMAT_INVALID]: {
    status: 400,
    message: meta => meta?.message || '예약날짜 형식이 잘못되었습니다.',
  },

  // 디시인사이드 댓글 관련
  [ErrorCode.COMMENT_DISABLED_PAGE]: { status: 400, message: m => m?.message || '댓글 작성이 불가능한 페이지입니다' },
  [ErrorCode.POST_NOT_FOUND_OR_DELETED]: {
    status: 404,
    message: m => m?.message || '삭제되었거나 존재하지 않는 게시물입니다',
  },
  [ErrorCode.NICKNAME_REQUIRED_GALLERY]: { status: 400, message: m => m?.message || '닉네임이 필수인 갤러리입니다' },
  [ErrorCode.NICKNAME_REQUIRED]: { status: 400, message: m => m?.message || '닉네임을 입력해주세요' },
  [ErrorCode.CAPTCHA_SOLVE_FAILED]: { status: 400, message: m => m?.message || '캡차 해결에 실패했습니다' },

  [ErrorCode.JOB_NOT_FOUND]: { status: 404, message: () => '작업을 찾을 수 없습니다.' },
  [ErrorCode.JOB_ID_REQUIRED]: { status: 400, message: () => '작업 ID가 제공되지 않았습니다.' },
  [ErrorCode.JOB_ALREADY_PROCESSING]: { status: 409, message: () => '처리 중인 작업입니다.' },
  [ErrorCode.JOB_BULK_RETRY_FAILED]: { status: 500, message: () => '벌크 재시도에 실패했습니다.' },
  [ErrorCode.JOB_BULK_DELETE_FAILED]: { status: 500, message: () => '벌크 삭제에 실패했습니다.' },
  [ErrorCode.JOB_DELETE_PROCESSING]: { status: 400, message: () => '처리 중인 작업은 삭제할 수 없습니다.' },
  [ErrorCode.JOB_LOG_FETCH_FAILED]: { status: 500, message: () => '작업 로그를 가져오는데 실패했습니다.' },
  [ErrorCode.JOB_RETRY_FAILED]: { status: 500, message: () => '작업 재시도에 실패했습니다.' },
  [ErrorCode.JOB_DELETE_FAILED]: { status: 500, message: () => '작업 삭제에 실패했습니다.' },
  [ErrorCode.JOB_FETCH_FAILED]: { status: 500, message: () => '작업 목록을 가져오는데 실패했습니다.' },
  [ErrorCode.JOB_STATUS_INVALID]: {
    status: 400,
    message: meta => `현재 상태에서는 허용되지 않은 작업입니다.${meta?.status ? ` (현재 상태: ${meta.status})` : ''}`,
  },
  [ErrorCode.JOB_STATUS_CHANGE_FAILED]: { status: 500, message: () => '작업 상태 변경에 실패했습니다.' },

  // 시스템 관련
  [ErrorCode.CHROME_NOT_INSTALLED]: {
    status: 500,
    message: () => 'Chrome 브라우저가 설치되어 있지 않습니다. Chrome을 설치한 후 다시 시도해주세요.',
  },
}
