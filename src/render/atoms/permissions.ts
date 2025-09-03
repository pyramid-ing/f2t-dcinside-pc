import { atom, selector } from 'recoil'
import { Permission, LicenseInfo } from '@render/types/permissions'

// 라이센스 정보 상태
export const licenseInfoState = atom<LicenseInfo | null>({
  key: 'licenseInfoState',
  default: null,
})

// 권한 확인 상태
export const permissionsLoadingState = atom<boolean>({
  key: 'permissionsLoadingState',
  default: false,
})

// 권한 에러 상태
export const permissionsErrorState = atom<string | null>({
  key: 'permissionsErrorState',
  default: null,
})

// 특정 권한을 가지고 있는지 확인하는 selector
export const hasPermissionSelector = selector({
  key: 'hasPermissionSelector',
  get: ({ get }) => {
    const licenseInfo = get(licenseInfoState)
    return (permission: Permission): boolean => {
      if (!licenseInfo || !licenseInfo.isValid) {
        return false
      }
      return licenseInfo.permissions.includes(permission)
    }
  },
})

// 여러 권한을 모두 가지고 있는지 확인하는 selector
export const hasAllPermissionsSelector = selector({
  key: 'hasAllPermissionsSelector',
  get: ({ get }) => {
    const licenseInfo = get(licenseInfoState)
    return (permissions: Permission[]): boolean => {
      if (!licenseInfo || !licenseInfo.isValid) {
        return false
      }
      return permissions.every(permission => licenseInfo.permissions.includes(permission))
    }
  },
})

// 라이센스가 유효한지 확인하는 selector
export const isLicenseValidSelector = selector({
  key: 'isLicenseValidSelector',
  get: ({ get }) => {
    const licenseInfo = get(licenseInfoState)
    return licenseInfo?.isValid ?? false
  },
})
