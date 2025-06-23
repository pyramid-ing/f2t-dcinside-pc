import { z } from 'zod/v4'

// DcinsidePost 스키마
export const DcinsidePostSchema = z
  .object({
    galleryUrl: z.string().url('유효한 갤러리 URL을 입력해주세요.'),
    title: z.string().min(1, '제목을 입력해주세요.'),
    contentHtml: z.string().min(1, '내용을 입력해주세요.'),
    password: z.string().optional(), // 조건부로 필수가 될 수 있음
    nickname: z.string().optional(), // 조건부로 필수가 될 수 있음
    headless: z
      .preprocess(v => {
        if (typeof v === 'boolean') return v
        if (v === 'true') return true
        if (v === 'false') return false
        return false
      }, z.boolean())
      .optional(),
    imagePaths: z.preprocess(v => {
      if (Array.isArray(v)) return v
      if (typeof v === 'string') return [v]
      return []
    }, z.array(z.string()).optional()),
    scheduledAt: z.preprocess(v => {
      // 빈 값 처리
      if (!v || v === '' || v === null || v === undefined) {
        return undefined
      }

      // 이미 Date 객체인 경우
      if (v instanceof Date) {
        return isNaN(v.getTime()) ? undefined : v
      }

      // 문자열인 경우
      if (typeof v === 'string') {
        const trimmed = v.trim()
        if (trimmed === '') {
          return undefined
        }

        const date = new Date(trimmed)
        return isNaN(date.getTime()) ? undefined : date
      }

      return undefined
    }, z.date().optional()),
    loginId: z.string().optional(),
    loginPassword: z.string().optional(),
    headtext: z.string().optional(),
  })
  .refine(
    data => {
      // 로그인 ID가 없으면 비로그인 모드 - 닉네임과 비밀번호 필수
      if (!data.loginId || data.loginId.trim() === '') {
        if (!data.nickname || data.nickname.trim() === '') {
          return false
        }
        if (!data.password || data.password.trim() === '') {
          return false
        }
      }
      return true
    },
    {
      message: '비로그인 모드에서는 닉네임과 비밀번호가 필수입니다.',
      path: ['nickname'], // 에러가 표시될 필드
    },
  )
  .refine(
    data => {
      // 로그인 ID가 없으면 비로그인 모드 - 비밀번호 필수 (별도 체크로 더 명확한 에러 메시지)
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

// DcinsideLogin 스키마
export const DcinsideLoginSchema = z.object({
  id: z.string().min(1, '아이디를 입력해주세요.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
  headless: z
    .preprocess(v => {
      if (typeof v === 'boolean') return v
      if (v === 'true') return true
      if (v === 'false') return false
      return false
    }, z.boolean())
    .optional(),
})

// 타입 추출
export type DcinsidePostDto = z.infer<typeof DcinsidePostSchema>
export type DcinsideLoginDto = z.infer<typeof DcinsideLoginSchema>
