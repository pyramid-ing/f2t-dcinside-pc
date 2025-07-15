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
}
