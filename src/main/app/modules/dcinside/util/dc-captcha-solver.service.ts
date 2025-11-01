import { Injectable, Logger } from '@nestjs/common'
import { Page } from 'playwright'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import axios from 'axios'
import sharp from 'sharp'

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
                  text: `Read the text on image 
- The answer consists of lowercase English letters (a-z) and numbers (0-9), korean letter
- Characters are black or very dark colored
- Characters may have slight rotation or distortion

✅ Characters (answer candidates):
- Color: Black or very dark (#000000~#333333 range)
- Clear, readable text with good contrast against white background
- Mix of lowercase letters and numbers, all clearly distinguishable

⚙️ Noise removal completed:
- Light blue noise lines have been removed
- Gray noise elements have been removed
- Only the main text characters remain visible`,
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
                    description: 'The text answer in the image',
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
      await page.waitForTimeout(3000)

      // 캡차 이미지를 base64로 스크린샷
      const captchaBase64 = await captchaImg.screenshot({ type: 'png' })

      // 파란색 노이즈 제거 처리 / 임시 제거처리
      // const processedImageBuffer = await this.removeBlueNoise(captchaBase64)
      const captchaBase64String = captchaBase64.toString('base64')

      this.logger.log(`캡차 이미지 base64 추출 완료 (selector: ${captchaSelector})`)
      return captchaBase64String
    } catch (error) {
      this.logger.error(`캡차 이미지 추출 실패 (selector: ${captchaSelector}): ${error.message}`)
      throw error
    }
  }

  /**
   * 파란색 노이즈 제거 처리
   * @param imageBuffer 원본 이미지 버퍼
   * @returns 처리된 이미지 버퍼
   */
  private async removeBlueNoise(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // 이미지를 RGBA로 변환
      const image = sharp(imageBuffer).ensureAlpha()

      // 픽셀 단위 조작
      const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        // 제거할 노이즈 색상: #829cbd (RGB: 130, 156, 189), #97b0c9 (RGB: 151, 176, 201), #a7bdd3 (RGB: 167, 189, 211), #e5e5e5 (RGB: 229, 229, 229)
        // 유지할 텍스트 색상: #114985 (RGB: 17, 73, 133)

        // 노이즈 색상 범위 체크 (약간의 허용 오차 포함)
        const isNoiseColor =
          this.isSimilarColor(r, g, b, 130, 156, 189, 20) || // #829cbd
          this.isSimilarColor(r, g, b, 151, 176, 201, 20) || // #97b0c9
          this.isSimilarColor(r, g, b, 167, 189, 211, 20) || // #a7bdd3
          this.isSimilarColor(r, g, b, 229, 229, 229, 15) // #e5e5e5

        // 텍스트 색상이 아닌 경우에만 노이즈로 간주
        if (isNoiseColor && !this.isSimilarColor(r, g, b, 17, 73, 133, 15)) {
          data[i + 3] = 0 // 알파값 0 (투명)
        }
      }

      // 처리된 이미지를 PNG로 변환하여 반환
      const processedBuffer = await sharp(data, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 4,
        },
      })
        .png()
        .toBuffer()

      this.logger.log('파란색 노이즈 제거 처리 완료')
      return processedBuffer
    } catch (error) {
      this.logger.error(`파란색 노이즈 제거 실패: ${error.message}`)
      // 실패 시 원본 이미지 반환
      return imageBuffer
    }
  }

  /**
   * 두 색상이 유사한지 확인
   * @param r1, g1, b1 첫 번째 색상의 RGB 값
   * @param r2, g2, b2 두 번째 색상의 RGB 값
   * @param tolerance 허용 오차
   * @returns 유사한 색상인지 여부
   */
  private isSimilarColor(
    r1: number,
    g1: number,
    b1: number,
    r2: number,
    g2: number,
    b2: number,
    tolerance: number,
  ): boolean {
    const deltaR = Math.abs(r1 - r2)
    const deltaG = Math.abs(g1 - g2)
    const deltaB = Math.abs(b1 - b2)

    return deltaR <= tolerance && deltaG <= tolerance && deltaB <= tolerance
  }
}
