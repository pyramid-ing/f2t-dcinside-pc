export enum Permission {
  POSTING = 'posting',
  TETHERING = 'tethering',
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
