import { IsString, IsNumber, IsOptional, IsArray, Min, Max, IsNotEmpty } from 'class-validator'

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
  @IsNumber()
  @Min(1)
  @Max(60)
  taskDelay?: number
}

export class CommentJobResponseDto {
  id: string
  keyword: string
  comment: string
  postUrls: string[]
  nickname: string
  password: string
  isRunning: boolean
  createdAt: Date
  taskDelay: number
}
