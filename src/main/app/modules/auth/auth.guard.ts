import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { machineId } from 'node-machine-id'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { SettingsService } from '@main/app/modules/settings/settings.service'

export const PERMISSIONS_KEY = 'permissions'

export const Permissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions)

export enum Permission {
  POSTING = 'posting',
  TETHERING = 'tethering',
  COMMENT = 'comment',
  USE_COUPANG_PARTNERS = 'coupas',
}

interface License {
  id: number
  service: string
  key: string
  user_memo?: string
  permissions: string[]
  expires_at?: string
  created_at: string
}

interface LicenseRegistration {
  node_machine_id: string
  registered_at: string
}

interface LicenseRes {
  license: License
  is_registered?: boolean
  registration?: LicenseRegistration
}

interface ErrorResponse {
  error: string
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    private readonly settingsService: SettingsService,
  ) {}

  private isLicenseCacheValid(licenseCache: any): boolean {
    if (!licenseCache || !licenseCache.isValid) {
      return false
    }

    // 만료 시간이 있고 만료되었는지 확인
    const now = Date.now()
    if (licenseCache.expiresAt && now > licenseCache.expiresAt) {
      return false
    }

    return true
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest()
    const supabaseEndpoint = this.configService.get('supabase.endpoint')
    const supabaseAnonKey = this.configService.get('supabase.anonKey')
    const supabaseService = this.configService.get('supabase.service')

    const requiredPermissions = this.reflector.get<Permission[]>(PERMISSIONS_KEY, context.getHandler()) ?? []

    const key = await machineId()

    // 저장된 라이센스 키 가져오기
    const settings = await this.settingsService.getSettings()
    const licenseKey = settings.licenseKey

    if (!licenseKey) {
      throw new CustomHttpException(ErrorCode.LICENSE_NOT_FOUND, {
        message: '라이센스 키가 설정되지 않았습니다. 먼저 라이센스를 등록해주세요.',
      })
    }

    // 캐시된 라이센스 정보 확인
    if (settings.licenseCache && this.isLicenseCacheValid(settings.licenseCache)) {
      // 캐시된 정보로 권한 확인
      const isValid = requiredPermissions.every(permission => settings.licenseCache!.permissions.includes(permission))

      if (isValid) {
        return true
      } else {
        throw new CustomHttpException(ErrorCode.LICENSE_PERMISSION_DENIED, {
          permissions: requiredPermissions,
        })
      }
    }

    // 캐시가 없거나 유효하지 않으면 라이센스가 설정되지 않은 것으로 처리
    throw new CustomHttpException(ErrorCode.LICENSE_NOT_FOUND, {
      message: '라이센스 정보가 없습니다. 먼저 라이센스를 등록해주세요.',
    })
  }
}
