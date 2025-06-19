import { IsArray, IsDateString, IsOptional, IsString } from 'class-validator'

export class PostJobDto {
  @IsString()
  galleryUrl: string

  @IsString()
  title: string

  @IsString()
  contentHtml: string

  @IsString()
  password: string

  @IsOptional()
  @IsString()
  nickname?: string

  @IsOptional()
  @IsArray()
  imagePaths?: string[]

  @IsOptional()
  @IsString()
  headtext?: string

  @IsOptional()
  @IsDateString()
  scheduledAt?: string

  @IsOptional()
  @IsString()
  loginId?: string

  @IsOptional()
  @IsString()
  loginPassword?: string
}
