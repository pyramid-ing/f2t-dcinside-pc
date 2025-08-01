import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import axios from 'axios'
import { machineId } from 'node-machine-id'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { SettingsService } from '@main/app/modules/settings/settings.service'

export const PERMISSIONS_KEY = 'permissions'

export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions)

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
    if (!licenseCache || !licenseCache.lastChecked || !licenseCache.isValid) {
      return false
    }

    const now = Date.now()
    const oneHour = 60 * 60 * 1000 // 1시간 (밀리초)

    // 마지막 체크로부터 1시간이 지났는지 확인
    if (now - licenseCache.lastChecked > oneHour) {
      return false
    }

    // 만료 시간이 있고 만료되었는지 확인
    if (licenseCache.expiresAt && now > licenseCache.expiresAt) {
      return false
    }

    return true
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest()
    const supabaseEndpoint = this.configService.get('supabase.endpoint')
    const supabaseService = this.configService.get('supabase.service')
    const supabaseAnonKey = this.configService.get('supabase.anonKey')

    const requiredPermissions = this.reflector.get<string[]>(PERMISSIONS_KEY, context.getHandler()) ?? []

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

    // 캐시가 유효하지 않으면 서버에서 확인
    try {
      const { data } = await axios.get<LicenseRes>(`${supabaseEndpoint}/functions/v1/checkLicense/${supabaseService}`, {
        params: {
          key: licenseKey,
          node_machine_id: key, // 현재 기기 ID를 node_machine_id로 전달
        },
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      })

      // 라이센스 등록 여부 확인
      if (!data.is_registered) {
        throw new CustomHttpException(ErrorCode.LICENSE_NOT_FOUND, {
          message: '라이센스가 등록되지 않았습니다. 먼저 라이센스를 등록해주세요.',
        })
      }

      // 권한 확인
      const isValid = requiredPermissions.every(permission => data.license.permissions.includes(permission))

      // 라이센스 정보를 캐시에 저장
      const licenseCache = {
        lastChecked: Date.now(),
        isValid: true,
        permissions: data.license.permissions,
        expiresAt: data.license.expires_at ? new Date(data.license.expires_at).getTime() : undefined,
      }

      await this.settingsService.updateSettings({
        licenseCache,
      })

      if (isValid) {
        return true
      } else {
        throw new CustomHttpException(ErrorCode.LICENSE_PERMISSION_DENIED, {
          permissions: requiredPermissions,
        })
      }
    } catch (err) {
      // axios 에러인 경우 (네트워크 오류, 서버 오류 등)
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          // 401 에러는 라이센스가 유효하지 않거나 만료된 경우
          const errorData = err.response.data as ErrorResponse
          if (errorData.error === 'License has expired') {
            // 캐시 무효화
            await this.settingsService.updateSettings({
              licenseCache: {
                lastChecked: Date.now(),
                isValid: false,
                permissions: [],
              },
            })
            throw new CustomHttpException(ErrorCode.LICENSE_EXPIRED)
          } else {
            // 캐시 무효화
            await this.settingsService.updateSettings({
              licenseCache: {
                lastChecked: Date.now(),
                isValid: false,
                permissions: [],
              },
            })
            throw new CustomHttpException(ErrorCode.LICENSE_INVALID)
          }
        } else if (err.response?.status === 400) {
          throw new CustomHttpException(ErrorCode.LICENSE_KEY_INVALID)
        } else if (err.response?.status === 404) {
          throw new CustomHttpException(ErrorCode.LICENSE_NOT_FOUND)
        } else {
          throw new CustomHttpException(ErrorCode.LICENSE_CHECK_FAILED)
        }
      }
      // 기타 에러
      throw new CustomHttpException(ErrorCode.LICENSE_CHECK_FAILED)
    }
  }
}
