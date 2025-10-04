import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import { LoggerConfig } from './logger.config'

interface IDbForceResetConfig {
  version: string
  forceReset: boolean
  lastResetVersion?: string
}

export class DbForceResetConfig {
  private static readonly CONFIG_FILE_NAME = 'db-force-reset.json'
  private static configPath: string
  private static resourceConfigPath: string

  public static initialize() {
    // userData 설정 파일 경로 (사용자별 설정)
    this.configPath = path.join(app.isPackaged ? app.getPath('userData') : process.cwd(), this.CONFIG_FILE_NAME)

    // resources 설정 파일 경로 (기본 설정)
    this.resourceConfigPath = app.isPackaged
      ? path.join(process.resourcesPath, this.CONFIG_FILE_NAME)
      : path.join(process.cwd(), this.CONFIG_FILE_NAME)
  }

  /**
   * 현재 앱 버전을 가져옵니다
   */
  private static getCurrentVersion(): string {
    try {
      const appPath = app.isPackaged ? app.getAppPath() : process.cwd()
      const packageJsonPath = path.join(appPath, 'package.json')
      const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8')
      const packageJson = JSON.parse(packageJsonContent)
      return packageJson.version
    } catch (error) {
      LoggerConfig.error('버전 정보를 읽을 수 없습니다:', error)
      return '0.0.0'
    }
  }

  /**
   * 설정 파일을 읽고 비교하여 업데이트합니다
   */
  private static readConfig(): IDbForceResetConfig {
    const currentVersion = this.getCurrentVersion()

    try {
      let userDataConfig: IDbForceResetConfig | null = null
      let resourceConfig: IDbForceResetConfig | null = null

      // 1. userData 설정 파일 읽기
      if (fs.existsSync(this.configPath)) {
        try {
          const configContent = fs.readFileSync(this.configPath, 'utf8')
          userDataConfig = JSON.parse(configContent)
          LoggerConfig.info(`UserData 설정 파일 읽기: ${this.configPath}`)
        } catch (error) {
          LoggerConfig.error('UserData 설정 파일 읽기 오류:', error)
        }
      }

      // 2. resources 설정 파일 읽기
      if (fs.existsSync(this.resourceConfigPath)) {
        try {
          const configContent = fs.readFileSync(this.resourceConfigPath, 'utf8')
          resourceConfig = JSON.parse(configContent)
          LoggerConfig.info(`Resources 설정 파일 읽기: ${this.resourceConfigPath}`)
        } catch (error) {
          LoggerConfig.error('Resources 설정 파일 읽기 오류:', error)
        }
      }

      // 3. 설정 비교 및 업데이트
      if (userDataConfig && resourceConfig) {
        // 두 설정 파일이 모두 있는 경우
        if (resourceConfig.version !== userDataConfig.version) {
          // 버전이 다르면 resources 설정으로 업데이트
          LoggerConfig.info(`버전 변경 감지: ${userDataConfig.version} → ${resourceConfig.version}`)
          this.saveConfig(resourceConfig)
          return resourceConfig
        } else {
          // 버전이 같으면 userData 설정 유지
          return userDataConfig
        }
      } else if (resourceConfig) {
        // resources만 있는 경우 (첫 실행)
        LoggerConfig.info('Resources 설정을 UserData로 복사')
        this.saveConfig(resourceConfig)
        return resourceConfig
      } else if (userDataConfig) {
        // userData만 있는 경우
        return userDataConfig
      }
    } catch (error) {
      LoggerConfig.error('설정 파일 처리 오류:', error)
    }

    // 기본 설정 반환
    return {
      version: currentVersion,
      forceReset: false,
    }
  }

  /**
   * 설정 파일을 저장합니다 (userData에만 저장)
   */
  private static saveConfig(config: IDbForceResetConfig): void {
    try {
      const configDir = path.dirname(this.configPath)
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2))
      LoggerConfig.info(`설정 파일 저장: ${this.configPath}`)
    } catch (error) {
      LoggerConfig.error('설정 파일 저장 오류:', error)
    }
  }

  /**
   * 강제 초기화가 필요한지 확인합니다
   */
  public static shouldForceReset(): boolean {
    const config = this.readConfig()
    const currentVersion = this.getCurrentVersion()

    // 1. 강제 초기화가 활성화되어 있고, 아직 이 버전에서 초기화하지 않았으면
    if (config.forceReset && config.lastResetVersion !== currentVersion) {
      LoggerConfig.info(`DB 강제 초기화 필요: 버전 ${currentVersion} (forceReset: true)`)
      return true
    }

    // 2. lastResetVersion이 없으면 강제 초기화 (첫 실행 또는 설정 누락)
    if (!config.lastResetVersion) {
      LoggerConfig.info(`DB 강제 초기화 필요: 버전 ${currentVersion} (lastResetVersion 없음)`)
      return true
    }

    return false
  }

  /**
   * 강제 초기화 완료를 기록합니다
   */
  public static markResetComplete(): void {
    const config = this.readConfig()
    const currentVersion = this.getCurrentVersion()

    config.lastResetVersion = currentVersion
    config.forceReset = false // 강제 초기화 비활성화

    this.saveConfig(config)
    LoggerConfig.info(`DB 강제 초기화 완료 기록: 버전 ${currentVersion}`)
  }

  /**
   * 강제 초기화 설정을 업데이트합니다 (개발용)
   */
  public static updateForceResetConfig(forceReset: boolean): void {
    const config = this.readConfig()
    config.forceReset = forceReset
    config.version = this.getCurrentVersion()

    this.saveConfig(config)
    LoggerConfig.info(`DB 강제 초기화 설정 업데이트: forceReset=${forceReset}, version=${config.version}`)
  }

  /**
   * 현재 설정을 가져옵니다
   */
  public static getCurrentConfig(): IDbForceResetConfig {
    return this.readConfig()
  }
}
