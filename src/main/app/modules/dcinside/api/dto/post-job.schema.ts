import { z } from 'zod/v4'
import { BasePostSchema } from './base-post.schema'

// PostJob DB 객체를 위한 스키마 - 기본 스키마 확장
export const PostJobSchema = BasePostSchema.extend({
  id: z.number(),
  password: z.string().nullable(), // DB에서는 nullable 필드
  nickname: z.string().nullable(), // DB에서는 nullable
  headtext: z.string().nullable(), // DB에서는 nullable (BasePostSchema 오버라이드)
  loginId: z.string().nullable(), // DB에서는 nullable (BasePostSchema 오버라이드)
  loginPassword: z.string().nullable(), // DB에서는 nullable (BasePostSchema 오버라이드)
  imagePaths: z.string().nullable(), // DB에서는 JSON 문자열로 저장
  scheduledAt: z.date().optional(),
  status: z.string().optional(),
  resultMsg: z.string().nullable().optional(),
  resultUrl: z.string().nullable().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

// PostJob을 DcinsidePostParams로 변환하는 스키마 - 기본 스키마 확장
export const PostJobToParamsSchema = BasePostSchema.extend({
  id: z.number(),
  imagePaths: z.preprocess(val => {
    if (!val || val === null) return []
    if (typeof val === 'string') {
      try {
        return JSON.parse(val)
      } catch {
        return []
      }
    }
    return Array.isArray(val) ? val : []
  }, z.array(z.string()).optional()),
  // 여기서 headless는 추가로 계산됨
})
  .refine(
    data => {
      // 로그인 ID가 없으면 비로그인 모드 - 비밀번호만 필수 (닉네임은 optional)
      if (!data.loginId || data.loginId.trim() === '') {
        if (!data.password || data.password.trim() === '') {
          return false
        }
      }
      return true
    },
    {
      message: '비로그인 모드에서는 비밀번호가 필수입니다.',
      path: ['password'], // 에러가 표시될 필드
    },
  )
  .transform(data => {
    // imagePaths가 null이면 빈 배열로 변환
    const imagePaths = data.imagePaths || []

    // 로그인 ID가 있으면 로그인 모드 (nickname, password 무시)
    // 로그인 ID가 없으면 비로그인 모드 (nickname, password 사용)
    const hasLoginId = data.loginId && data.loginId.trim() !== ''

    return {
      galleryUrl: data.galleryUrl,
      title: data.title,
      contentHtml: data.contentHtml,
      password: hasLoginId ? '' : data.password, // 로그인 모드면 빈 문자열, 비로그인 모드면 입력된 password
      nickname: hasLoginId ? undefined : data.nickname || undefined, // 로그인 모드면 undefined
      headtext: data.headtext || undefined,
      imagePaths,
      loginId: hasLoginId ? data.loginId : undefined,
      loginPassword: hasLoginId ? data.loginPassword || undefined : undefined,
    }
  })

// Excel 데이터 처리를 위한 스키마
export const ExcelRowSchema = z
  .object({
    갤러리주소: z.string(),
    제목: z.string(),
    닉네임: z.string().optional(),
    내용HTML: z.string(),
    비밀번호: z.string().optional(),
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
    로그인비번: z.string().optional(),
    말머리: z.string().optional(),
    예약날짜: z.string().optional(),
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
    }
  })

// 타입 추출
export type PostJobDto = z.infer<typeof PostJobSchema>
