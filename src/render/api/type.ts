export const JOB_TYPE = {
  POST: 'post',
} as const

export const JOB_STATUS = {
  REQUEST: 'request',
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  request: '등록요청',
  pending: '등록대기',
  processing: '처리중',
  completed: '완료',
  failed: '실패',
}

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
