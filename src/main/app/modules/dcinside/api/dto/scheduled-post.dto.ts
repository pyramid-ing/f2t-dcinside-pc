import { IsArray, IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator'

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
  @IsBoolean()
  headless?: boolean

  @IsOptional()
  @IsArray()
  imagePaths?: string[]

  @IsOptional()
  @IsString()
  headtext?: string

  @IsOptional()
  @IsDateString()
  scheduledAt?: string
}
