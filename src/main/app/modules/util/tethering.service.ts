import { Injectable, Logger } from '@nestjs/common'
import { execSync } from 'child_process'
import { EnvConfig } from '@main/config/env.config'

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

  /**
   * ADB를 사용한 USB 테더링 리셋
   * - Android 기기의 모바일 데이터를 끄고 켜서 IP 변경
   */
  resetUsbTethering(adbPath?: string) {
    try {
      const adb = adbPath?.trim() || EnvConfig.adbPath
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
    options?: {
      attempts?: number
      waitSeconds?: number
      adbPath?: string
    },
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

  /**
   * ADB 연결 상태 확인
   * - adbFound: ADB 명령어 실행 가능 여부
   * - connected: Android 기기 연결 및 데이터 사용 가능 여부
   * - output: 원본 명령 출력
   */
  checkAdbConnectionStatus(adbPath?: string): { adbFound: boolean; connected: boolean; output: string } {
    try {
      const adb = adbPath?.trim() || EnvConfig.adbPath

      // ADB 명령어 실행 가능 여부 확인
      let adbFound = false
      let output = ''

      try {
        const devicesOutput = execSync(`${adb} devices`).toString()
        output = devicesOutput
        adbFound = true

        // 연결된 기기가 있는지 확인
        const lines = devicesOutput.split('\n').filter(line => line.trim())
        const deviceLines = lines.filter(line => line.includes('\tdevice'))
        const connected = deviceLines.length > 0

        return { adbFound, connected, output }
      } catch (e: any) {
        return { adbFound: false, connected: false, output: e?.message || String(e) }
      }
    } catch (e: any) {
      return { adbFound: false, connected: false, output: e?.message || String(e) }
    }
  }
}
