import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

// DM 전송용 DTO
export class InstagramDmDto {
  @IsString()
  @IsNotEmpty()
  username: string

  @IsString()
  @IsNotEmpty()
  message: string

  @IsString()
  @IsOptional()
  loginUsername?: string

  @IsBoolean()
  @IsOptional()
  headless?: boolean
}

// 팔로우/언팔로우/팔로우 상태 확인용 DTO
export class InstagramFollowDto {
  @IsString()
  @IsNotEmpty()
  username: string

  @IsString()
  @IsOptional()
  loginUsername?: string

  @IsBoolean()
  @IsOptional()
  headless?: boolean
}

// 좋아요/좋아요 취소용 DTO
export class InstagramLikeDto {
  @IsString()
  @IsNotEmpty()
  postId: string

  @IsString()
  @IsOptional()
  loginUsername?: string

  @IsBoolean()
  @IsOptional()
  headless?: boolean
}

// 검색용 DTO
export class InstagramSearchDto {
  @IsString()
  @IsNotEmpty()
  keyword: string

  @IsString()
  @IsOptional()
  loginUsername?: string

  @IsNumber()
  @IsOptional()
  limit?: number

  @IsBoolean()
  @IsOptional()
  headless?: boolean
}

// 로그인/로그아웃/상태 확인용 DTO
export class InstagramLoginDto {
  @IsString()
  @IsNotEmpty()
  loginUsername: string

  @IsString()
  @IsNotEmpty()
  loginPassword: string

  @IsBoolean()
  @IsOptional()
  headless?: boolean
}
