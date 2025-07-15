import { api } from './apiClient'
import { errorNormalizer } from './errorHelpers'
import type { NormalizedError } from './error.type'

export interface JobLog {
  id: string
  jobId: string
  message: string
  createdAt: string
  updatedAt: string
}

export async function getJobLogs(jobId: string): Promise<{ success: true; data: JobLog[] } | NormalizedError> {
  try {
    const res = await api.get(`/job-logs/${jobId}`)
    return { success: true, data: res.data.jobLogs }
  } catch (e) {
    return errorNormalizer(e)
  }
}

export async function getLatestJobLog(
  jobId: string,
): Promise<{ success: true; data: JobLog | null } | NormalizedError> {
  try {
    const res = await api.get(`/job-logs/${jobId}/latest`)
    return { success: true, data: res.data.jobLog }
  } catch (e) {
    return errorNormalizer(e)
  }
}
