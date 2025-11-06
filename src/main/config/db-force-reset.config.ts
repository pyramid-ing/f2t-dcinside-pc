import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import { compareVersions } from 'compare-versions'
import { LoggerConfig } from './logger.config'

interface IDbForceResetConfig {
  version: string
  forceReset: boolean
  lastResetVersion?: string
}

export class DbForceResetConfig {
  private static readonly CONFIG_FILE_NAME = 'db-force-reset.json'
  private static userConfigPath: string
  private static resourceConfigPath: string

  public static initialize() {
    // userData 설정 파일 경로 (사용자별 설정)
    this.userConfigPath = path.join(app.isPackaged ? app.getPath('userData') : process.cwd(), this.CONFIG_FILE_NAME)

    // resources 설정 파일 경로 (기본 설정)
    this.resourceConfigPath = app.isPackaged
      ? path.join(process.resourcesPath, this.CONFIG_FILE_NAME)
      : path.join(process.cwd(), this.CONFIG_FILE_NAME)
  }

  /**
   * 강제 초기화가 필요한지 확인합니다
   */
  public static shouldForceReset(): boolean {
    const config = this._readConfig()
    const currentVersion = this.getCurrentVersion()
    const resourceConfig = this._readResourceConfig()

    // resources 설정이 없으면 초기화하지 않음
    if (!resourceConfig) {
      LoggerConfig.info(`Resources 설정 파일 없음: 초기화하지 않음`)
      return false
    }

    // resources 설정의 version이 현재 앱 버전보다 높거나 같고, forceReset이 true인 경우만 초기화
    const resourceVersionCompare = compareVersions(resourceConfig.version, currentVersion)
    if (resourceConfig.forceReset && resourceVersionCompare >= 0) {
      // resources 설정의 version과 config의 version을 비교
      const configVersionCompare = config.version ? compareVersions(config.version, resourceConfig.version) : -1

      // config의 lastResetVersion이 resources 설정의 version보다 낮으면 초기화 필요
      const lastResetVersionCompare = config.lastResetVersion
        ? compareVersions(config.lastResetVersion, resourceConfig.version)
        : -1

      if (lastResetVersionCompare < 0) {
        LoggerConfig.info(
          `DB 강제 초기화 필요: resources 버전 ${resourceConfig.version}에서 초기화 필요 (현재 앱 버전: ${currentVersion}, 마지막 초기화 버전: ${config.lastResetVersion || '없음'})`,
        )
        return true
      }
    }

    return false
  }

  /**
   * 강제 초기화 완료를 기록합니다
   */
  public static markResetComplete(): void {
    const config = this._readConfig()
    const resourceConfig = this._readResourceConfig()

    // resources 설정의 version을 lastResetVersion으로 저장 (resources 설정이 있는 경우)
    if (resourceConfig) {
      config.lastResetVersion = resourceConfig.version
      config.version = resourceConfig.version
    } else {
      // resources 설정이 없으면 현재 앱 버전 사용
      const currentVersion = this.getCurrentVersion()
      config.lastResetVersion = currentVersion
      config.version = currentVersion
    }

    config.forceReset = false // 강제 초기화 비활성화

    this._saveConfig(config)
    LoggerConfig.info(
      `DB 강제 초기화 완료 기록: 버전 ${config.lastResetVersion} (resources 설정: ${resourceConfig?.version || '없음'})`,
    )
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
  private static _readConfig(): IDbForceResetConfig {
    const currentVersion = this.getCurrentVersion()

    try {
      let userDataConfig: IDbForceResetConfig | null = null

      // 1. userData 설정 파일 읽기
      if (fs.existsSync(this.userConfigPath)) {
        try {
          const userConfigContent = fs.readFileSync(this.userConfigPath, 'utf8')
          userDataConfig = JSON.parse(userConfigContent)
          LoggerConfig.info(`UserData 설정 파일 읽기: ${this.userConfigPath}`)
        } catch (error) {
          LoggerConfig.error('UserData 설정 파일 읽기 오류:', error)
        }
      }

      // 2. resources 설정 파일 읽기
      const resourceConfig = this._readResourceConfig()

      // 3. 설정 비교 및 업데이트
      if (userDataConfig && resourceConfig) {
        // 두 설정 파일이 모두 있는 경우
        // resources 설정의 version이 현재 앱 버전보다 높거나 같고, forceReset이 true인 경우만 고려
        const resourceVersionCompare = compareVersions(resourceConfig.version, currentVersion)

        if (resourceConfig.forceReset && resourceVersionCompare >= 0) {
          // resources 설정의 version이 현재 앱 버전보다 높거나 같고, forceReset이 true
          // 아직 이 resources 버전에서 초기화하지 않았으면 resources 설정 적용
          const lastResetVersionCompare = userDataConfig.lastResetVersion
            ? compareVersions(userDataConfig.lastResetVersion, resourceConfig.version)
            : -1

          if (lastResetVersionCompare < 0) {
            // 아직 resources 설정의 version보다 낮은 버전에서 초기화했거나, 초기화한 적이 없음
            LoggerConfig.info(
              `Resources 설정의 forceReset 감지: resources 설정으로 업데이트 (resources 버전: ${resourceConfig.version}, 현재 앱 버전: ${currentVersion})`,
            )
            this._saveConfig(resourceConfig)
            return resourceConfig
          }
        }

        // resources 설정의 version이 현재 앱 버전보다 낮거나, forceReset이 false이면 userData 설정 유지
        if (resourceVersionCompare < 0) {
          LoggerConfig.info(
            `Resources 설정 버전이 현재 앱 버전보다 낮음: userData 설정 유지 (resources: ${resourceConfig.version}, 현재: ${currentVersion})`,
          )
        }

        // userData 설정 유지
        return userDataConfig
      } else if (resourceConfig) {
        // resources만 있는 경우 (첫 실행)
        // resources 설정의 version이 현재 앱 버전보다 높거나 같고, forceReset이 true인 경우만 적용
        const resourceVersionCompare = compareVersions(resourceConfig.version, currentVersion)
        if (resourceConfig.forceReset && resourceVersionCompare >= 0) {
          LoggerConfig.info('Resources 설정을 UserData로 복사 (첫 실행)')
          this._saveConfig(resourceConfig)
          return resourceConfig
        } else {
          // resources 설정이 조건을 만족하지 않으면 기본 설정 반환
          LoggerConfig.info(
            `Resources 설정이 조건을 만족하지 않음: 기본 설정 반환 (resources 버전: ${resourceConfig.version}, 현재: ${currentVersion}, forceReset: ${resourceConfig.forceReset})`,
          )
        }
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
   * resources 설정 파일을 직접 읽습니다
   */
  private static _readResourceConfig(): IDbForceResetConfig | null {
    if (!fs.existsSync(this.resourceConfigPath)) {
      return null
    }

    const configContent = fs.readFileSync(this.resourceConfigPath, 'utf8')
    const resourceConfig = JSON.parse(configContent)
    LoggerConfig.info(`Resources 설정 파일 읽기: ${this.resourceConfigPath}`)
    return resourceConfig
  }

  /**
   * 설정 파일을 저장합니다 (userData에만 저장)
   */
  private static _saveConfig(config: IDbForceResetConfig): void {
    try {
      const configDir = path.dirname(this.userConfigPath)
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }
      fs.writeFileSync(this.userConfigPath, JSON.stringify(config, null, 2))
      LoggerConfig.info(`설정 파일 저장: ${this.userConfigPath}`)
    } catch (error) {
      LoggerConfig.error('설정 파일 저장 오류:', error)
    }
  }
}
