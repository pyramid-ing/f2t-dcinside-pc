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

// PostJob DB 객체를 위한 스키마
export const PostJobSchema = z.object({
  id: z.number(),
  galleryUrl: z.string(),
  title: z.string(),
  contentHtml: z.string(),
  password: z.string(),
  nickname: z.string().nullable(),
  headtext: z.string().nullable(),
  imagePaths: z.string().nullable(), // JSON 문자열
  loginId: z.string().nullable(),
  loginPassword: z.string().nullable(),
  scheduledAt: z.date().optional(),
  status: z.string().optional(),
  resultMsg: z.string().nullable().optional(),
  resultUrl: z.string().nullable().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

// PostJob을 DcinsidePostParams로 변환하는 스키마
export const PostJobToParamsSchema = z
  .object({
    id: z.number(),
    galleryUrl: z.string().url('유효한 갤러리 URL을 입력해주세요.'),
    title: z.string().min(1, '제목을 입력해주세요.'),
    contentHtml: z.string().min(1, '내용을 입력해주세요.'),
    password: z.string(), // 조건부로 필수가 될 수 있음
    nickname: z.string().nullable(),
    headtext: z.string().nullable(),
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
    loginId: z.string().nullable(),
    loginPassword: z.string().nullable(),
    // 여기서 headless는 추가로 계산됨
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

// 타입 추출
export type DcinsidePostDto = z.infer<typeof DcinsidePostSchema>
export type DcinsideLoginDto = z.infer<typeof DcinsideLoginSchema>
export type PostJobDto = z.infer<typeof PostJobSchema>
