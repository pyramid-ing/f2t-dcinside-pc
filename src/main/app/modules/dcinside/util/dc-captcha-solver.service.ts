import { Injectable, Logger } from '@nestjs/common'
import { Page } from 'playwright'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import OpenAI from 'openai'

interface CaptchaResponse {
  answer: string
}

@Injectable()
export class DcCaptchaSolverService {
  private readonly logger = new Logger(DcCaptchaSolverService.name)

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * DC인사이드 캡차 해결
   * @param captchaImageBase64 캡차 이미지 base64 문자열
   * @returns 해결된 캡차 텍스트
   */
  async solveDcCaptcha(captchaImageBase64: string): Promise<string> {
    try {
      this.logger.log('DC인사이드 캡차 해결 시작')

      // 설정에서 OpenAI API 키 가져오기
      const settings = await this.settingsService.getSettings()
      if (!settings.openAIApiKey) {
        throw new Error('OpenAI API 키가 설정되지 않았습니다')
      }

      // OpenAI 클라이언트 초기화
      const openai = new OpenAI({
        apiKey: settings.openAIApiKey,
      })

      // OpenAI API 호출
      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `당신은 이미지를 OCR해줍니다.`,
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${captchaImageBase64}` },
              },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'captcha_schema',
            schema: {
              type: 'object',
              properties: {
                answer: {
                  type: 'string',
                  description: `이 이미지는 난독화되있습니다. 
- 정답은 한글, 영어는 소문자만, 숫자도 포함되있습니다.(숫자는0없음)
- 이미지에 표시된 텍스트를 정확히 읽어주세요`,
                },
              },
              required: ['answer'],
              additionalProperties: false,
            },
          },
        },
      })

      const answer = response.choices[0]?.message?.content

      if (!answer) {
        throw new Error('OpenAI API returned no answer')
      }

      const parsedAnswer: CaptchaResponse = JSON.parse(answer)

      if (!parsedAnswer.answer || typeof parsedAnswer.answer !== 'string') {
        throw new Error('Invalid captcha response format')
      }

      const captchaText = parsedAnswer.answer.trim()

      this.logger.log(`캡차 해결 완료: ${captchaText}`)
      return captchaText
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      this.logger.error(`DC 캡차 해결 실패: ${errorMessage}`)
      throw new Error(`캡차 해결 실패: ${errorMessage}`)
    }
  }

  /**
   * DC인사이드 캡차 이미지를 base64로 추출
   * @param page Playwright 페이지 객체
   * @param captchaSelector 캡차 이미지 selector
   * @returns 캡차 이미지의 base64 문자열
   */
  async extractCaptchaImageBase64(page: Page, captchaSelector: string): Promise<string> {
    try {
      const captchaImg = page.locator(captchaSelector)

      if ((await captchaImg.count()) === 0) {
        throw new Error(`캡차 이미지를 찾을 수 없습니다 (selector: ${captchaSelector})`)
      }

      // 캡차 이미지를 클릭하여 새로고침
      await captchaImg.click()
      await page.waitForTimeout(1000)

      // 캡차 이미지를 base64로 스크린샷
      const captchaBase64 = await captchaImg.screenshot({ type: 'png' })
      const captchaBase64String = captchaBase64.toString('base64')

      this.logger.log(`캡차 이미지 base64 추출 완료 (selector: ${captchaSelector})`)
      return captchaBase64String
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      this.logger.error(`캡차 이미지 추출 실패 (selector: ${captchaSelector}): ${errorMessage}`)
      throw new Error(`캡차 이미지 추출 실패: ${errorMessage}`)
    }
  }
}
