import { IsArray, ValidateNested, IsOptional, IsString, IsNumber, IsEnum } from 'class-validator'
import { Type } from 'class-transformer'
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

/**
 * 모든 벌크 작업의 기본 DTO
 * mode, filters, includeIds, excludeIds를 포함합니다.
 */
export class BaseSelectionDto {
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
}

/**
 * BulkActionDto는 하위 호환성을 위해 유지됩니다.
 * 새로운 코드는 BaseSelectionDto를 사용하세요.
 */
export class BulkActionDto extends BaseSelectionDto {
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

/**
 * 재시도 작업용 DTO
 */
export class BulkRetryDto extends BaseSelectionDto {}

/**
 * 삭제 작업용 DTO
 */
export class BulkDeleteDto extends BaseSelectionDto {}

/**
 * 등록요청 일괄변경용 DTO
 */
export class BulkPendingToRequestDto extends BaseSelectionDto {}

/**
 * 등록 간격 적용용 DTO
 */
export class BulkApplyIntervalDto extends BaseSelectionDto {
  @IsNumber()
  intervalStart: number

  @IsNumber()
  intervalEnd: number
}

/**
 * 자동삭제 설정용 DTO
 */
export class BulkAutoDeleteDto extends BaseSelectionDto {
  @IsOptional()
  @IsNumber()
  autoDeleteMinutes?: number // null이면 자동삭제 제거
}

/**
 * 엑셀 내보내기용 DTO
 */
export class ExportExcelDto extends BaseSelectionDto {}

/**
 * 삭제 재시도용 DTO
 */
export class BulkRetryDeleteDto extends BaseSelectionDto {}

/**
 * 조회수 가져오기용 DTO
 */
export class BulkUpdateViewCountsDto extends BaseSelectionDto {}
