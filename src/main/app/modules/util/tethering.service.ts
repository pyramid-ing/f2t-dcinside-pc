import { Injectable, Logger } from '@nestjs/common'
import { execSync } from 'child_process'
import { EnvConfig } from '@main/config/env.config'
import { sleep } from '@main/app/utils/sleep'
import { TetheringChangeType } from '@main/app/modules/settings/settings.types'

@Injectable()
export class TetheringService {
  private readonly logger = new Logger(TetheringService.name)

  // IP 변경 이력 추적
  private lastIpChangeTime: number | null = null
  private postCountSinceLastChange: number = 0

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
  async resetUsbTethering() {
    try {
      const adb = EnvConfig.adbPath

      this.logger.log('[ADB] USB 테더링 OFF')
      execSync(`${adb} shell svc data disable`)

      await sleep(3_000)

      this.logger.log('[ADB] USB 테더링 ON')
      execSync(`${adb} shell svc data enable`)
      await sleep(5_000)

      // IP 변경 시간 기록
      this.lastIpChangeTime = Date.now()
      this.postCountSinceLastChange = 0
    } catch (e: any) {
      this.logger.warn(`[ADB] 테더링 리셋 실패: ${e?.message || e}`)
    }
  }

  /**
   * IP 변경이 필요한지 확인
   */
  shouldChangeIp(changeInterval?: { type: TetheringChangeType; timeMinutes?: number; postCount?: number }): boolean {
    if (!changeInterval) {
      // 설정이 없으면 항상 변경
      return true
    }

    switch (changeInterval.type) {
      case TetheringChangeType.TIME: {
        if (!this.lastIpChangeTime) {
          // 처음 실행이면 변경
          return true
        }

        const timeMinutes = changeInterval.timeMinutes ?? 30
        const timeSinceLastChange = (Date.now() - this.lastIpChangeTime) / (1000 * 60)
        return timeSinceLastChange >= timeMinutes
      }

      case TetheringChangeType.COUNT: {
        const postCount = changeInterval.postCount ?? 5
        return this.postCountSinceLastChange >= postCount
      }

      default:
        return true
    }
  }

  /**
   * 포스팅 완료 시 호출 (포스팅 수 카운트)
   */
  onPostCompleted() {
    this.postCountSinceLastChange++
    this.logger.log(`[테더링] 포스팅 완료 - 마지막 IP 변경 후 포스팅 수: ${this.postCountSinceLastChange}`)
  }

  async checkIpChanged(prevIp: { ip: string }): Promise<{ ip: string }> {
    const attempts = 3
    const waitSeconds = 3
    for (let attempt = 1; attempt <= attempts; attempt++) {
      await this.resetUsbTethering()
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
  checkAdbConnectionStatus(): { adbFound: boolean; connected: boolean; output: string } {
    try {
      const adb = EnvConfig.adbPath

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

  /**
   * macOS에서 와이파이 인터페이스 찾기
   */
  getWifiInterface(): string {
    try {
      const command = 'networksetup -listallhardwareports'
      const output = execSync(command).toString().trim()

      // en0, en1 등의 인터페이스 중 Wi-Fi 타입 찾기
      const lines = output.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Wi-Fi') || lines[i].includes('AirPort')) {
          const interfaceMatch = lines[i + 1]?.match(/Device: (.+)/)
          if (interfaceMatch && interfaceMatch[1]) {
            return interfaceMatch[1].trim()
          }
        }
      }

      // 기본값으로 en0 반환 (많은 맥북에서 Wi-Fi 인터페이스)
      return 'en0'
    } catch (e: any) {
      this.logger.warn(`[와이파이] 인터페이스 자동 감지 실패, en0 사용: ${e?.message || e}`)
      return 'en0'
    }
  }

  /**
   * macOS에서 저장된 와이파이 목록 조회
   */
  getSavedWifiNetworks(): { networks: string[] } {
    try {
      const wifiInterface = this.getWifiInterface()
      const command = `networksetup -listpreferredwirelessnetworks ${wifiInterface}`
      const output = execSync(command).toString().trim()

      // Preferred networks on en0: 다음 줄들에서 네트워크 목록 추출
      const lines = output.split('\n')
      const networks: string[] = []

      let inNetworkList = false
      for (const line of lines) {
        if (line.includes('Preferred networks on')) {
          inNetworkList = true
          continue
        }

        if (inNetworkList && line.trim()) {
          // 탭으로 시작하는 줄에서 SSID 추출 (예: "\tNetworkName")
          const match = line.match(/^\s+(.+)/)
          if (match && match[1]) {
            const networkName = match[1].trim()
            if (networkName) {
              networks.push(networkName)
            }
          }
        }
      }

      return { networks }
    } catch (e: any) {
      this.logger.error(`[와이파이] 저장된 네트워크 목록 조회 실패: ${e?.message || e}`)
      return { networks: [] }
    }
  }

  /**
   * macOS에서 현재 연결된 와이파이 SSID 확인
   */
  getCurrentWifiSsid(): { ssid: string; success: boolean } {
    try {
      // system_profiler를 사용하여 현재 연결된 와이파이 SSID 확인
      const command = 'system_profiler SPAirPortDataType'
      const output = execSync(command).toString()

      // "Status: Connected" 다음에 "Current Network Information:" 다음 줄의 SSID 추출
      const lines = output.split('\n')
      let foundConnected = false
      let inCurrentNetwork = false

      for (const line of lines) {
        if (line.includes('Status: Connected')) {
          foundConnected = true
          continue
        }

        if (foundConnected && line.includes('Current Network Information:')) {
          inCurrentNetwork = true
          continue
        }

        if (inCurrentNetwork) {
          // SSID는 들여쓰기가 있는 줄에서 ":" 이전 부분
          const match = line.match(/^\s+([^:]+):/)
          if (match && match[1]) {
            const ssid = match[1].trim()
            if (ssid) {
              this.logger.log(`[와이파이] 현재 연결: ${ssid}`)
              return { ssid, success: true }
            }
          }

          // Current Network Information 블록이 끝나는 경우 (다음 섹션 시작)
          if (line.includes('Other Local Wi-Fi Networks:') || line.includes('awdl0:')) {
            break
          }
        }
      }

      this.logger.warn('[와이파이] SSID를 찾을 수 없습니다.')
      return { ssid: '', success: false }
    } catch (e: any) {
      this.logger.error(`[와이파이] SSID 확인 실패: ${e?.message || e}`)
      return { ssid: '', success: false }
    }
  }

  /**
   * macOS에서 와이파이 연결
   */
  async connectToWifi(ssid: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`[맥북 와이파이] 연결 시도: ${ssid}`)

      // 현재 와이파이 상태 확인
      const currentStatus = this.getCurrentWifiSsid()
      if (currentStatus.success && currentStatus.ssid === ssid) {
        this.logger.log(`[맥북 와이파이] 이미 ${ssid}에 연결되어 있습니다.`)
        return { success: true, message: '이미 해당 와이파이에 연결되어 있습니다.' }
      }

      // 와이파이 인터페이스 자동 감지
      const wifiInterface = this.getWifiInterface()
      this.logger.log(`[맥북 와이파이] 인터페이스: ${wifiInterface}`)

      // 와이파이 연결 (최대 3회 재시도)
      const connectCommand = `networksetup -setairportnetwork ${wifiInterface} "${ssid}" "${password}"`
      let connectSuccess = false

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          this.logger.log(`[맥북 와이파이] 연결 시도 ${attempt}/3`)
          execSync(connectCommand, { stdio: 'pipe', timeout: 10000 })
          this.logger.log(`[맥북 와이파이] 연결 명령 실행 완료`)
          connectSuccess = true
          break
        } catch (cmdError: any) {
          const errorMsg = cmdError.stderr?.toString() || cmdError.message || '알 수 없는 오류'
          this.logger.warn(`[맥북 와이파이] 연결 시도 ${attempt} 실패: ${errorMsg}`)

          if (attempt < 3) {
            await sleep(2_000)
          }
        }
      }

      if (!connectSuccess) {
        return { success: false, message: '와이파이 연결 시도 실패 (3회)' }
      }

      // 연결 확인을 위해 대기 (재시도 중 실제 연결 확립 시급)
      await sleep(5_000)

      // 연결 확인
      const checkStatus = this.getCurrentWifiSsid()
      if (checkStatus.success && checkStatus.ssid === ssid) {
        this.logger.log(`[맥북 와이파이] ${ssid} 연결 성공`)
        return { success: true, message: '와이파이 연결 성공' }
      } else {
        this.logger.warn(`[맥북 와이파이] ${ssid} 연결 실패 (현재: ${checkStatus.ssid})`)
        return { success: false, message: `와이파이 연결 실패. 현재: ${checkStatus.ssid || '연결 안됨'}` }
      }
    } catch (e: any) {
      this.logger.error(`[맥북 와이파이] 와이파이 연결 실패: ${e?.message || e}`)
      return { success: false, message: `와이파이 연결 실패: ${e?.message || e}` }
    }
  }
}
