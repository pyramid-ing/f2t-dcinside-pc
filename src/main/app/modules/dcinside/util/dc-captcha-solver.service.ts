import { Injectable, Logger } from '@nestjs/common'
import { Page } from 'playwright'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import axios from 'axios'

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

      // OpenAI API 호출
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `You are a CAPTCHA solver that ONLY responds with JSON format: { "answer": "captcha_text" }. Never provide explanations or additional text.

이 이미지는 CAPTCHA입니다. 
- 이미지에 표시된 텍스트를 정확히 읽어주세요
- 대소문자를 구분하여 정확히 입력해주세요
- 특수문자나 공백이 있다면 그대로 포함해주세요
- 답변은 반드시 JSON 형식으로만 해주세요: {"answer": "실제캡차텍스트"}`,
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
                    description: 'The text shown in the CAPTCHA image',
                  },
                },
                required: ['answer'],
                additionalProperties: false,
              },
            },
          },
          max_tokens: 50,
        },
        {
          headers: {
            Authorization: `Bearer ${settings.openAIApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      )

      const answer = response.data.choices[0]?.message?.content

      if (!answer) {
        throw new Error('OpenAI API returned no answer')
      }

      const parsedAnswer = JSON.parse(answer)
      const captchaText = parsedAnswer.answer

      this.logger.log(`캡차 해결 완료: ${captchaText}`)
      return captchaText
    } catch (error) {
      this.logger.error(`DC 캡차 해결 실패: ${error.message}`)
      throw error
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
      this.logger.error(`캡차 이미지 추출 실패 (selector: ${captchaSelector}): ${error.message}`)
      throw error
    }
  }
}
