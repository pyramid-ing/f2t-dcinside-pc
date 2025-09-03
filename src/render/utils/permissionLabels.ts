import { Permission } from '@render/types/permissions'

export const permissionLabels: Record<Permission, string> = {
  [Permission.POSTING]: '자동등록',
  [Permission.TETHERING]: '테더링',
}

export const getPermissionLabel = (permission: Permission): string => {
  return permissionLabels[permission] || permission
}

export const getPermissionLabels = (permissions: Permission[]): string[] => {
  return permissions.map(getPermissionLabel)
}
