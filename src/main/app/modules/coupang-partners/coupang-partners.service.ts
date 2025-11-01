import axios, { AxiosInstance } from 'axios'
import * as crypto from 'crypto'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { Injectable, Logger } from '@nestjs/common'
import { SettingsService } from '../settings/settings.service'
import { Permission } from '@main/app/modules/auth/auth.guard'
import { assertPermission } from '@main/app/utils/permission.assert'
import {
  CoupangPartnersConfig,
  CoupangDeeplinkRequest,
  CoupangDeeplinkResponse,
  CoupangAffiliateLink,
} from './coupang-partners.types'
import { retry } from '@main/app/utils/retry'

// dayjs UTC 플러그인 활성화
dayjs.extend(utc)

// CoupangPartnersError 클래스 정의
export class CoupangPartnersErrorClass extends Error {
  constructor(
    public readonly errorInfo: {
      code: string
      message: string
      details?: any
    },
  ) {
    super(errorInfo.message)
    this.name = 'CoupangPartnersError'
  }
}

@Injectable()
export class CoupangPartnersService {
  private readonly logger = new Logger(CoupangPartnersService.name)
  private readonly httpClient: AxiosInstance
  private config: CoupangPartnersConfig | null = null

  constructor(private readonly settingsService: SettingsService) {
    this.httpClient = axios.create({
      baseURL: 'https://api-gateway.coupang.com',
      timeout: 30000,
    })

    // 요청 인터셉터 추가
    this.httpClient.interceptors.request.use(
      config => {
        this.logger.debug(`쿠팡 API 요청: ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      error => {
        this.logger.error('쿠팡 API 요청 오류:', error)
        return Promise.reject(error)
      },
    )

    // 응답 인터셉터 추가
    this.httpClient.interceptors.response.use(
      response => {
        this.logger.debug(`쿠팡 API 응답: ${response.status}`)
        return response
      },
      error => {
        this.logger.error('쿠팡 API 응답 오류:', error.response?.data || error.message)
        return Promise.reject(error)
      },
    )
  }

  /**
   * 어필리에이트 링크 생성
   */
  public async createAffiliateLink(coupangUrl: string, subId?: string): Promise<CoupangAffiliateLink> {
    await this._checkPermission(Permission.USE_COUPANG_PARTNERS)

    try {
      // Settings에서 쿠팡 파트너스 API 키 가져오기
      const settings = await this.settingsService.getSettings()

      if (!settings.coupangPartnersAccessKey || !settings.coupangPartnersSecretKey) {
        throw new CoupangPartnersErrorClass({
          code: 'MISSING_API_KEYS',
          message: '쿠팡 파트너스 API 키가 설정되지 않았습니다. 설정에서 Access Key와 Secret Key를 입력해주세요.',
        })
      }

      const config: CoupangPartnersConfig = {
        accessKey: settings.coupangPartnersAccessKey,
        secretKey: settings.coupangPartnersSecretKey,
        baseUrl: 'https://api-gateway.coupang.com',
      }

      // 쿠팡 URL에서 상품 ID 추출
      const productId = this._extractProductId(coupangUrl)
      if (!productId) {
        throw new CoupangPartnersErrorClass({
          code: 'INVALID_URL',
          message: '유효하지 않은 쿠팡 상품 URL입니다.',
        })
      }

      const requestData: CoupangDeeplinkRequest = {
        coupangUrls: [coupangUrl],
        subId: subId || 'f2t-super',
      }

      const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink'
      const query = `subId=${requestData.subId}`
      const authorization = this._generateHmac('POST', `${path}?${query}`, config.secretKey, config.accessKey)

      const response = await retry(
        () =>
          this.httpClient.post<CoupangDeeplinkResponse>(`${path}?${query}`, requestData, {
            headers: {
              Authorization: authorization,
              'Content-Type': 'application/json',
            },
          }),
        1000,
        3,
        'exponential',
      )

      if (response.data.rCode !== '0') {
        const mappedMessage = this._mapCoupangApiMessage(response.data.rMessage)
        throw new CoupangPartnersErrorClass({
          code: 'API_ERROR',
          message: mappedMessage,
          details: response.data,
        })
      }

      const affiliateLink = response.data.data[0]
      return {
        originalUrl: coupangUrl,
        shortenUrl: affiliateLink.shortenUrl,
        landingUrl: affiliateLink.landingUrl,
      }
    } catch (error) {
      if (error instanceof CoupangPartnersErrorClass) throw error
      this.logger.error('어필리에이트 링크 생성 실패:', error)
      throw new CoupangPartnersErrorClass({
        code: 'LINK_CREATION_FAILED',
        message: '어필리에이트 링크 생성에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 권한 체크
   */
  private async _checkPermission(permission: Permission): Promise<void> {
    const settings = await this.settingsService.getSettings()
    assertPermission(settings.licenseCache, permission)
  }

  /**
   * 쿠팡 파트너스 API용 HMAC 서명 생성 (공식 예제 기반)
   */
  private _generateHmac(method: 'POST' | 'GET', url: string, secretKey: string, accessKey: string): string {
    const parts = url.split(/\?/)
    const [path, query = ''] = parts

    const datetime = dayjs.utc().format('YYMMDD[T]HHmmss[Z]')
    const message = datetime + method + path + query

    const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex')

    return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`
  }

  /**
   * 쿠팡 URL에서 상품 ID 추출
   */
  private _extractProductId(url: string): string | null {
    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/')
      const productIndex = pathParts.findIndex(part => part === 'products')

      if (productIndex !== -1 && pathParts[productIndex + 1]) {
        return pathParts[productIndex + 1]
      }

      return null
    } catch (error) {
      return null
    }
  }

  private _mapCoupangApiMessage(originalMessage?: string): string {
    const normalized = (originalMessage || '').toLowerCase().trim()

    switch (normalized) {
      case 'url convert failed':
        return '쿠팡 파트너스 링크가 불가능한 상품입니다'
      default:
        return originalMessage || ''
    }
  }
}
