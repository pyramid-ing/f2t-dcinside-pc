import { SelectionMode } from './selection-mode.enum'

export type Mode = SelectionMode

export interface SelectionState {
  mode: Mode
  includeIds: Set<string> // page 모드에만 사용
  excludedIds: Set<string> // all 모드에만 사용
}

export interface JobFilters {
  status?: string
  type?: string
  search?: string
  orderBy?: string
  order?: string
}

/**
 * 모든 벌크 작업의 기본 인터페이스
 */
export interface BaseSelectionRequest {
  mode: Mode
  filters: JobFilters
  includeIds?: string[] // page 모드에서 사용
  excludeIds?: string[] // all 모드에서 사용
}

/**
 * BulkActionRequest는 하위 호환성을 위해 유지됩니다.
 * 새로운 코드는 BaseSelectionRequest를 사용하세요.
 */
export interface BulkActionRequest extends BaseSelectionRequest {
  autoDeleteMinutes?: number
  intervalStart?: number
  intervalEnd?: number
}

/**
 * 재시도 작업용 인터페이스
 */
export interface BulkRetryRequest extends BaseSelectionRequest {}

/**
 * 삭제 작업용 인터페이스
 */
export interface BulkDeleteRequest extends BaseSelectionRequest {}

/**
 * 등록요청 일괄변경용 인터페이스
 */
export interface BulkPendingToRequest extends BaseSelectionRequest {}

/**
 * 등록 간격 적용용 인터페이스
 */
export interface BulkApplyIntervalRequest extends BaseSelectionRequest {
  intervalStart: number
  intervalEnd: number
}

/**
 * 자동삭제 설정용 인터페이스
 */
export interface BulkAutoDeleteRequest extends BaseSelectionRequest {
  autoDeleteMinutes?: number
}

/**
 * 엑셀 내보내기용 인터페이스
 */
export interface ExportExcelRequest extends BaseSelectionRequest {}

/**
 * 삭제 재시도용 인터페이스
 */
export interface BulkRetryDeleteRequest extends BaseSelectionRequest {}

/**
 * 조회수 가져오기용 인터페이스
 */
export interface BulkUpdateViewCountsRequest extends BaseSelectionRequest {}
