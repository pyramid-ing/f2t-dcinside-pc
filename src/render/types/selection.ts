import { BulkActionType } from './bulk-action.enum'
import { SelectionMode } from './selection-mode.enum'

export type Mode = SelectionMode

export interface SelectionState {
  mode: Mode
  selectedIds: Set<string> // page 모드에만 사용
  excludedIds: Set<string> // all 모드에만 사용
}

export interface JobFilters {
  status?: string
  type?: string
  search?: string
  orderBy?: string
  order?: string
}

export interface BulkActionRequest {
  mode: Mode
  filters: JobFilters
  includeIds?: string[] // page 모드에서 사용
  excludeIds?: string[] // all 모드에서 사용
  action: BulkActionType
  autoDeleteMinutes?: number
  intervalStart?: number
  intervalEnd?: number
}
