import { z } from 'zod/v4'

// PostJob 스키마
export const PostJobSchema = z.object({
  galleryUrl: z.string().url('유효한 갤러리 URL을 입력해주세요.'),
  title: z.string().min(1, '제목을 입력해주세요.'),
  contentHtml: z.string().min(1, '내용을 입력해주세요.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
  nickname: z.string().optional(),
  imagePaths: z.preprocess(v => {
    if (Array.isArray(v)) return v
    if (typeof v === 'string') return [v]
    return []
  }, z.array(z.string()).optional()),
  headtext: z.string().optional(),
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
})

// DcinsidePost 스키마
export const DcinsidePostSchema = z.object({
  galleryUrl: z.string().url('유효한 갤러리 URL을 입력해주세요.'),
  title: z.string().min(1, '제목을 입력해주세요.'),
  contentHtml: z.string().min(1, '내용을 입력해주세요.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
  nickname: z.string().optional(),
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
export type PostJobDto = z.infer<typeof PostJobSchema>
export type DcinsidePostDto = z.infer<typeof DcinsidePostSchema>
export type DcinsideLoginDto = z.infer<typeof DcinsideLoginSchema>
