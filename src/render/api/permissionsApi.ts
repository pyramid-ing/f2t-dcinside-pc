import { Permission } from '@render/types/permissions'
import { api } from './apiClient'

export interface CheckPermissionsResponse {
  permissions: Permission[]
  isValid: boolean
  expiresAt?: number
}

export interface CheckPermissionsRequest {
  permissions: Permission[]
}

// 특정 권한들을 확인하는 API
export const checkPermissions = async (permissions: Permission[]): Promise<CheckPermissionsResponse> => {
  const response = await api.post<CheckPermissionsResponse>('/api/auth/check-permissions', {
    permissions,
  })
  return response.data
}

// 라이센스 정보를 가져오는 API
export const getLicenseInfo = async (): Promise<CheckPermissionsResponse> => {
  const response = await api.get<CheckPermissionsResponse>('/api/auth/license-info')
  return response.data
}
