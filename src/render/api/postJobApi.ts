import { api } from './apiClient'
import { errorNormalizer } from './errorHelpers'
import type { NormalizedError } from './error.type'

export interface PostJob {
  id: string
  galleryUrl: string
  title: string
  scheduledAt: string
  status: string
  resultMsg?: string
  resultUrl?: string
  createdAt: string
  updatedAt: string
  headtext?: string
}

export async function getPostJobs(params?: {
  status?: string
  search?: string
  orderBy?: string
  order?: 'asc' | 'desc'
}): Promise<{ success: true; data: PostJob[] } | NormalizedError> {
  const searchParams = new URLSearchParams()

  if (params?.status) {
    searchParams.append('status', params.status)
  }
  if (params?.search) {
    searchParams.append('search', params.search)
  }
  if (params?.orderBy) {
    searchParams.append('orderBy', params.orderBy)
  }
  if (params?.order) {
    searchParams.append('order', params.order)
  }

  const url = `/post-jobs${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  try {
    const res = await api.get(url)
    return { success: true, data: res.data }
  } catch (e) {
    return errorNormalizer(e)
  }
}

export async function retryPostJob(id: string): Promise<{ success: true; data: any } | NormalizedError> {
  try {
    const res = await api.post(`/post-jobs/${id}/retry`)
    return { success: true, data: res.data }
  } catch (e) {
    return errorNormalizer(e)
  }
}

export async function deletePostJob(id: string): Promise<{ success: true; data: any } | NormalizedError> {
  try {
    const res = await api.delete(`/post-jobs/${id}`)
    return { success: true, data: res.data }
  } catch (e) {
    return errorNormalizer(e)
  }
}
