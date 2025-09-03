import { useCallback } from 'react'
import { useRecoilState, useRecoilValue } from 'recoil'
import { message } from 'antd'
import {
  licenseInfoState,
  permissionsLoadingState,
  permissionsErrorState,
  hasPermissionSelector,
  hasAllPermissionsSelector,
  isLicenseValidSelector,
} from '@render/atoms/permissions'
import { Permission } from '@render/types/permissions'
import { getLicenseInfo, checkPermissions } from '@render/api/permissionsApi'

export const usePermissions = () => {
  const [licenseInfo, setLicenseInfo] = useRecoilState(licenseInfoState)
  const [isLoading, setIsLoading] = useRecoilState(permissionsLoadingState)
  const [error, setError] = useRecoilState(permissionsErrorState)

  const hasPermission = useRecoilValue(hasPermissionSelector)
  const hasAllPermissions = useRecoilValue(hasAllPermissionsSelector)
  const isLicenseValid = useRecoilValue(isLicenseValidSelector)

  // 라이센스 정보 로드
  const loadLicenseInfo = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getLicenseInfo()
      setLicenseInfo({
        permissions: data.permissions,
        isValid: data.isValid,
        expiresAt: data.expiresAt,
      })
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '라이센스 정보를 불러오는데 실패했습니다.'
      setError(errorMessage)
      message.error(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [setLicenseInfo, setIsLoading, setError])

  // 특정 권한 확인
  const checkSpecificPermissions = useCallback(
    async (permissions: Permission[]) => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await checkPermissions(permissions)
        return data
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '권한 확인에 실패했습니다.'
        setError(errorMessage)
        message.error(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [setIsLoading, setError],
  )

  // 권한 확인 함수들
  const canAccess = useCallback(
    (permission: Permission): boolean => {
      return hasPermission(permission)
    },
    [hasPermission],
  )

  const canAccessAll = useCallback(
    (permissions: Permission[]): boolean => {
      return hasAllPermissions(permissions)
    },
    [hasAllPermissions],
  )

  // 에러 클리어
  const clearError = useCallback(() => {
    setError(null)
  }, [setError])

  return {
    // 상태
    licenseInfo,
    isLoading,
    error,
    isLicenseValid,

    // 권한 확인 함수들
    hasPermission,
    hasAllPermissions,
    canAccess,
    canAccessAll,

    // 액션
    loadLicenseInfo,
    checkSpecificPermissions,
    clearError,
  }
}
