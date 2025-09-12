import { IsEnum, IsOptional, IsArray, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { SelectionMode } from '../enums/selection-mode.enum'
import { JobFiltersDto } from './bulk-action.dto'

export class BulkRetryDeleteDto {
  @IsEnum(SelectionMode)
  mode: SelectionMode

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeIds?: string[]

  @IsOptional()
  @ValidateNested()
  @Type(() => JobFiltersDto)
  filters?: JobFiltersDto
}
