import { IsArray, ValidateNested, IsOptional, IsString, IsNumber, IsEnum } from 'class-validator'
import { Type } from 'class-transformer'
import { BulkActionType } from '../enums/bulk-action.enum'
import { SelectionMode } from '../enums/selection-mode.enum'

export class JobFiltersDto {
  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsString()
  type?: string

  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsString()
  orderBy?: string

  @IsOptional()
  @IsString()
  order?: string
}

export class BulkActionDto {
  @IsEnum(SelectionMode)
  mode: SelectionMode

  @ValidateNested()
  @Type(() => JobFiltersDto)
  filters: JobFiltersDto

  @IsArray()
  @IsOptional()
  includeIds?: string[] // page 모드에서 사용

  @IsArray()
  @IsOptional()
  excludeIds?: string[] // all 모드에서 사용

  @IsEnum(BulkActionType)
  action: BulkActionType

  @IsOptional()
  @IsNumber()
  autoDeleteMinutes?: number // auto-delete 액션에서 사용

  @IsOptional()
  @IsNumber()
  intervalStart?: number // apply-interval 액션에서 사용

  @IsOptional()
  @IsNumber()
  intervalEnd?: number // apply-interval 액션에서 사용
}
