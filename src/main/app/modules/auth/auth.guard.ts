import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import axios from 'axios'
import { machineId } from 'node-machine-id'
import { CustomHttpException } from '../../../common/errors/custom-http.exception'
import { ErrorCode } from '../../../common/errors/error-code.enum'

export const PERMISSIONS_KEY = 'permissions'

export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions)

interface LicenseRes {
  license: {
    permissions: string[]
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest()
    const supabaseEndpoint = this.configService.get('supabase.endpoint')
    const supabaseService = this.configService.get('supabase.service')
    const supabaseAnonKey = this.configService.get('supabase.anonKey')

    const requiredPermissions = this.reflector.get<string[]>(PERMISSIONS_KEY, context.getHandler()) ?? []

    const key = await machineId()
    try {
      const { data } = await axios.get<LicenseRes>(`${supabaseEndpoint}/functions/v1/checkLicense/${supabaseService}`, {
        params: { key },
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      })
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
          throw new CustomHttpException(ErrorCode.LICENSE_INVALID)
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
