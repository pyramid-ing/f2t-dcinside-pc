import { Injectable, Logger } from '@nestjs/common'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { retry } from '@main/app/utils/retry'
import axios from 'axios'

interface TwoCaptchaSubmitResponse {
  status: number
  request: string
}

interface TwoCaptchaResultResponse {
  status: number
  request: string
}

@Injectable()
export class TwoCaptchaService {
  private readonly logger = new Logger(TwoCaptchaService.name)
  private readonly baseUrl = 'http://2captcha.com'

  /**
   * reCAPTCHA v2를 2captcha로 해결
   * @param apiKey 2captcha API 키
   * @param siteKey reCAPTCHA 사이트 키
   * @param pageUrl 페이지 URL
   * @returns reCAPTCHA 토큰
   */
  async solveRecaptchaV2(apiKey: string, siteKey: string, pageUrl: string): Promise<string> {
    if (!apiKey) {
      throw new CustomHttpException(ErrorCode.POST_PARAM_INVALID, {
        message: '2captcha API 키가 설정되지 않았습니다.',
      })
    }

    this.logger.log('2captcha reCAPTCHA v2 해결 시작')

    // 1. 캡챠 제출
    const captchaId = await this.submitRecaptcha(apiKey, siteKey, pageUrl)
    this.logger.log(`캡챠 ID: ${captchaId}`)

    // 2. 결과 대기 및 가져오기
    const token = await this.getRecaptchaResult(apiKey, captchaId)
    this.logger.log('2captcha reCAPTCHA v2 해결 완료')

    return token
  }

  /**
   * reCAPTCHA를 2captcha에 제출
   */
  private async submitRecaptcha(apiKey: string, siteKey: string, pageUrl: string): Promise<string> {
    const submitUrl = `${this.baseUrl}/in.php`

    const params = {
      key: apiKey,
      method: 'userrecaptcha',
      googlekey: siteKey,
      pageurl: pageUrl,
      json: 1,
    }

    try {
      const response = await axios.post(submitUrl, null, {
        params,
        timeout: 30000,
      })

      const data: TwoCaptchaSubmitResponse = response.data

      if (data.status === 1) {
        return data.request
      } else {
        throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, {
          message: `2captcha 제출 실패: ${data.request}`,
        })
      }
    } catch (error: any) {
      if (error.response) {
        throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, {
          message: `2captcha API 오류: ${error.response.data}`,
        })
      }
      throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, {
        message: `2captcha 네트워크 오류: ${error.message}`,
      })
    }
  }

  /**
   * 2captcha에서 reCAPTCHA 결과 가져오기
   */
  private async getRecaptchaResult(apiKey: string, captchaId: string): Promise<string> {
    const resultUrl = `${this.baseUrl}/res.php`

    return await retry(
      async () => {
        const response = await axios.get(resultUrl, {
          params: {
            key: apiKey,
            action: 'get',
            id: captchaId,
            json: 1,
          },
          timeout: 30000,
        })

        const data: TwoCaptchaResultResponse = response.data

        if (data.status === 1) {
          // 성공 - 토큰 반환
          return data.request
        } else if (data.request === 'CAPCHA_NOT_READY') {
          // 아직 준비되지 않음 - 재시도를 위해 에러 던지기
          this.logger.log('캡챠가 아직 준비되지 않았습니다. 10초 후 재시도...')
          throw new Error('CAPTCHA_NOT_READY')
        } else {
          // 오류 - 재시도하지 않고 즉시 실패
          throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, {
            message: `2captcha 결과 오류: ${data.request}`,
          })
        }
      },
      10000, // 10초 간격
      30, // 최대 30번 시도 (5분)
      'linear',
    )
  }

  /**
   * 2captcha 잔액 확인
   */
  async getBalance(apiKey: string): Promise<number> {
    if (!apiKey) {
      throw new CustomHttpException(ErrorCode.POST_PARAM_INVALID, {
        message: '2captcha API 키가 설정되지 않았습니다.',
      })
    }

    const balanceUrl = `${this.baseUrl}/res.php`

    try {
      const response = await axios.get(balanceUrl, {
        params: {
          key: apiKey,
          action: 'getbalance',
          json: 1,
        },
        timeout: 30000,
      })

      const data = response.data

      if (data.status === 1) {
        return parseFloat(data.request)
      } else {
        throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, {
          message: `2captcha 잔액 확인 실패: ${data.request}`,
        })
      }
    } catch (error: any) {
      if (error.response) {
        throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, {
          message: `2captcha API 오류: ${error.response.data}`,
        })
      }
      throw new CustomHttpException(ErrorCode.POST_SUBMIT_FAILED, {
        message: `2captcha 네트워크 오류: ${error.message}`,
      })
    }
  }

  /**
   * 2captcha API 키 유효성 검사
   */
  async validateApiKey(apiKey: string): Promise<{ valid: boolean; balance?: number; error?: string }> {
    if (!apiKey || apiKey.trim() === '') {
      return { valid: false, error: 'API 키가 비어있습니다.' }
    }

    try {
      const balance = await this.getBalance(apiKey)
      return { valid: true, balance }
    } catch (error: any) {
      return { valid: false, error: error.message }
    }
  }
}
