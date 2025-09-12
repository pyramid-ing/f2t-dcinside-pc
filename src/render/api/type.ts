export const JOB_TYPE = {
  POST: 'post',
} as const

export const JOB_TYPE_OPTIONS = [
  { value: '', label: '전체' },
  { value: JOB_TYPE.POST, label: '포스팅' },
]

export const JOB_STATUS = {
  REQUEST: 'request',
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  // 삭제 관련 상태들
  DELETE_REQUEST: 'delete_request',
  DELETE_PROCESSING: 'delete_processing',
  DELETE_COMPLETED: 'delete_completed',
  DELETE_FAILED: 'delete_failed',
} as const

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  request: '등록요청',
  pending: '등록대기',
  processing: '처리중',
  completed: '완료',
  failed: '실패',
  // 삭제 관련 상태들
  delete_request: '삭제요청',
  delete_processing: '삭제진행중',
  delete_completed: '삭제완료',
  delete_failed: '삭제실패',
}

export const JOB_STATUS_COLOR: Record<JobStatus, string> = {
  [JOB_STATUS.REQUEST]: 'purple',
  [JOB_STATUS.PENDING]: 'blue',
  [JOB_STATUS.PROCESSING]: 'orange',
  [JOB_STATUS.COMPLETED]: 'green',
  [JOB_STATUS.FAILED]: 'red',
  // 삭제 관련 상태들
  [JOB_STATUS.DELETE_REQUEST]: 'magenta',
  [JOB_STATUS.DELETE_PROCESSING]: 'orange',
  [JOB_STATUS.DELETE_COMPLETED]: 'cyan',
  [JOB_STATUS.DELETE_FAILED]: 'red',
}

export const JOB_STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: JOB_STATUS.REQUEST, label: '등록요청' },
  { value: JOB_STATUS.PENDING, label: '등록대기' },
  { value: JOB_STATUS.PROCESSING, label: '처리중' },
  { value: JOB_STATUS.COMPLETED, label: '완료' },
  { value: JOB_STATUS.FAILED, label: '실패' },
  // 삭제 관련 상태들
  { value: JOB_STATUS.DELETE_REQUEST, label: '삭제요청' },
  { value: JOB_STATUS.DELETE_PROCESSING, label: '삭제진행중' },
  { value: JOB_STATUS.DELETE_COMPLETED, label: '삭제완료' },
  { value: JOB_STATUS.DELETE_FAILED, label: '삭제실패' },
]

export type JobType = (typeof JOB_TYPE)[keyof typeof JOB_TYPE]
export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS]

export interface BaseJob {
  id: string
  type: JobType
  subject: string
  desc: string
  status: JobStatus
  priority: number
  scheduledAt: string
  startedAt?: string
  completedAt?: string
  loginId: string
  resultMsg?: string
  resultUrl?: string
  errorMsg?: string
  createdAt: string
  updatedAt: string
  logs?: JobLog[]
}

export interface PostJob extends BaseJob {
  type: typeof JOB_TYPE.POST
  postJob: PostJobDetail
}

export interface PostJobDetail {
  id: string

  galleryUrl?: string
  title?: string
  contentHtml?: string
  password?: string
  nickname?: string
  headtext?: string
  imagePaths?: string
  loginId?: string
  loginPassword?: string
  imagePosition?: string
  resultUrl?: string
  deleteAt?: string
  deletedAt?: string
  autoDeleteMinutes?: number

  createdAt?: Date
  updatedAt?: Date
}

export type Job = PostJob

export interface JobLog {
  id: string
  jobId: string
  message: string
  level: string
  createdAt: string
}

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
}

export interface PaginationInfo {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationInfo
}
