import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { Permission } from '@main/app/modules/auth/auth.guard'

export function assertPermission(licenseCache: any, permission: Permission): void {
  if (!licenseCache?.isValid) {
    throw new CustomHttpException(ErrorCode.LICENSE_INVALID, {
      message: '라이센스가 유효하지 않습니다.',
    })
  }

  if (!licenseCache.permissions.includes(permission)) {
    throw new CustomHttpException(ErrorCode.LICENSE_PERMISSION_DENIED, {
      message: `${permission} 권한이 없습니다.`,
      permissions: [permission],
    })
  }
}

export function assertPermissions(licenseCache: any, permissions: Permission[]): void {
  if (!licenseCache?.isValid) {
    throw new CustomHttpException(ErrorCode.LICENSE_INVALID, {
      message: '라이센스가 유효하지 않습니다.',
    })
  }

  const missingPermissions = permissions.filter(permission => !licenseCache.permissions.includes(permission))

  if (missingPermissions.length > 0) {
    throw new CustomHttpException(ErrorCode.LICENSE_PERMISSION_DENIED, {
      message: `필요한 권한이 없습니다: ${missingPermissions.join(', ')}`,
      permissions: missingPermissions,
    })
  }
}
