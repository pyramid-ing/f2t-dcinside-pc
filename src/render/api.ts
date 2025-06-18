import axios from 'axios'

const API_BASE_URL = 'http://localhost:3553'

// 에러 코드 enum
export enum ErrorCode {
}

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
      }
      else if (typeof value === 'string' || typeof value === 'number') {
        detailStrings.push(`${key}: ${value}`)
      }
    }

    return detailStrings.length > 0 ? detailStrings.join(', ') : undefined
  }

  return undefined
}

// 게시물 엑셀 내보내기
export async function exportPostsXlsx(data: {
  keyword: string
  limit?: number
}): Promise<Blob> {
  const res = await axios.post(`${API_BASE_URL}/instagram/workflow/export-posts-xlsx`, data, {
    responseType: 'blob',
  })
  return res.data
}

// DM 보내기 (엑셀 업로드)
export async function sendDmTo(file: File): Promise<any> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await axios.post(`${API_BASE_URL}/instagram/workflow/send-dm-to`, formData)
  return res.data
}

// 인스타그램 설정 불러오기
export async function getInstagramSettings() {
  const res = await axios.get(`${API_BASE_URL}/settings/instagram`)
  return res.data
}

// 인스타그램 설정 저장
export async function saveInstagramSettings(data: any) {
  const res = await axios.post(`${API_BASE_URL}/settings/instagram`, data)
  return res.data
}

// 인스타그램 로그인 상태 확인 (수동)
export async function checkLoginStatus() {
  const res = await axios.get(`${API_BASE_URL}/instagram/api/login-status`)
  return res.data
}

// 워크플로우 기반 인스타그램 수동 로그인
export async function workflowInstagramLogin() {
  const res = await axios.post(`${API_BASE_URL}/instagram/workflow/login`)
  return res.data
}

// 워크플로우 기반 인스타그램 로그아웃(쿠키 삭제)
export async function workflowInstagramLogout() {
  const res = await axios.post(`${API_BASE_URL}/instagram/workflow/logout`)
  return res.data
}
