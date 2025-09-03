import { z } from 'zod/v4'

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
    예약삭제날짜: z.string().optional(),
    이미지위치: z.string().optional(),
  })
  .transform(data => {
    // 이미지 경로들을 배열로 변환
    const imagePaths = []
    for (let i = 1; i <= 10; i++) {
      const imagePath = data[`이미지경로${i}` as keyof typeof data]
      if (imagePath && imagePath.trim()) {
        const absolutePath = require('path').isAbsolute(imagePath)
          ? imagePath
          : require('path').resolve(process.cwd(), imagePath)
        imagePaths.push(absolutePath)
      }
    }

    // 예약날짜 파싱
    let scheduledAt: Date | undefined
    let deleteAt: Date | undefined
    if (data.예약날짜) {
      const dayjs = require('dayjs')
      const customParseFormat = require('dayjs/plugin/customParseFormat')
      dayjs.extend(customParseFormat)

      const trimmed = data.예약날짜.toString().trim()
      let parsed = dayjs(trimmed, 'YYYY-MM-DD HH:mm', true)

      if (!parsed.isValid()) {
        parsed = dayjs(trimmed)
      }

      if (parsed.isValid()) {
        scheduledAt = parsed.toDate()
      }
    }

    // 예약삭제날짜 파싱
    if (data.예약삭제날짜) {
      const dayjs = require('dayjs')
      const customParseFormat = require('dayjs/plugin/customParseFormat')
      dayjs.extend(customParseFormat)

      const trimmed = data.예약삭제날짜.toString().trim()
      let parsed = dayjs(trimmed, 'YYYY-MM-DD HH:mm', true)

      if (!parsed.isValid()) {
        parsed = dayjs(trimmed)
      }

      if (parsed.isValid()) {
        deleteAt = parsed.toDate()
      }
    }

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
      imagePosition: data.이미지위치 && data.이미지위치.trim() ? data.이미지위치 : undefined,
    }
  })
