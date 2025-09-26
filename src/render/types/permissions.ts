export enum Permission {
  POSTING = 'posting',
  TETHERING = 'tethering',
  COMMENT = 'comment',
}

export interface LicenseInfo {
  permissions: Permission[]
  isValid: boolean
  expiresAt?: number
}

export interface RoutePermission {
  path: string
  permissions: Permission[]
  fallbackPath?: string
}
