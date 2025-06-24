import { z } from 'zod/v4'
import { BasePostSchema } from './base-post.schema'

// DcinsidePost 스키마 - 기본 스키마 확장
export const DcinsidePostSchema = BasePostSchema.extend({
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
})
  .refine(
    data => {
      // 로그인 ID가 없으면 비로그인 모드 - 비밀번호만 필수 (닉네임은 optional)
      if (!data.loginId || data.loginId.trim() === '') {
        if (!data?.password || data?.password.trim() === '') {
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
    // 로그인 ID가 있으면 로그인 모드 우선 처리 (nickname, password 무시)
    // 로그인 ID가 없으면 비로그인 모드 (nickname, password 사용)
    const hasLoginId = data.loginId && data.loginId.trim() !== ''

    return {
      galleryUrl: data.galleryUrl,
      title: data.title,
      contentHtml: data.contentHtml,
      password: hasLoginId ? undefined : data?.password, // 로그인 모드면 undefined, 비로그인 모드면 입력된 password
      nickname: hasLoginId ? undefined : data?.nickname || undefined, // 로그인 모드면 undefined
      headless: data.headless,
      imagePaths: data.imagePaths,
      scheduledAt: data.scheduledAt,
      loginId: hasLoginId ? data.loginId : undefined,
      loginPassword: hasLoginId ? data.loginPassword || undefined : undefined,
      headtext: data.headtext || undefined,
    }
  })

// 타입 추출
export type DcinsidePostDto = z.infer<typeof DcinsidePostSchema>
