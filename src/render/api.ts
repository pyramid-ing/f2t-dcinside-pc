import type { AppSettings } from './types/settings'

// ------------------------------
// App Settings API
// ------------------------------

import axios from 'axios'

const API_BASE_URL = 'http://localhost:3554'

// 에러 코드 enum
export enum ErrorCode {}

// 정규화된 에러 응답 타입
export interface ErrorResponse {
  success: false
  statusCode: number
  timestamp: string
  path: string
  error: string
  message: string
  code?: ErrorCode
  service?: string
  operation?: string
  details?: {
    stack?: string[]
    name?: string
    url?: string
    method?: string
    response?: any
    code?: string
    category?: string
    postData?: any
    ffmpegError?: string
    inputData?: any
    siteUrl?: string
    blogId?: string
    postId?: string
    configType?: string
    isExpired?: boolean
    additionalInfo?: Record<string, any>
  }
}

// 에러 메시지 생성 헬퍼 함수
export function getErrorMessage(error: any): string {
  if (error.response?.data) {
    const errorData = error.response.data as ErrorResponse

    // 정규화된 에러 구조인 경우
    if (errorData.code && errorData.service && errorData.operation) {
      return `[${errorData.service}/${errorData.operation}] ${errorData.message}`
    }

    // 기본 에러 메시지
    return errorData.message || error.message
  }

  return error.message || '알 수 없는 오류가 발생했습니다.'
}

// 에러 상세 정보 생성 헬퍼 함수
export function getErrorDetails(error: any): string | undefined {
  if (error.response?.data?.details?.additionalInfo) {
    const details = error.response.data.details.additionalInfo
    const detailStrings = []

    for (const [key, value] of Object.entries(details)) {
      if (typeof value === 'boolean') {
        detailStrings.push(`${key}: ${value ? '있음' : '없음'}`)
      } else if (typeof value === 'string' || typeof value === 'number') {
        detailStrings.push(`${key}: ${value}`)
      }
    }

    return detailStrings.length > 0 ? detailStrings.join(', ') : undefined
  }

  return undefined
}

// DCinside 워크플로우 엑셀 업로드
export async function uploadDcinsideExcel(file: File): Promise<any> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await axios.post(`${API_BASE_URL}/dcinside/workflow/posting/excel-upload`, formData)
  return res.data
}

// OpenAI API 키 서버 저장/불러오기
export async function saveOpenAIApiKeyToServer(key: string) {
  const res = await axios.post(`${API_BASE_URL}/settings/global`, { openAIApiKey: key })
  return res.data
}

export async function getOpenAIApiKeyFromServer(): Promise<string> {
  const res = await axios.get(`${API_BASE_URL}/settings/global`)
  return res.data?.data?.openAIApiKey || ''
}

// OpenAI API 키 검증
export async function validateOpenAIApiKey(apiKey: string): Promise<{
  valid: boolean
  error?: string
  model?: string
}> {
  const res = await axios.post(`${API_BASE_URL}/settings/validate-openai-key`, { apiKey })
  return res.data
}

export async function saveAppSettingsToServer(settings: AppSettings) {
  const res = await axios.post(`${API_BASE_URL}/settings/app`, settings)
  return res.data
}

export async function getAppSettingsFromServer(): Promise<AppSettings> {
  const res = await axios.get(`${API_BASE_URL}/settings/app`)
  return res.data?.data || { showBrowserWindow: true, taskDelay: 10 }
}

// ------------------------------
// PostJob (예약/작업) API
// ------------------------------

export interface PostJob {
  id: number
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

// 목록 가져오기
export async function getPostJobs(params?: {
  status?: string
  search?: string
  orderBy?: string
  order?: 'asc' | 'desc'
}): Promise<PostJob[]> {
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

  const url = `${API_BASE_URL}/dcinside/api/post-jobs${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  const res = await axios.get(url)
  return res.data
}

// 실패/대기중 Job 재시도
export async function retryPostJob(id: number): Promise<any> {
  const res = await axios.post(`${API_BASE_URL}/dcinside/api/post-jobs/${id}/retry`)
  return res.data
}

// 작업 삭제
export async function deletePostJob(id: number): Promise<any> {
  const res = await axios.delete(`${API_BASE_URL}/dcinside/api/post-jobs/${id}`)
  return res.data
}
