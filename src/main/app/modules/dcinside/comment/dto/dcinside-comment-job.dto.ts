import { IsString, IsOptional, IsArray, IsNotEmpty } from 'class-validator'

export class CreateCommentJobDto {
  @IsString()
  @IsNotEmpty()
  keyword: string

  @IsString()
  @IsNotEmpty()
  comment: string

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  postUrls: string[]

  @IsOptional()
  @IsString()
  nickname?: string

  @IsOptional()
  @IsString()
  password?: string

  @IsOptional()
  @IsString()
  galleryUrl?: string

  @IsOptional()
  @IsString()
  loginId?: string

  @IsOptional()
  @IsString()
  loginPassword?: string
}

export class CommentJobResponseDto {
  id: string
  keyword: string
  comment: string
  postUrl: string
  nickname: string | null
  password: string | null
  isRunning: boolean
  createdAt: Date
  galleryUrl?: string | null
  loginId?: string | null
  loginPassword?: string | null
}
