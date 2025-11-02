import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { Settings, IpMode, TetheringChangeType } from '@main/app/modules/settings/settings.types'
import { TwoCaptchaService } from '@main/app/modules/util/two-captcha.service'
import { OpenAI } from 'openai'
import * as XLSX from 'xlsx'

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly twoCaptchaService: TwoCaptchaService,
  ) {}

  async getSettings(): Promise<Settings> {
    const settings = await this.prisma.settings.findFirst({
      where: { id: 1 },
    })

    const defaultSettings: Settings = {
      showBrowserWindow: false,
      reuseWindowBetweenTasks: false, // 기본값은 새 창 생성
      taskDelay: 10,
      actionDelay: 0,
      imageUploadFailureAction: 'skip',
      openAIApiKey: '',
      twoCaptchaApiKey: '',
      licenseKey: '',
      proxies: [],
      proxyChangeMethod: 'random',
      proxyEnabled: false,
      ipMode: IpMode.NONE,
      tethering: {
        changeInterval: {
          type: TetheringChangeType.TIME,
          timeMinutes: 30,
          postCount: 5,
        },
      },
      monitoring: {
        includeImagesInAiAnalysis: true, // 기본값: 이미지 포함
      },
      comments: [],
      commentSelectionMethod: 'random',
      coupangPartnersAccessKey: '',
      coupangPartnersSecretKey: '',
      dcCaptchaEnabled: true, // 기본값: 활성화
      coupas: {
        keywordMin: 2, // 기본값: 최소 2개
        keywordMax: 5, // 기본값: 최대 5개
        productsPerKeyword: 1, // 기본값: 키워드당 1개
      },
    }
    const merged = {
      ...defaultSettings,
      ...(settings?.data as unknown as Settings),
    }
    return merged
  }

  async updateSettings(newSettings: Partial<Settings>) {
    const currentSettings = await this.getSettings()
    const mergedSettings = {
      ...currentSettings,
      ...newSettings,
    }
    await this.prisma.settings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        data: mergedSettings,
      },
      update: {
        data: mergedSettings,
      },
    })
    return mergedSettings
  }

  // OpenAI API 키 검증
  async validateOpenAIKey(apiKey: string): Promise<{ valid: boolean; error?: string; model?: string }> {
    try {
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        return { valid: false, error: 'API 키가 비어있습니다.' }
      }

      const openai = new OpenAI({ apiKey: apiKey.trim() })

      // 간단한 모델 목록 조회로 API 키 유효성 검증
      const models = await openai.models.list()

      // GPT 모델이 있는지 확인
      const gptModels = models.data.filter(model => model.id.includes('gpt') || model.id.includes('o1'))

      if (gptModels.length === 0) {
        return { valid: false, error: 'GPT 모델에 접근할 수 없습니다.' }
      }

      // 사용 가능한 첫 번째 GPT 모델 반환
      const availableModel =
        gptModels.find(m => m.id.includes('gpt-4') || m.id.includes('gpt-3.5') || m.id.includes('o1'))?.id ||
        gptModels[0].id

      return {
        valid: true,
        model: availableModel,
      }
    } catch (error) {
      this.logger.error('OpenAI API 키 검증 실패:', error)
    }
  }

  async importProxiesFromExcel(file: any) {
    if (!file || !file.buffer) {
      return { success: false, message: '파일이 업로드되지 않았습니다.' }
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    // 허용 컬럼: ip, port, id, pw (+ 한글 헤더: IP, 포트, 아이디, 비밀번호)
    const canonicalizeKey = (key: string): string => {
      const raw = String(key).trim()
      const lower = raw.toLowerCase()
      // 영문 기본 키
      if (lower === 'ip') return 'ip'
      if (lower === 'port') return 'port'
      if (lower === 'id' || lower === 'userid' || lower === 'user') return 'id'
      if (lower === 'pw' || lower === 'password' || lower === 'pass') return 'pw'
      // 한글 헤더 매핑
      if (raw === 'IP') return 'ip'
      if (raw === '포트') return 'port'
      if (raw === '아이디') return 'id'
      if (raw === '비밀번호') return 'pw'
      return lower
    }

    const proxies: Settings['proxies'] = []
    for (const row of rows) {
      const obj: Record<string, any> = {}
      Object.keys(row).forEach(key => {
        const k = canonicalizeKey(key)
        obj[k] = row[key]
      })

      const ip = String(obj['ip'] || '').trim()
      const portRaw = obj['port']
      const id = String(obj['id'] || '').trim() || undefined
      const pw = String(obj['pw'] || '').trim() || undefined

      const port = Number(portRaw)
      if (!ip || Number.isNaN(port) || port <= 0) {
        continue
      }

      proxies.push({ ip, port, id, pw })
    }

    const current = await this.getSettings()
    const combinedProxies = [...(current.proxies ?? []), ...proxies]
    const next: Settings = {
      ...current,
      proxies: combinedProxies,
    }
    await this.prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1, data: next as any },
      update: { data: next as any },
    })

    return { success: true, count: proxies.length }
  }

  async generateProxySampleExcel(): Promise<{ buffer: Buffer; filename: string }> {
    const headers = ['IP', '포트', '아이디', '비밀번호']
    const sampleRows = [
      { IP: '1.2.3.4', 포트: 8080, 아이디: 'user01', 비밀번호: 'pass01' },
      { IP: '5.6.7.8', 포트: 3128, 아이디: '', 비밀번호: '' },
    ]

    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '프록시목록')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const filename = `proxy-sample-${Date.now()}.xlsx`
    return { buffer, filename }
  }

  async validateTwoCaptchaKey(apiKey: string): Promise<{ valid: boolean; balance?: number; error?: string }> {
    return this.twoCaptchaService.validateApiKey(apiKey)
  }
}
