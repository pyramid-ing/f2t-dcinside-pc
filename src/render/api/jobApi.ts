import { api } from './apiClient'
import { ApiResponse, Job, JobLog, JobStatus, JobType, PaginatedResponse } from '@render/api/type'
import { BulkActionRequest } from '@render/types/selection'

/**
 * 작업 목록을 조회합니다.
 */
export async function getJobs(params?: {
  status?: JobStatus
  type?: JobType
  search?: string
  orderBy?: string
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
}): Promise<PaginatedResponse<Job>> {
  const response = await api.get('/api/jobs', { params })
  return response.data
}

/**
 * 특정 작업의 로그 목록을 조회합니다.
 */
export async function getJobLogs(jobId: string): Promise<JobLog[]> {
  const response = await api.get(`/api/jobs/${jobId}/logs`)
  return response.data
}

/**
 * 특정 작업의 최신 로그를 조회합니다.
 */
export async function getLatestJobLog(jobId: string): Promise<JobLog | null> {
  const response = await api.get(`/api/jobs/${jobId}/logs/latest`)
  return response.data
}

/**
 * 실패한 작업을 재시도합니다.
 */
export async function retryJob(jobId: string): Promise<ApiResponse> {
  const response = await api.post(`/api/jobs/${jobId}/retry`)
  return response.data
}

/**
 * 작업을 삭제합니다.
 */
export async function deleteJob(jobId: string): Promise<ApiResponse> {
  const response = await api.delete(`/api/jobs/${jobId}`)
  return response.data
}

/**
 * 작업 결과 파일을 다운로드합니다.
 */
export async function downloadJobFile(jobId: string): Promise<Blob> {
  const response = await api.get(`/api/jobs/${jobId}/download`, { responseType: 'blob' })
  return response.data
}

/**
 * 벌크 작업 미리보기 (실제 적용될 개수 확인)
 */
export async function previewBulkAction(request: BulkActionRequest): Promise<{ count: number }> {
  const response = await api.post('/api/jobs/bulk/preview', request)
  return response.data
}

/**
 * 여러 작업을 재시도합니다.
 */
export async function retryJobs(request: BulkActionRequest): Promise<ApiResponse> {
  const response = await api.post('/api/jobs/bulk/retry', request)
  return response.data
}

/**
 * 여러 작업을 삭제합니다.
 */
export async function deleteJobs(request: BulkActionRequest): Promise<ApiResponse> {
  const response = await api.post('/api/jobs/bulk/delete', request)
  return response.data
}

/**
 * 여러 작업의 등록후자동삭제(분)을 설정합니다.
 */
export async function bulkUpdateAutoDelete(request: BulkActionRequest): Promise<ApiResponse> {
  const response = await api.post('/api/jobs/bulk/auto-delete', request)
  return response.data
}

/**
 * 여러 작업에 등록 간격을 적용합니다.
 */
export async function bulkApplyInterval(request: BulkActionRequest): Promise<ApiResponse> {
  const response = await api.post('/api/jobs/bulk/apply-interval', request)
  return response.data
}

/**
 * 여러 작업을 등록대기에서 등록요청으로 일괄 변경합니다.
 */
export async function bulkPendingToRequest(request: BulkActionRequest): Promise<ApiResponse> {
  const response = await api.post('/api/jobs/bulk/pending-to-request', request)
  return response.data
}

/**
 * 작업의 삭제 예정시간을 설정/해제합니다.
 */
export async function updateJobDeleteAt(jobId: string, deleteAt: string | null): Promise<ApiResponse> {
  const response = await api.patch(`/api/jobs/${jobId}`, { deleteAt })
  return response.data
}

/**
 * 등록요청(request) 상태를 등록대기(pending)로 변경
 */
export async function requestToPending(jobId: string): Promise<ApiResponse> {
  const response = await api.post(`/api/jobs/${jobId}/request-to-pending`)
  return response.data
}

/**
 * 등록대기(pending) 상태를 등록요청(request)으로 변경
 */
export async function pendingToRequest(jobId: string): Promise<ApiResponse> {
  const response = await api.post(`/api/jobs/${jobId}/pending-to-request`)
  return response.data
}

/**
 * 작업의 등록후자동삭제(분)을 설정합니다.
 */
export async function updateJobAutoDeleteMinutes(
  jobId: string,
  autoDeleteMinutes: number | null,
  deleteAt?: string | null,
): Promise<ApiResponse> {
  const data: any = { autoDeleteMinutes }
  if (deleteAt !== undefined) {
    data.deleteAt = deleteAt
  }
  const response = await api.patch(`/api/jobs/${jobId}`, data)
  return response.data
}

/**
 * 작업의 예약시간을 설정합니다.
 */
export async function updateJobScheduledAt(jobId: string, scheduledAt: string | null): Promise<ApiResponse> {
  const response = await api.patch(`/api/jobs/${jobId}`, { scheduledAt })
  return response.data
}
