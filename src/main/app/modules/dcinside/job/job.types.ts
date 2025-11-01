import { Job as PrismaJob } from '@prisma/client'

export type JobResult = {
  resultUrl?: string
  resultMsg?: string
}

export interface JobProcessor {
  process(jobId: string): Promise<JobResult | void>
  canProcess(job: PrismaJob): boolean
}

export enum JobType {
  POST = 'post',
  COMMENT = 'comment',
  COUPAS = 'coupas',
}

export enum JobStatus {
  PENDING = 'pending',
  REQUEST = 'request',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  // 삭제 관련 상태들
  DELETE_REQUEST = 'delete_request',
  DELETE_PROCESSING = 'delete_processing',
  DELETE_COMPLETED = 'delete_completed',
  DELETE_FAILED = 'delete_failed',
}
