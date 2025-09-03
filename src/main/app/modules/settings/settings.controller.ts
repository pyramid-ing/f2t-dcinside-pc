import {
  Body,
  Controller,
  Get,
  Header,
  Logger,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { SettingsService } from 'src/main/app/modules/settings/settings.service'
import type { Response } from 'express'
import { TetheringService } from '@main/app/modules/util/tethering.service'
import { AuthGuard, Permission, Permissions } from '@main/app/modules/auth/auth.guard'

@Controller('settings')
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name)

  constructor(
    private readonly settingsService: SettingsService,
    private readonly tetheringService: TetheringService,
  ) {}

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

  @Post('proxies/upload-excel')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProxyExcel(@UploadedFile() file: any) {
    return this.settingsService.importProxiesFromExcel(file)
  }

  @Get('proxies/sample-excel')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async downloadProxySample(@Res() res: Response) {
    const { buffer, filename } = await this.settingsService.generateProxySampleExcel()
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.send(buffer)
  }

  @UseGuards(AuthGuard)
  @Permissions(Permission.TETHERING)
  @Post('tethering/check-connection')
  async checkTetheringConnection(@Body() body: { adbPath?: string }) {
    const result = this.tetheringService.checkAdbConnectionStatus(body?.adbPath)
    return result
  }
}
