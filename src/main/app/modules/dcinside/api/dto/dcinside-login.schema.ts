import { z } from 'zod/v4'

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
export type DcinsideLoginDto = z.infer<typeof DcinsideLoginSchema>
