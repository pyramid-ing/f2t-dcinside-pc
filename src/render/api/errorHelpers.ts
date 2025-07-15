import { AxiosError } from 'axios'
import type { NormalizedError } from './error.type'

export function errorNormalizer(error: any): NormalizedError {
  if (error.isAxiosError) {
    const resp = (error as AxiosError).response
    if (resp && resp.data) {
      const data = resp.data as any
      return {
        success: false,
        errorCode: data.errorCode ?? resp.status,
        message: data.message || resp.statusText || '알 수 없는 오류',
        metadata: data.metadata,
      }
    }
    // 서버 응답이 없는 경우 (네트워크, 타임아웃 등)
    return {
      success: false,
      message: error.message || '네트워크 오류가 발생했습니다.',
    }
  } else if (error instanceof Error) {
    return {
      success: false,
      message: error.message,
    }
  }
  return {
    success: false,
    message: '알 수 없는 오류',
  }
}
