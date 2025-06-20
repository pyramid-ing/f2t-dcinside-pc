import { Body, Controller, Get, Logger, Post, Put, Param } from '@nestjs/common'
import { SettingsService } from 'src/main/app/modules/settings/settings.service'
import { PrismaService } from '../../shared/prisma.service'

@Controller('settings')
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get('global')
  async getGlobalSettings() {
    try {
      const setting = await this.settingsService.findByKey('global')
      return { success: true, data: setting?.data || {} }
    } catch (error) {
      this.logger.error('글로벌 설정 조회 실패:', error)
      return { success: false, error: error.message }
    }
  }

  @Post('global')
  async saveGlobalSettings(@Body() data: any) {
    try {
      await this.settingsService.saveByKey('global', data)
      return { success: true }
    } catch (error) {
      this.logger.error('글로벌 설정 저장 실패:', error)
      return { success: false, error: error.message }
    }
  }

  @Get('app')
  async getAppSettings() {
    try {
      const setting = await this.settingsService.findByKey('app')
      const defaultSettings = {
        showBrowserWindow: true, // 기본값: 창보임
        taskDelay: 10, // 기본값: 10초
      }
      return { success: true, data: setting?.data || defaultSettings }
    } catch (error) {
      this.logger.error('앱 설정 조회 실패:', error)
      return { success: false, error: error.message }
    }
  }

  @Post('app')
  async saveAppSettings(@Body() data: any) {
    try {
      await this.settingsService.saveByKey('app', data)
      return { success: true }
    } catch (error) {
      this.logger.error('앱 설정 저장 실패:', error)
      return { success: false, error: error.message }
    }
  }

  @Get()
  async getAllSettings() {
    return this.settingsService.findAll()
  }

  @Get(':key')
  async getSettingByKey(@Param('key') key: string) {
    return this.settingsService.findByKey(key)
  }

  @Put(':key')
  async updateSetting(@Param('key') key: string, @Body() data: any) {
    return this.settingsService.upsert(key, data)
  }

  @Post('validate-openai-key')
  async validateOpenAIKey(@Body() body: { apiKey: string }) {
    return this.settingsService.validateOpenAIKey(body.apiKey)
  }
}
