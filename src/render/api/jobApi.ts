import { api } from './apiClient'
import { ApiResponse, Job, JobLog, JobStatus, JobType } from '@render/api/type'

/**
 * 작업 목록을 조회합니다.
 */
export async function getJobs(params?: {
  status?: JobStatus
  type?: JobType
  search?: string
  orderBy?: string
  order?: 'asc' | 'desc'
}): Promise<Job[]> {
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
 * 여러 작업을 재시도합니다.
 */
export async function retryJobs(jobIds: string[]): Promise<ApiResponse> {
  const response = await api.post('/api/jobs/bulk/retry', { jobIds })
  return response.data
}

/**
 * 여러 작업을 삭제합니다.
 */
export async function deleteJobs(jobIds: string[]): Promise<ApiResponse> {
  const response = await api.post('/api/jobs/bulk/delete', { jobIds })
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
