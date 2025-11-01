import { IsString, IsNotEmpty, IsOptional } from 'class-validator'

// 블랙리스트 응답 DTO
export interface BlacklistedGalleryResponseDto {
  id: string
  galleryUrl: string
  galleryId: string
  galleryName: string | null
  remarks: string | null
  createdAt: Date
  updatedAt: Date
}

// 블랙리스트 생성 DTO
export class CreateBlacklistedGalleryDto {
  @IsString()
  @IsNotEmpty()
  galleryUrl: string

  @IsString()
  @IsOptional()
  galleryId?: string

  @IsString()
  @IsOptional()
  galleryName?: string

  @IsString()
  @IsOptional()
  remarks?: string
}

// 블랙리스트 수정 DTO
export class UpdateBlacklistedGalleryDto {
  @IsString()
  @IsOptional()
  galleryUrl?: string

  @IsString()
  @IsOptional()
  galleryId?: string

  @IsString()
  @IsOptional()
  galleryName?: string

  @IsString()
  @IsOptional()
  remarks?: string
}

// 블랙리스트 일괄 삭제 DTO
export class BulkDeleteBlacklistedGalleryDto {
  @IsString({ each: true })
  @IsNotEmpty()
  ids: string[]
}
