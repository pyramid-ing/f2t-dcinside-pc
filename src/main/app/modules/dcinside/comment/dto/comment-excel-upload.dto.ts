import { z } from 'zod'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

// 댓글 엑셀 데이터 처리를 위한 스키마
export const CommentExcelRowSchema = z
  .object({
    'DC URL': z.string(),
    댓글내용: z.string(),
    닉네임: z.string().optional(),
    비밀번호: z.coerce.string().optional(),
    로그인ID: z.string().optional(),
    로그인비밀번호: z.coerce.string().optional(),
    예약날짜: z.string().optional(),
  })
  .transform(data => {
    // 필수 필드 검증
    if (!data['DC URL'] || !data['댓글내용']) {
      throw new CustomHttpException(ErrorCode.INVALID_REQUEST, {
        message: 'DC URL과 댓글내용은 필수입니다.',
      })
    }

    // 로그인 타입에 따른 필수 필드 검증
    const hasLoginInfo = data['로그인ID'] && data['로그인비밀번호']
    const hasNonLoginInfo = data['닉네임'] && data['비밀번호']

    if (!hasLoginInfo && !hasNonLoginInfo) {
      throw new CustomHttpException(ErrorCode.INVALID_REQUEST, {
        message: '로그인 정보(로그인ID, 로그인비밀번호) 또는 비로그인 정보(닉네임, 비밀번호) 중 하나는 필수입니다.',
      })
    }

    // 예약날짜 파싱 및 검증
    let scheduledAt: Date | undefined
    if (data['예약날짜']) {
      const dayjs = require('dayjs')
      const customParseFormat = require('dayjs/plugin/customParseFormat')
      dayjs.extend(customParseFormat)

      const trimmed = data['예약날짜'].toString().trim()

      // 정확한 형식 (YYYY-MM-DD HH:mm 또는 YYYY-MM-DD HH:mm:ss) 허용
      let parsed = dayjs(trimmed, 'YYYY-MM-DD HH:mm:ss', true)

      if (!parsed.isValid()) {
        // 초단위가 없는 경우 분단위로 재시도
        parsed = dayjs(trimmed, 'YYYY-MM-DD HH:mm', true)
      }

      if (!parsed.isValid()) {
        throw new CustomHttpException(ErrorCode.SCHEDULED_DATE_FORMAT_INVALID, {
          message: `예약날짜 형식이 잘못되었습니다. 올바른 형식: YYYY-MM-DD HH:mm 또는 YYYY-MM-DD HH:mm:ss (예: 2025-09-12 14:21 또는 2025-09-12 14:21:30), 입력값: "${trimmed}"`,
          inputValue: trimmed,
        })
      }

      scheduledAt = parsed.toDate()
    }

    return {
      postUrl: data['DC URL'],
      comment: data['댓글내용'],
      nickname: data['닉네임'] || undefined,
      password: data['비밀번호'] ? String(data['비밀번호']) : undefined,
      loginId: data['로그인ID'] || undefined,
      loginPassword: data['로그인비밀번호'] || undefined,
      scheduledAt,
    }
  })

export class CommentExcelUploadDto {
  postUrl: string
  comment: string
  nickname?: string
  password?: string
  loginId?: string
  loginPassword?: string
  scheduledAt?: Date
}

export class BulkCommentJobCreateDto {
  keyword: string
  commentJobs: CommentExcelUploadDto[]
}
