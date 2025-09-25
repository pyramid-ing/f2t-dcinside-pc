import { z } from 'zod/v4'

// 공통 기본 필드 스키마
export const BasePostSchema = z.object({
  galleryUrl: z
    .string()
    .nullable()
    .refine(
      val => {
        try {
          new URL(val)
          return true
        } catch {
          return false
        }
      },
      { message: '유효한 갤러리 URL을 입력해주세요.' },
    ),
  title: z.string().min(1, '제목을 입력해주세요.'),
  contentHtml: z.string().min(1, '내용을 입력해주세요.'),
  headtext: z.string().nullable().optional(),
  password: z.string().nullable().optional(), // 조건부로 필수가 될 수 있음
  nickname: z.string().nullable().optional(), // 조건부로 필수가 될 수 있음
  loginId: z.string().nullable().optional(),
  loginPassword: z.string().nullable().optional(),
})
