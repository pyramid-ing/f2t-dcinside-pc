import { Body, Controller, Get, Logger, Post } from '@nestjs/common'
import { SettingsService } from 'src/main/app/modules/settings/settings.service'

@Controller('settings')
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name)

  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    return this.settingsService.getSettings()
  }

  @Post()
  async updateSettings(@Body() settings: any) {
    return this.settingsService.updateSettings(settings)
  }

  @Post('validate-openai-key')
  async validateOpenAIKey(@Body() body: { apiKey: string }) {
    return this.settingsService.validateOpenAIKey(body.apiKey)
  }
}
