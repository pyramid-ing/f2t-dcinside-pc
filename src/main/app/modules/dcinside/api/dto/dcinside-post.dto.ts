import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator'

export class DcinsidePostDto {
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
  publishAt?: string

  @IsOptional()
  @IsString()
  loginId?: string

  @IsOptional()
  @IsString()
  loginPassword?: string

  @IsOptional()
  @IsString()
  headtext?: string
}
