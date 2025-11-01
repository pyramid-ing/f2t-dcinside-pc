import { IsString, IsBoolean, IsOptional, IsUrl, IsArray } from 'class-validator'
import { ApprovedStatus } from '@prisma/client'

// 포스트 생성 DTO
export class CreateMonitoredPostDto {
  @IsString()
  @IsUrl()
  postUrl: string

  @IsString()
  postTitle: string

  @IsString()
  postId: string

  @IsString()
  @IsOptional()
  headtext?: string

  @IsString()
  @IsOptional()
  authorName?: string

  @IsString()
  galleryId: string
}

// 포스트 응답 DTO
export class MonitoredPostResponseDto {
  id: string
  postUrl: string
  postTitle: string
  postId: string
  headtext: string | null
  authorName: string | null
  answered: boolean
  answeredAt: Date | null
  approvedStatus: ApprovedStatus // AI 검증 상태 (PENDING | APPROVED | REJECTED | FAILED)
  aiReason: string | null // AI 판단 이유
  galleryId: string
  createdAt: Date
  updatedAt: Date
  gallery?: {
    galleryUrl: string
    galleryId: string
    galleryName: string | null
  }
}

// 포스트 댓글 작성 요청 DTO
export class AnswerMonitoredPostDto {
  @IsString()
  postId: string

  @IsString()
  @IsOptional()
  commentText?: string // 지정하지 않으면 갤러리의 기본 댓글 사용
}

// 포스트 목록 조회 필터
export class GetMonitoredPostsDto {
  @IsString()
  @IsOptional()
  galleryId?: string

  @IsBoolean()
  @IsOptional()
  answered?: boolean
}

// 포스트 일괄 삭제 DTO
export class BulkDeleteMonitoredPostsDto {
  @IsArray()
  @IsString({ each: true })
  postIds: string[]
}

// 포스트 벌크 답변달기 DTO
export class BulkAnswerMonitoredPostsDto {
  @IsArray()
  @IsString({ each: true })
  postIds: string[]

  @IsString()
  @IsOptional()
  commentText?: string // 지정하지 않으면 각 갤러리의 기본 댓글 사용
}
