import { IsISO8601, IsOptional, ValidateIf, IsNumber } from 'class-validator'

export class UpdateJobDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  scheduledAt?: string | null

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  deleteAt?: string | null

  @IsOptional()
  @IsNumber()
  autoDeleteMinutes?: number | null
}
