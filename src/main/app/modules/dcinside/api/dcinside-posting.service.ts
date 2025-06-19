import type { DcinsidePostDto } from '@main/app/modules/dcinside/api/dto/dcinside-post.dto'
import { DcinsideLoginService } from '@main/app/modules/dcinside/api/dcinside-login.service'
import { DcinsidePostSchema } from '@main/app/modules/dcinside/api/dto/schemas'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { CookieService } from '@main/app/modules/util/cookie.service'
import { sleep } from '@main/app/utils/sleep'
import { retry } from '@main/app/utils/retry'
import { Injectable, Logger } from '@nestjs/common'
import { OpenAI } from 'openai'
import { Page } from 'puppeteer-core'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { ZodError } from 'zod'

puppeteer.use(StealthPlugin())

export type DcinsidePostParams = DcinsidePostDto

@Injectable()
export class DcinsidePostingService {
  private readonly logger = new Logger(DcinsidePostingService.name)
  constructor(
    private readonly cookieService: CookieService,
    private readonly dcinsideLoginService: DcinsideLoginService,
    private readonly settingsService: SettingsService,
  ) {}

  private validateParams(rawParams: any): DcinsidePostDto {
    try {
      return DcinsidePostSchema.parse(rawParams)
    } catch (error) {
      if (error instanceof ZodError) {
        const zodErrors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        throw new Error(`포스팅 파라미터 검증 실패: ${zodErrors.join(', ')}`)
      }
      throw new Error(`포스팅 파라미터 검증 실패: ${error.message}`)
    }
  }

  private async solveCapcha(page: Page): Promise<void> {
    const captchaImg = await page.$('#kcaptcha')
    if (!captchaImg) return

    const captchaBase64 = await captchaImg.screenshot({ encoding: 'base64' })
    const globalSettings = await this.settingsService.findByKey('global')
    const openAIApiKey = (globalSettings?.data as any)?.openAIApiKey
    if (!openAIApiKey) throw new Error('OpenAI API 키가 설정되어 있지 않습니다.')

    const openai = new OpenAI({ apiKey: openAIApiKey })

    // OpenAI 호출 재시도 로직 (최대 3회)
    let openaiTryCount = 0
    let answer = ''

    while (openaiTryCount < 3) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that only responds with a JSON object like: { "answer": "value" }.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: '이건 캡챠 이미지야. 캡챠 구성은 영문 소문자와 숫자로만 이뤄졌어. 반드시 다음 형식으로만 대답해: { "answer": "정답" }',
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/png;base64,${captchaBase64}` },
                },
              ],
            },
          ],
          temperature: 0,
        })

        try {
          const responseContent = response.choices[0]?.message?.content
          if (!responseContent) {
            throw new Error('OpenAI 응답이 비어있습니다.')
          }

          const parsed = JSON.parse(responseContent)
          if (!parsed.answer || typeof parsed.answer !== 'string') {
            throw new Error('OpenAI 응답에서 answer 필드를 찾을 수 없습니다.')
          }

          answer = parsed.answer
          break // 성공하면 루프 탈출
        } catch (parseError) {
          throw new Error(`OpenAI 응답 파싱 오류: ${response.choices[0]?.message?.content || 'No content'}`)
        }
      } catch (error) {
        openaiTryCount += 1
        this.logger.warn(`OpenAI 캡챠 해제 시도 ${openaiTryCount}/3 실패: ${error.message}`)

        if (openaiTryCount >= 3) {
          throw new Error(`OpenAI 캡챠 해제 실패 (3회 시도): ${error.message}`)
        }

        // 재시도 전 잠시 대기
        await sleep(1000)
      }
    }

    // 기존 입력값을 지우고 새로 입력
    await page.evaluate(() => {
      const el = document.querySelector('input[name=kcaptcha_code]') as HTMLInputElement | null
      if (el) el.value = ''
    })
    await page.type('input[name=kcaptcha_code]', answer, { delay: 30 })
  }

  private async inputPassword(page: Page, password: string): Promise<void> {
    if (await page.$('#password')) {
      await page.type('#password', password.toString(), { delay: 30 })
    }
  }

  private async inputTitle(page: Page, title: string): Promise<void> {
    await page.waitForSelector('#subject', { timeout: 10000 })
    await page.type('#subject', title, { delay: 30 })
  }

  private async selectHeadtext(page: Page, headtext: string): Promise<void> {
    if (!headtext) return

    try {
      await page.waitForSelector('.subject_list li', { timeout: 5000 })
      const found = await page.evaluate(headtext => {
        const items = Array.from(document.querySelectorAll('.subject_list li'))
        const target = items.find(li => li.getAttribute('data-val') === headtext || li.textContent?.trim() === headtext)
        if (target) {
          ;(target as HTMLElement).click()
          return true
        }
        return false
      }, headtext)

      if (!found) {
        this.logger.warn(`말머리를 찾을 수 없습니다. 기본값으로 처리: ${headtext}`)
      }

      await sleep(300)
    } catch (error) {
      this.logger.warn(`말머리 선택 중 오류 발생, 기본값으로 처리: ${headtext} - ${error.message}`)
    }
  }

  private async inputContent(page: Page, contentHtml: string): Promise<void> {
    await page.waitForSelector('#chk_html', { timeout: 10000 })
    // 코드뷰(HTML) 모드로 전환
    const htmlChecked = await page.$eval('#chk_html', el => (el as HTMLInputElement).checked)
    if (!htmlChecked) {
      await page.click('#chk_html')
      await new Promise(res => setTimeout(res, 300))
    }
    // textarea.note-codable에 HTML 입력
    await page.waitForSelector('.note-codable', { timeout: 5000 })
    await page.evaluate(html => {
      const textarea = document.querySelector('.note-codable') as HTMLTextAreaElement
      if (textarea) {
        textarea.value = html
        // input 이벤트 트리거
        const event = new Event('input', { bubbles: true })
        textarea.dispatchEvent(event)
      }
    }, contentHtml)
    await new Promise(res => setTimeout(res, 300))
    // 코드뷰 해제 (WYSIWYG로 복귀)
    const htmlChecked2 = await page.$eval('#chk_html', el => (el as HTMLInputElement).checked)
    if (htmlChecked2) {
      await page.click('#chk_html')
      await new Promise(res => setTimeout(res, 300))
    }
  }

  private async uploadImages(page: Page, browser: any, imagePaths: string[]): Promise<void> {
    // 1. 이미지 등록 버튼 클릭 (팝업 윈도우 오픈)
    await page.click('button[aria-label="이미지"]')

    // 2. 팝업 window 감지 (input.file_add)
    const popup = await new Promise<Page>(async (resolve, reject) => {
      browser.once('targetcreated', async (target: any) => {
        const popupPage = await target.page()
        if (popupPage) resolve(popupPage)
        else reject(new Error('이미지 팝업 윈도우를 찾을 수 없습니다.'))
      })
    })

    await popup.waitForSelector('input.file_add', { timeout: 10000 })

    // 3. 파일 업로드
    await sleep(2000) // 팝업 안정화 대기
    const input = await popup.$('input.file_add')
    if (!input) throw new Error('이미지 업로드 input을 찾을 수 없습니다.')

    await input.uploadFile(...imagePaths)
    this.logger.log(`${imagePaths.length}개 이미지 업로드 시작`)

    // 4. 업로드 완료 대기 - 로딩 상태 확인
    await this.waitForImageUploadComplete(popup, imagePaths.length)

    // 5. 적용 버튼 클릭 (여러 방법으로 시도)
    await this.clickApplyButtonSafely(popup)
  }

  private async waitForImageUploadComplete(popup: Page, expectedImageCount: number): Promise<void> {
    this.logger.log('이미지 업로드 완료 대기 중...')

    const maxWaitTime = 60000 // 최대 60초 대기
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // 로딩 박스가 있는지 확인
        const loadingBox = await popup.$('.loding_box')
        if (loadingBox) {
          this.logger.log('이미지 업로드 진행 중...')
          await sleep(2000)
          continue
        }

        // 업로드된 이미지 리스트 확인
        const uploadedImages = await popup.$$('ul#sortable li[data-key]')
        this.logger.log(`업로드된 이미지 수: ${uploadedImages.length}/${expectedImageCount}`)

        if (uploadedImages.length >= expectedImageCount) {
          // 모든 이미지가 data-key를 가지고 있는지 확인
          const allHaveDataKey = await popup.evaluate(() => {
            const items = document.querySelectorAll('ul#sortable li')
            return Array.from(items).every(item => item.hasAttribute('data-key'))
          })

          if (allHaveDataKey) {
            this.logger.log('모든 이미지 업로드 완료!')
            break
          }
        }

        await sleep(1000)
      } catch (error) {
        this.logger.warn(`업로드 상태 확인 중 오류: ${error.message}`)
        await sleep(1000)
      }
    }

    // 추가 안정화 대기
    await sleep(2000)
  }

  private async clickApplyButtonSafely(popup: Page): Promise<void> {
    this.logger.log('적용 버튼 클릭 시도...')

    const maxRetries = 10
    let retryCount = 0

    while (retryCount < maxRetries) {
      try {
        // 적용 버튼 존재 확인
        await popup.waitForSelector('.btn_apply', { timeout: 5000 })

        // 적용 버튼 클릭
        this.logger.log(`${retryCount + 1}차 적용 버튼 클릭 시도`)
        // 방법 1: 일반 클릭
        await popup.click('.btn_apply')

        // 클릭 후 팝업 닫힘 확인 (1초 대기)
        await sleep(1000)

        if (popup.isClosed()) {
          this.logger.log('팝업이 닫혔습니다. 이미지 업로드 완료.')
          return
        }

        retryCount++
      } catch (error) {
        retryCount++
        this.logger.warn(`적용 버튼 클릭 실패 (시도 ${retryCount}/${maxRetries}): ${error.message}`)

        if (retryCount >= maxRetries) {
          throw new Error(`이미지 업로드 실패: 적용 버튼 클릭 실패 (${maxRetries}회 시도)`)
        }

        await sleep(1000)
      }
    }

    // 최대 횟수 초과 시 에러 처리
    throw new Error(`이미지 업로드 실패: 적용 버튼 클릭 실패 (${maxRetries}회 시도 후 팝업이 닫히지 않음)`)
  }

  private async inputNickname(page: Page, nickname: string): Promise<void> {
    if (await page.$('#gall_nick_name')) {
      // 닉네임 input이 readonly인지 확인
      await page.waitForSelector('#gall_nick_name', { timeout: 10000 })
      const isReadonly = await page.$eval('#gall_nick_name', el => el.hasAttribute('readonly'))
      if (isReadonly) {
        // x버튼 클릭해서 닉네임 입력란 활성화
        const xBtn = await page.$('#btn_gall_nick_name_x')
        if (xBtn) {
          await xBtn.click()
          await new Promise(res => setTimeout(res, 300))
        }
      }
      // 닉네임 입력란이 활성화되었으면 입력
      await page.evaluate(() => {
        const el = document.getElementById('gall_nick_name')
        if (el) el.removeAttribute('readonly')
      })
      await page.click('#name', { clickCount: 3 })
      await page.type('#name', nickname, { delay: 30 })
    }
  }

  private async submitPostAndHandleErrors(page: Page): Promise<void> {
    const captchaErrorMessages = ['자동입력 방지코드가 일치하지 않습니다.', 'code은(는) 영문-숫자 조합이어야 합니다.']
    let captchaTryCount = 0

    while (true) {
      await this.solveCapcha(page)

      // 등록 버튼 클릭 후, alert 또는 정상 이동 여부 확인
      await page.waitForSelector('button.btn_blue.btn_svc.write', { timeout: 10000 })

      // dialog(알림창) 대기 프로미스 – 8초 내 발생하지 않으면 null 반환
      const dialogPromise: Promise<string | null> = new Promise(resolve => {
        const handler = async (dialog: any) => {
          const msg = dialog.message()
          await dialog.accept()
          resolve(msg)
        }
        page.once('dialog', handler)
        setTimeout(() => resolve(null), 8000)
      })

      await page.click('button.btn_blue.btn_svc.write')

      // dialog 결과와 navigation 중 먼저 완료되는 것을 대기
      const dialogMessage = await Promise.race([
        dialogPromise,
        page
          .waitForNavigation({ timeout: 10000 })
          .then(() => null)
          .catch(() => null),
      ])

      // 알림창이 떴을 경우 처리
      if (dialogMessage) {
        // 캡챠 오류 메시지일 경우에만 재시도
        if (captchaErrorMessages.some(m => dialogMessage.includes(m))) {
          captchaTryCount += 1
          if (captchaTryCount >= 3) throw new Error('캡챠 해제 실패(3회 시도)')

          // 새 캡챠 이미지를 로드하기 위해 이미지 클릭
          try {
            await page.evaluate(() => {
              const img = document.getElementById('kcaptcha') as HTMLImageElement | null
              if (img) img.click()
            })
          } catch {}

          await sleep(1000)
          continue // while – 다시 등록 버튼 클릭 시도
        } else {
          // 캡챠 오류가 아닌 다른 오류 (IP 블락, 권한 없음 등) - 즉시 실패 처리
          throw new Error(`글 등록 실패: ${dialogMessage}`)
        }
      }

      // dialog가 없으면 성공으로 간주하고 루프 탈출
      break
    }
  }

  private async extractPostUrl(page: Page, title: string): Promise<string> {
    const currentUrl = page.url()
    let postUrl = null
    try {
      // 목록 테이블에서 제목이 일치하는 첫 번째 글의 a href 추출
      await page.waitForSelector('table.gall_list', { timeout: 10000 })
      postUrl = await page.evaluate(title => {
        const rows = Array.from(document.querySelectorAll('table.gall_list tbody tr.ub-content'))
        for (const row of rows) {
          const titTd = row.querySelector('td.gall_tit.ub-word')
          if (!titTd) continue
          const a = titTd.querySelector('a')
          if (!a) continue
          // 제목 텍스트 추출 (em, b 등 태그 포함 가능)
          const text = a.textContent?.replace(/\s+/g, ' ').trim()
          if (text === title) {
            return a.getAttribute('href')
          }
        }
        return null
      }, title)
    } catch {}

    if (postUrl) {
      if (postUrl.startsWith('/')) {
        return `https://gall.dcinside.com${postUrl}`
      } else {
        return postUrl
      }
    }
    return currentUrl
  }

  private async navigateToWritePage(page: Page, galleryId: string): Promise<void> {
    const success = await retry(
      async () => {
        const listUrl = `https://gall.dcinside.com/mgallery/board/lists?id=${galleryId}`
        this.logger.log(`글쓰기 페이지 이동 시도: ${listUrl}`)

        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })

        // 글쓰기 버튼 클릭 (goWrite)
        await page.waitForSelector('a.btn_write.txt', { timeout: 10000 })
        await page.click('a.btn_write.txt')
        await sleep(4000)

        // 글쓰기 페이지로 정상 이동했는지 확인
        const currentUrl = page.url()
        if (!currentUrl.includes('/write')) {
          this.logger.warn('글쓰기 페이지로 이동하지 못했습니다.')
          return false
        }

        this.logger.log('글쓰기 페이지 이동 성공')
        return true
      },
      1000,
      3,
      'linear',
    )

    if (!success) {
      throw new Error('글쓰기 페이지 이동 실패 (3회 시도)')
    }
  }

  async postArticle(rawParams: any): Promise<{ success: boolean; message: string; url?: string }> {
    let browser = null
    try {
      // 0. 파라미터 검증
      const params = this.validateParams(rawParams)

      // 1. 갤러리 id 추출
      const match = params.galleryUrl.match(/id=(\w+)/)
      if (!match) throw new Error('갤러리 주소에서 id를 추출할 수 없습니다.')
      const galleryId = match[1]

      const launchOptions: any = {
        headless: params.headless ?? true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ko-KR,ko'],
      }
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
      }
      browser = await puppeteer.launch(launchOptions)
      const page: Page = await browser.newPage()
      await page.setExtraHTTPHeaders({
        'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      })

      // 로그인 쿠키 적용 및 필요시 로그인
      if (params.loginId) {
        const cookies = this.cookieService.loadCookies('dcinside', params.loginId)
        if (cookies && cookies.length > 0) {
          await browser.setCookie(...cookies)
          // 로그인 상태 확인 (공통 서비스 활용)
          const isLoggedIn = await this.dcinsideLoginService.isLogin(page)
          if (!isLoggedIn) throw new Error('로그인 필요')
        } else {
          throw new Error('로그인 필요')
        }
      }

      // 2. 글쓰기 페이지 이동 (리스트 → 글쓰기 버튼 클릭)
      await this.navigateToWritePage(page, galleryId)

      // 3. 입력폼 채우기
      await this.inputTitle(page, params.title)
      if (params.headtext) {
        await this.selectHeadtext(page, params.headtext)
      }
      await this.inputContent(page, params.contentHtml)

      if (params.nickname) {
        await this.inputNickname(page, params.nickname)
      }
      await this.inputPassword(page, params.password)

      // 이미지 등록 (imagePaths, 팝업 윈도우 방식)
      if (params.imagePaths && params.imagePaths.length > 0) {
        await this.uploadImages(page, browser, params.imagePaths)
      }

      // 캡챠(자동등록방지) 처리 및 등록 버튼 클릭을 최대 3회 재시도
      await this.submitPostAndHandleErrors(page)

      // 글 등록이 성공하여 목록으로 이동했을 시점
      // 글 목록으로 이동 후, 최신글 URL 추출 시도
      const finalUrl = await this.extractPostUrl(page, params.title)

      return { success: true, message: '글 등록 성공', url: finalUrl }
    } catch (e) {
      this.logger.error(`디시인사이드 글 등록 실패: ${e.message}`)
      throw new Error(e.message)
    } finally {
      if (browser) {
        try {
          await browser.close()
        } catch {}
      }
    }
  }
}
