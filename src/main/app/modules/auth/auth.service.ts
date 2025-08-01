import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import { machineId } from 'node-machine-id'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { RegisterLicenseDto } from './dto/register-license.dto'
import { SettingsService } from '@main/app/modules/settings/settings.service'

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
    const supabaseService = this.configService.get('supabase.service')
    const supabaseAnonKey = this.configService.get('supabase.anonKey')

    try {
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

      // 라이센스 등록 성공 시 설정에 저장
      await this.settingsService.updateSettings({
        licenseKey: registerLicenseDto.license_key,
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
}
