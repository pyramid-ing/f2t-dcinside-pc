import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator'

export class CreateCoupasJobDto {
  @IsString()
  @IsNotEmpty()
  postUrl: string

  @IsString()
  @IsNotEmpty()
  wordpressUrl: string

  @IsString()
  @IsNotEmpty()
  wordpressUsername: string

  @IsString()
  @IsNotEmpty()
  wordpressApiKey: string

  // 댓글 작성 관련 옵션
  @IsString()
  @IsOptional()
  nickname?: string

  @IsString()
  @IsOptional()
  password?: string

  @IsString()
  @IsOptional()
  loginId?: string

  @IsString()
  @IsOptional()
  loginPassword?: string

  @IsString()
  @IsOptional()
  subject?: string

  @IsString()
  @IsOptional()
  desc?: string

  @IsDateString()
  @IsOptional()
  scheduledAt?: string
}
