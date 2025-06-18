import * as fs from 'node:fs'
import { InstagramDmService } from '../api/instagram-dm.service'
import { InstagramFollowService } from '../api/instagram-follow.service'
import { InstagramLoginService } from '../api/instagram-login.service'
import { InstagramSearchService } from '../api/instagram-search.service'
import {
  WorkflowExportXlsxDto,
  WorkflowSendDmToDto,
} from './dto/instagram-worflow.dto'
import { SettingsService } from '../../../shared/settings.service'
import { humanClick } from '../../../utils/human-actions'
import { sleep } from '../../../utils/sleep'
import { Body, Controller, HttpException, HttpStatus, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { File as MulterFile } from 'multer'
import * as XLSX from 'xlsx'

@Controller()
export class InstagramWorkflowController {
  constructor(
    private readonly loginService: InstagramLoginService,
    private readonly searchService: InstagramSearchService,
    private readonly dmService: InstagramDmService,
    private readonly followService: InstagramFollowService,
    private readonly settingsService: SettingsService,
  ) {}

  private async getRandomDelayFromSettings(): Promise<number> {
    const setting = await this.settingsService.findByKey('instagram')
    let minDelay = 1000
    let maxDelay = 3000
    if (setting?.data) {
      try {
        const parsed = typeof setting.data === 'string' ? JSON.parse(setting.data) : setting.data
        minDelay = parsed.minDelay ?? 1000
        maxDelay = parsed.maxDelay ?? 3000
      }
      catch {}
    }
    return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay
  }

  @Post('export-posts-xlsx')
  async exportPostsToXlsx(@Body() dto: WorkflowExportXlsxDto, @Res() res: Response) {
    // headless 설정 불러오기
    const setting = await this.settingsService.findByKey('instagram')
    let headless = true
    if (setting?.data) {
      try {
        const parsed = typeof setting.data === 'string' ? JSON.parse(setting.data) : setting.data
        headless = parsed.headless ?? true
      }
      catch {}
    }
    const browser = await this.loginService.browserService.createBrowser(headless)
    try {
      // 쿠키 로드 시도 (username은 'instagram' 등 고정값 또는 실제 사용자명)
      await this.loginService.browserService.loadCookiesToBrowser(browser, 'instagram')
      const page = await this.loginService.browserService.getPage(browser)
      await page.goto('https://www.instagram.com')
      await sleep(await this.getRandomDelayFromSettings())
      // 3. 유저 목록 추출 (검색)
      const searchResult = await this.searchService.search({
        keyword: dto.keyword,
        limit: dto.limit,
        headless: false,
      }, page)
      if (!searchResult.success) {
        await page.close()
        throw new HttpException('검색 실패', HttpStatus.BAD_REQUEST)
      }
      // 4. 엑셀 데이터 생성 (id, pw, 대상id, DM내용, 팔로우)
      const rows = searchResult.posts.map(post => ({
        targetId: post.owner?.username || '',
        dm: '',
        follow: '',
      }))
      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
      res.setHeader('Content-Disposition', 'attachment; filename="export.xlsx"')
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.send(buffer)
    }
    finally {
      await browser.close()
    }
  }

  @Post('send-dm-to')
  @UseInterceptors(FileInterceptor('file'))
  async sendDmTo(@UploadedFile() file: MulterFile, @Body() body: WorkflowSendDmToDto, @Res() res: Response) {
    if (!file) {
      throw new HttpException('엑셀 파일이 필요합니다.', HttpStatus.BAD_REQUEST)
    }
    // 1. 엑셀 파싱
    const workbook = XLSX.read(file.buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet)
    if (!rows.length) {
      throw new HttpException('엑셀 데이터가 비어있습니다.', HttpStatus.BAD_REQUEST)
    }

    // headless 설정 불러오기
    const setting = await this.settingsService.findByKey('instagram')
    let headless = true
    if (setting?.data) {
      try {
        const parsed = typeof setting.data === 'string' ? JSON.parse(setting.data) : setting.data
        headless = parsed.headless ?? true
      }
      catch {}
    }
    const browser = await this.loginService.browserService.createBrowser(headless)
    try {
      await this.loginService.browserService.loadCookiesToBrowser(browser, 'instagram')
      const page = await this.loginService.browserService.getPage(browser)
      await page.goto('https://www.instagram.com')
      await sleep(await this.getRandomDelayFromSettings())
      // 4. 각 행마다 자동 처리 (동일 page 재사용)
      const results = []
      for (const row of rows) {
        const { targetId, dm, follow } = row as any
        await page.goto(`https://www.instagram.com/${targetId}/`)
        let followResult = null
        let dmResult = null
        if (follow === 1 || follow === '1') {
          followResult = await this.followService.follow({ username: targetId, loginUsername: 'instagram' }, page)
        }
        if (dm) {
          dmResult = await this.dmService.sendDm({ username: targetId, message: dm, loginUsername: 'instagram' }, page)
        }
        results.push({ targetId, followResult, dmResult })
        await sleep(await this.getRandomDelayFromSettings())
      }
      res.json({ success: true, results })
    }
    finally {
      await browser.close()
    }
  }

  /**
   * 로그인 후 '정보 저장' 다이얼로그 자동 처리
   */
  private async handleSaveInfoDialog(page: any) {
    try {
      await page.waitForSelector('button._acan._acap._acas._aj1-._ap30', { timeout: 3000 })
      // '정보 저장' 버튼 텍스트 확인 후 클릭
      const saveBtnIndex = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button._acan._acap._acas._aj1-._ap30'))
        for (let i = 0; i < btns.length; i++) {
          if (btns[i].textContent?.trim() === '정보 저장')
            return i
        }
        return -1
      })
      if (saveBtnIndex !== -1) {
        const saveBtnSelector = `button._acan._acap._acas._aj1-._ap30:nth-of-type(${saveBtnIndex + 1})`
        await humanClick(page, saveBtnSelector)
      }
    }
    catch {
      // 다이얼로그가 안 뜨면 무시
    }
  }

  /**
   * 인스타그램 수동 로그인 워크플로우 (로그인만 수행)
   */
  @Post('login')
  async workflowLogin(@Res() res: Response) {
    // 로그인은 무조건 headless: false
    const browser = await this.loginService.browserService.createBrowser(false)
    const loginPage = await this.loginService.browserService.getPage(browser)

    try {
      await loginPage.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' })
      // 1분 동안 1초마다 로그인 체크
      const start = Date.now()
      let isLoggedIn = false
      while (Date.now() - start < 60000) {
        await sleep(1000)
        isLoggedIn = await this.loginService.checkLoginStatus(loginPage)
        if (isLoggedIn) {
          await sleep(3000)
          await this.handleSaveInfoDialog(loginPage)
          await this.loginService.browserService.saveCookies(loginPage.browserContext().browser(), 'instagram')
          return res.json({ success: true, message: '인스타그램 로그인이 완료되었습니다.' })
        }
      }
      return res.status(408).json({ success: false, message: '로그인 대기 시간이 초과되었습니다. 1분 내에 로그인해주세요.' })
    }
    catch (error) {
      return res.status(500).json({ success: false, message: `로그인 워크플로우 실패: ${error.message}` })
    }
    finally {
      await browser.close()
    }
  }

  /**
   * 인스타그램 로그인 쿠키 초기화 (로그아웃)
   */
  @Post('logout')
  async workflowLogout(@Res() res: Response) {
    try {
      // 쿠키 파일 경로 (username은 'instagram'으로 고정)
      const cookiePath = this.loginService.browserService.getCookiePath('instagram')
      if (fs.existsSync(cookiePath)) {
        fs.unlinkSync(cookiePath)
      }
      return res.json({ success: true, message: '로그인 정보가 초기화되었습니다.' })
    }
    catch (error) {
      return res.status(500).json({ success: false, message: `로그아웃 실패: ${error.message}` })
    }
  }
}
