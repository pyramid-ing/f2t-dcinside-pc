import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import { machineId } from 'node-machine-id'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { RegisterLicenseDto } from './dto/register-license.dto'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { Permission } from '@main/app/modules/auth/auth.guard'

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  async getMachineId() {
    return await machineId()
  }

  async registerLicense(registerLicenseDto: RegisterLicenseDto) {
    const supabaseEndpoint = this.configService.get('supabase.endpoint')
    const supabaseAnonKey = this.configService.get('supabase.anonKey')
    const supabaseService = this.configService.get('supabase.service')

    try {
      // 1. 라이센스 등록
      const { data } = await axios.post(
        `${supabaseEndpoint}/functions/v1/registerLicense`,
        {
          license_key: registerLicenseDto.license_key,
          node_machine_id: registerLicenseDto.node_machine_id,
          service: supabaseService,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        },
      )

      // 2. 라이센스 정보를 서버에서 가져와서 캐시에 저장
      const licenseInfo = await this.fetchLicenseInfo(registerLicenseDto.license_key)

      // 3. 설정에 라이센스 키와 캐시 정보 저장
      await this.settingsService.updateSettings({
        licenseKey: registerLicenseDto.license_key,
        licenseCache: licenseInfo,
      })

      return {
        success: true,
        message: '라이센스가 성공적으로 등록되었습니다.',
        data,
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          throw new CustomHttpException(ErrorCode.LICENSE_ALREADY_REGISTERED)
        } else if (err.response?.status === 400) {
          throw new CustomHttpException(ErrorCode.LICENSE_KEY_INVALID)
        } else {
          throw new CustomHttpException(ErrorCode.LICENSE_REGISTRATION_FAILED)
        }
      }
      throw new CustomHttpException(ErrorCode.LICENSE_REGISTRATION_FAILED)
    }
  }

  // 프로그램 시작 시 라이센스 정보를 서버에서 가져와서 캐시에 저장
  async initializeLicenseInfo() {
    const settings = await this.settingsService.getSettings()
    const licenseKey = settings.licenseKey

    if (!licenseKey) {
      return // 라이센스 키가 없으면 초기화하지 않음
    }

    try {
      const licenseInfo = await this.fetchLicenseInfo(licenseKey)
      await this.settingsService.updateSettings({
        licenseCache: licenseInfo,
      })
    } catch (error) {
      console.error('Failed to initialize license info:', error)
      // 초기화 실패 시 캐시를 무효화
      await this.settingsService.updateSettings({
        licenseCache: {
          isValid: false,
          permissions: [],
          expiresAt: undefined,
        },
      })
    }
  }

  private async fetchLicenseInfo(licenseKey: string) {
    const supabaseEndpoint = this.configService.get('supabase.endpoint')
    const supabaseAnonKey = this.configService.get('supabase.anonKey')
    const supabaseService = this.configService.get('supabase.service')
    const key = await machineId()

    try {
      const { data } = await axios.get(`${supabaseEndpoint}/functions/v1/checkLicense/${supabaseService}`, {
        params: {
          key: licenseKey,
          node_machine_id: key,
        },
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      })

      if (!data.is_registered) {
        throw new CustomHttpException(ErrorCode.LICENSE_NOT_FOUND, {
          message: '라이센스가 등록되지 않았습니다.',
        })
      }

      return {
        isValid: true,
        permissions: data.license.permissions as Permission[],
        expiresAt: data.license.expires_at ? new Date(data.license.expires_at).getTime() : undefined,
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          const errorData = err.response.data
          if (errorData.error === 'License has expired') {
            return {
              isValid: false,
              permissions: [],
              expiresAt: undefined,
            }
          } else {
            return {
              isValid: false,
              permissions: [],
              expiresAt: undefined,
            }
          }
        }
      }
      throw new CustomHttpException(ErrorCode.LICENSE_CHECK_FAILED)
    }
  }
}
