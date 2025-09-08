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
import { sleep } from '@main/app/utils/sleep'

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
  async checkTetheringConnection() {
    const result = this.tetheringService.checkAdbConnectionStatus()
    return result
  }

  @UseGuards(AuthGuard)
  @Permissions(Permission.TETHERING)
  @Post('tethering/change-ip')
  async changeIp() {
    try {
      const prevIp = this.tetheringService.getCurrentIp()
      this.logger.log(`IP 변경 시작 - 현재 IP: ${prevIp.ip}`)

      await this.tetheringService.resetUsbTethering()

      // 잠시 대기 후 새 IP 확인
      await sleep(5_000)
      const newIp = this.tetheringService.getCurrentIp()

      this.logger.log(`IP 변경 완료 - 이전 IP: ${prevIp.ip}, 새 IP: ${newIp.ip}`)

      return {
        success: true,
        previousIp: prevIp.ip,
        newIp: newIp.ip,
        changed: prevIp.ip !== newIp.ip,
      }
    } catch (error: any) {
      this.logger.error(`IP 변경 실패: ${error?.message || error}`)
      throw error
    }
  }
}
