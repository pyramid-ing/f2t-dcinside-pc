import { Injectable, Logger } from '@nestjs/common'
import { execSync } from 'child_process'

@Injectable()
export class TetheringService {
  private readonly logger = new Logger(TetheringService.name)

  getCurrentIp(): { ip: string } {
    try {
      const ip = execSync('curl -4 -s https://api.ipify.org').toString().trim()
      return { ip }
    } catch (e) {
      return { ip: '' }
    }
  }

  resetUsbTethering(adbPath?: string) {
    try {
      const adb = adbPath?.trim() || 'adb'
      this.logger.log('[ADB] USB 테더링 OFF')
      execSync(`${adb} shell svc data disable`)
      execSync('sleep 2')
      this.logger.log('[ADB] USB 테더링 ON')
      execSync(`${adb} shell svc data enable`)
      execSync('sleep 5')
    } catch (e: any) {
      this.logger.warn(`[ADB] 테더링 리셋 실패: ${e?.message || e}`)
    }
  }

  async checkIpChanged(
    prevIp: { ip: string },
    options?: { attempts?: number; waitSeconds?: number; adbPath?: string },
  ): Promise<{ ip: string }> {
    const attempts = options?.attempts ?? 3
    const waitSeconds = options?.waitSeconds ?? 3
    for (let attempt = 1; attempt <= attempts; attempt++) {
      this.resetUsbTethering(options?.adbPath)
      const newIp = this.getCurrentIp()
      this.logger.log(`[IP체크] 이전: ${prevIp.ip} / 새로고침: ${newIp.ip}`)
      if (newIp.ip && newIp.ip !== prevIp.ip) {
        this.logger.log(`[IP체크] IP 변경 성공: ${prevIp.ip} → ${newIp.ip}`)
        return newIp
      }
      if (attempt < attempts) {
        this.logger.log(`[IP체크] IP 변경 실패, ${attempt}회 재시도...`)
        await new Promise(res => setTimeout(res, waitSeconds * 1000))
      }
    }
    throw new Error(`${attempts}회 시도에도 IP가 변경되지 않았습니다.`)
  }
}
