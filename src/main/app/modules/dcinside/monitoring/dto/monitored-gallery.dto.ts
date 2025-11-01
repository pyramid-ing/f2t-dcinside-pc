import { IsString, IsOptional, IsBoolean, IsUrl } from 'class-validator'

// 갤러리 생성 DTO
export class CreateMonitoredGalleryDto {
  @IsString()
  @IsOptional()
  type?: string // 'gallery' | 'search'

  @IsString()
  @IsOptional()
  actionType?: string // 'coupas' | 'fixed_comment'

  @IsString()
  @IsUrl()
  @IsOptional()
  galleryUrl?: string // 검색 타입일 때는 자동 생성

  @IsString()
  @IsOptional()
  galleryId?: string

  @IsString()
  @IsOptional()
  galleryName?: string

  @IsString()
  @IsOptional()
  commentText?: string

  @IsString()
  @IsOptional()
  searchKeyword?: string // search 타입용

  @IsString()
  @IsOptional()
  searchSort?: string // 'latest' | 'accuracy'

  @IsString()
  @IsOptional()
  aiPromptCode?: string // AI 프롬프트 코드명 (예: 'product-recommendation')

  @IsString()
  @IsOptional()
  loginId?: string

  @IsString()
  @IsOptional()
  loginPassword?: string

  @IsString()
  @IsOptional()
  nickname?: string

  @IsString()
  @IsOptional()
  password?: string

  @IsBoolean()
  @IsOptional()
  isActive?: boolean
}

// 갤러리 수정 DTO
export class UpdateMonitoredGalleryDto {
  @IsString()
  @IsOptional()
  type?: string // 'gallery' | 'search'

  @IsString()
  @IsOptional()
  actionType?: string // 'coupas' | 'fixed_comment'

  @IsString()
  @IsOptional()
  @IsUrl()
  galleryUrl?: string

  @IsString()
  @IsOptional()
  galleryId?: string

  @IsString()
  @IsOptional()
  galleryName?: string

  @IsString()
  @IsOptional()
  commentText?: string

  @IsString()
  @IsOptional()
  searchKeyword?: string // search 타입용

  @IsString()
  @IsOptional()
  searchSort?: string // 'latest' | 'accuracy'

  @IsString()
  @IsOptional()
  aiPromptCode?: string // AI 프롬프트 코드명 (예: 'product-recommendation')

  @IsString()
  @IsOptional()
  loginId?: string

  @IsString()
  @IsOptional()
  loginPassword?: string

  @IsString()
  @IsOptional()
  nickname?: string

  @IsString()
  @IsOptional()
  password?: string

  @IsBoolean()
  @IsOptional()
  isActive?: boolean
}

// 갤러리 응답 DTO
export class MonitoredGalleryResponseDto {
  id: string
  type: string // 'gallery' | 'search'
  actionType: string | null // 'coupas' | 'fixed_comment'
  galleryUrl: string
  galleryId: string
  galleryName: string | null
  commentText: string | null
  searchKeyword: string | null // search 타입용
  searchSort: string | null // 'latest' | 'accuracy'
  aiPromptCode: string | null // AI 프롬프트 코드명
  isActive: boolean
  loginId: string | null
  loginPassword: string | null
  nickname: string | null
  password: string | null
  lastCheckedAt: Date | null
  createdAt: Date
  updatedAt: Date
  postCount?: number
  unansweredPostCount?: number
}

// 엑셀 업로드로 갤러리 일괄 생성
export class BulkCreateMonitoredGalleryDto {
  galleries: CreateMonitoredGalleryDto[]
}

// 갤러리 일괄 상태 변경 DTO
export class BulkUpdateGalleryStatusDto {
  @IsString({ each: true })
  ids: string[]

  @IsBoolean()
  isActive: boolean
}
