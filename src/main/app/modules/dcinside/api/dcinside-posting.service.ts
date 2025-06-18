import { DcinsideLoginService } from '@main/app/modules/dcinside/api/dcinside-login.service'
import { DcinsidePostDto } from '@main/app/modules/dcinside/api/dto/dcinside-post.dto'
import { CookieService } from '@main/app/modules/util/cookie.service'
import { sleep } from '@main/app/utils/sleep'
import { Injectable, Logger } from '@nestjs/common'
import { OpenAI } from 'openai'
import { Page } from 'puppeteer-core'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(StealthPlugin())

export type DcinsidePostParams = Omit<DcinsidePostDto, never>

@Injectable()
export class DcinsidePostingService {
  private readonly logger = new Logger(DcinsidePostingService.name)
  constructor(
    private readonly cookieService: CookieService,
    private readonly dcinsideLoginService: DcinsideLoginService,
  ) {}

  async postArticle(params: DcinsidePostParams): Promise<{ success: boolean, message: string, url?: string }> {
    let browser = null
    try {
      // 1. 갤러리 id 추출
      const match = params.galleryUrl.match(/id=(\w+)/)
      if (!match)
        throw new Error('갤러리 주소에서 id를 추출할 수 없습니다.')
      const galleryId = match[1]

      const launchOptions: any = {
        headless: params.headless ?? true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ko-KR,ko'],
      }
      if (process.env.NODE_ENV === 'production' && process.env.PUPPETEER_EXECUTABLE_PATH) {
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
          if (!isLoggedIn)
            throw new Error('로그인 필요')
        }
        else {
          throw new Error('로그인 필요')
        }
      }

      // 2. 글쓰기 페이지 이동 (리스트 → 글쓰기 버튼 클릭)
      const listUrl = `https://gall.dcinside.com/mgallery/board/lists?id=${galleryId}`
      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
      // 글쓰기 버튼 클릭 (goWrite)
      await page.waitForSelector('a.btn_write.txt', { timeout: 10000 })
      await page.click('a.btn_write.txt')
      await sleep(4000)

      // 3. 입력폼 채우기
      // 비번 (로그인 상태면 입력란이 없을 수 있음)
      if (await page.$('#password')) {
        await page.type('#password', params.password.toString(), { delay: 30 })
      }

      // 제목
      await page.waitForSelector('#subject', { timeout: 10000 })
      await page.type('#subject', params.title, { delay: 30 })

      // 말머리 선택 (headtext가 있을 때만)
      if (params.headtext) {
        await page.waitForSelector('.subject_list li', { timeout: 5000 })
        await page.evaluate((headtext) => {
          const items = Array.from(document.querySelectorAll('.subject_list li'))
          const target = items.find(
            li => li.getAttribute('data-val') === headtext || li.textContent?.trim() === headtext,
          )
          if (target)
            (target as HTMLElement).click()
        }, params.headtext)
        await sleep(300)
      }

      // 내용 (summernote 에디터, HTML 입력)
      await page.waitForSelector('#chk_html', { timeout: 10000 })
      // 코드뷰(HTML) 모드로 전환
      const htmlChecked = await page.$eval('#chk_html', el => (el as HTMLInputElement).checked)
      if (!htmlChecked) {
        await page.click('#chk_html')
        await new Promise(res => setTimeout(res, 300))
      }
      // textarea.note-codable에 HTML 입력
      await page.waitForSelector('.note-codable', { timeout: 5000 })
      await page.evaluate((html) => {
        const textarea = document.querySelector('.note-codable') as HTMLTextAreaElement
        if (textarea) {
          textarea.value = html
          // input 이벤트 트리거
          const event = new Event('input', { bubbles: true })
          textarea.dispatchEvent(event)
        }
      }, params.contentHtml)
      await new Promise(res => setTimeout(res, 300))
      // 코드뷰 해제 (WYSIWYG로 복귀)
      const htmlChecked2 = await page.$eval('#chk_html', el => (el as HTMLInputElement).checked)
      if (htmlChecked2) {
        await page.click('#chk_html')
        await new Promise(res => setTimeout(res, 300))
      }

      // 이미지 등록 (imagePaths, 팝업 윈도우 방식)
      if (params.imagePaths && params.imagePaths.length > 0) {
        // 1. 이미지 등록 버튼 클릭 (팝업 윈도우 오픈)
        await page.click('button[aria-label="이미지"]')
        // 2. 팝업 window 감지 (input.file_add)
        const popup = await new Promise<Page>(async (resolve, reject) => {
          browser.once('targetcreated', async (target) => {
            const popupPage = await target.page()
            if (popupPage)
              resolve(popupPage)
            else reject(new Error('이미지 팝업 윈도우를 찾을 수 없습니다.'))
          })
        })
        await popup.waitForSelector('input.file_add', { timeout: 10000 })
        // 3. 파일 업로드 (여러 파일 한 번에)
        await sleep(3000)
        const input = await popup.$('input.file_add')
        if (!input)
          throw new Error('이미지 업로드 input을 찾을 수 없습니다.')
        await input.uploadFile(...params.imagePaths)
        await sleep(3000)
        const btnApply = await popup.$('.btn_apply')
        await btnApply.click()
      }

      // 닉네임 입력 처리 (로그인 상태면 입력란이 없을 수 있음)
      if (params.nickname && (await page.$('#gall_nick_name'))) {
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
          if (el)
            el.removeAttribute('readonly')
        })
        await page.click('#name', { clickCount: 3 })
        await page.type('#name', params.nickname, { delay: 30 })
      }

      // 캡챠(자동등록방지) 감지 및 해제
      const captchaImg = await page.$('#kcaptcha')
      if (captchaImg) {
        // 1. 이미지 base64 추출
        const captchaBase64 = await captchaImg.screenshot({ encoding: 'base64' })
        // 2. OpenAI Vision API로 답 얻기
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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
                { type: 'text', text: '이건 캡챠 이미지야. 반드시 아래 형식으로만 대답해: { "answer": "정답" }' },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${captchaBase64}`,
                  },
                },
              ],
            },
          ],
          temperature: 0,
        })
        // 3. 답 추출 및 입력
        let answer = ''
        try {
          answer = JSON.parse(response.choices[0].message.content).answer
        }
        catch (e) {
          throw new Error('캡챠 해제 실패(OpenAI 응답 파싱 오류)')
        }
        await page.type('input[name=kcaptcha_code]', answer, { delay: 30 })
      }

      // 4. 등록 버튼 클릭
      await page.waitForSelector('button.btn_blue.btn_svc.write', { timeout: 10000 })
      await page.click('button.btn_blue.btn_svc.write')

      // 5. 등록 성공 대기 (최대 10초, 글 목록 이동 감지)
      await page.waitForNavigation({ timeout: 10000 })

      // 글 목록으로 이동 후, 최신글 URL 추출 시도
      const currentUrl = page.url()
      let postUrl = null
      try {
        // 목록 테이블에서 제목이 일치하는 첫 번째 글의 a href 추출
        await page.waitForSelector('table.gall_list', { timeout: 10000 })
        postUrl = await page.evaluate((title) => {
          const rows = document.querySelectorAll('table.gall_list tbody tr.ub-content')
          for (const row of rows) {
            const titTd = row.querySelector('td.gall_tit.ub-word')
            if (!titTd)
              continue
            const a = titTd.querySelector('a')
            if (!a)
              continue
            // 제목 텍스트 추출 (em, b 등 태그 포함 가능)
            const text = a.textContent?.replace(/\s+/g, ' ').trim()
            if (text === title) {
              return a.getAttribute('href')
            }
          }
          return null
        }, params.title)
      }
      catch {}
      let finalUrl = currentUrl
      if (postUrl) {
        if (postUrl.startsWith('/')) {
          finalUrl = `https://gall.dcinside.com${postUrl}`
        }
        else {
          finalUrl = postUrl
        }
      }
      return { success: true, message: '글 등록 성공', url: finalUrl }
    }
    catch (e) {
      this.logger.error(`디시인사이드 글 등록 실패: ${e.message}`)
      throw new Error(e.message)
    }
    finally {
      if (browser) {
        try {
          await browser.close()
        }
        catch {}
      }
    }
  }
}
