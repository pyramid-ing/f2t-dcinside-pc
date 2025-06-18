import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class DcinsideLoginDto {
  @IsString()
  id: string

  @IsString()
  password: string

  @IsOptional()
  @IsBoolean()
  headless?: boolean
}
