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
            throw new CustomHttpException(ErrorCode.LICENSE_EXPIRED)
          } else {
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
