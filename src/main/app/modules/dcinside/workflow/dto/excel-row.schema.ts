import { z } from 'zod/v4'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'

// Excel 데이터 처리를 위한 스키마
export const ExcelRowSchema = z
  .object({
    갤러리주소: z.string(),
    제목: z.string(),
    닉네임: z.string().optional(),
    내용HTML: z.string(),
    비밀번호: z.coerce.string().optional(),
    이미지경로1: z.string().optional(),
    이미지경로2: z.string().optional(),
    이미지경로3: z.string().optional(),
    이미지경로4: z.string().optional(),
    이미지경로5: z.string().optional(),
    이미지경로6: z.string().optional(),
    이미지경로7: z.string().optional(),
    이미지경로8: z.string().optional(),
    이미지경로9: z.string().optional(),
    이미지경로10: z.string().optional(),
    로그인ID: z.string().optional(),
    로그인비번: z.coerce.string().optional(),
    말머리: z.string().optional(),
    예약날짜: z.string().optional(),
    '등록후자동삭제(분)': z.coerce.number().int().optional(),
    이미지위치: z.string().optional(),
    댓글: z.string().optional(),
  })
  .transform(data => {
    // 이미지 경로들을 배열로 변환
    const imagePaths = []
    for (let i = 1; i <= 10; i++) {
      const imagePath = data[`이미지경로${i}` as keyof typeof data] as string
      if (imagePath && imagePath.trim()) {
        const absolutePath = require('path').isAbsolute(imagePath)
          ? imagePath
          : require('path').resolve(process.cwd(), imagePath)
        imagePaths.push(absolutePath)
      }
    }

    // 예약날짜 파싱 및 검증
    let scheduledAt: Date | undefined
    let deleteAt: Date | undefined
    if (data.예약날짜) {
      const dayjs = require('dayjs')
      const customParseFormat = require('dayjs/plugin/customParseFormat')
      dayjs.extend(customParseFormat)

      const trimmed = data.예약날짜.toString().trim()

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

    // '등록후자동삭제(분)' 처리: autoDeleteMinutes로 저장 (deleteAt은 등록 완료 시 계산)
    const autoDeleteMinutesRaw = data['등록후자동삭제(분)']
    const autoDeleteMinutes =
      autoDeleteMinutesRaw !== undefined &&
      autoDeleteMinutesRaw !== null &&
      `${autoDeleteMinutesRaw}`.toString().trim() !== ''
        ? Number(autoDeleteMinutesRaw)
        : undefined

    return {
      galleryUrl: data.갤러리주소,
      title: data.제목 || '',
      contentHtml: data.내용HTML || '',
      password: data.비밀번호 ? String(data.비밀번호) : '',
      nickname: data.닉네임 || '',
      headtext: data.말머리 || '',
      imagePaths,
      loginId: data.로그인ID || '',
      loginPassword: data.로그인비번 || '',
      scheduledAt,
      deleteAt,
      autoDeleteMinutes,
      imagePosition: data.이미지위치 && data.이미지위치.trim() ? data.이미지위치 : undefined,
      comment: data.댓글 && data.댓글.trim() ? data.댓글 : undefined,
    }
  })
