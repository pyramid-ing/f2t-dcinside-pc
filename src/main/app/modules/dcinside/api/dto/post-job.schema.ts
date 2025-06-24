import { z } from 'zod/v4'
import { BasePostSchema } from './base-post.schema'

// PostJob DB 객체를 위한 스키마 - 기본 스키마 확장
export const PostJobSchema = BasePostSchema.extend({
  id: z.number(),
  password: z.string(), // DB에서는 필수 필드
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

// 타입 추출
export type PostJobDto = z.infer<typeof PostJobSchema>
