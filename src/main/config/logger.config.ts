// 파일 존재 여부 확인
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import electronLog from 'electron-log'

import { EnvConfig } from './env.config'

export class LoggerConfig {
  private static logger = electronLog

  public static initialize() {
    // 로그 파일 경로 설정
    this.logger.transports.file.resolvePathFn = () => {
      return path.join(
        EnvConfig.isPackaged ? app.getPath('logs') : process.cwd(),
        'logs/main.log',
      )
    }

    this.logger.transports.console.level = 'info'
    this.logger.transports.file.level = 'info'

    // 로그 포맷 설정 - 스택 트레이스 포함
    this.logger.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text} {stack}'

    // 로그 파일 크기 제한 (10MB)
    this.logger.transports.file.maxSize = 10 * 1024 * 1024

    // 로그 파일 순환 설정
    this.logger.transports.file.archiveLog = (oldFile) => {
      const timestamp = Date.now()
      return `${oldFile}.${timestamp}`
    }

    // 전역 에러 핸들링 설정
    this.setupErrorHandlers()

    // 초기화 로그
    this.logger.info('=== Application Start ===')
    this.logSystemInfo()
    this.logEnvironmentVariables()
    this.logPrismaConfig()
  }

  private static logSystemInfo() {
    this.logger.info('--- System Information ---')
    this.logger.info('App Version:', process.env.npm_package_version)
    this.logger.info('Environment:', process.env.NODE_ENV)
    this.logger.info('Platform:', process.platform)
    this.logger.info('Architecture:', process.arch)
    this.logger.info('Electron:', process.versions.electron)
    this.logger.info('Chrome:', process.versions.chrome)
    this.logger.info('Node:', process.versions.node)
    this.logger.info('Is Packaged:', EnvConfig.isPackaged)
    this.logger.info('Resource Path:', EnvConfig.resourcePath)
    this.logger.info('App Path:', app.getAppPath())
    this.logger.info('User Data Path:', app.getPath('userData'))
  }

  private static logEnvironmentVariables() {
    this.logger.info('--- Environment Variables ---')
    Object.keys(process.env).forEach((key) => {
      // 민감한 정보는 제외
      if (!key.includes('TOKEN') && !key.includes('SECRET') && !key.includes('PASSWORD')) {
        this.logger.info(`${key}:`, process.env[key])
      }
    })
  }

  private static logPrismaConfig() {
    this.logger.info('--- Prisma Configuration ---')
    this.logger.info('Database URL:', process.env.DATABASE_URL)
    this.logger.info('Query Engine Binary:', process.env.PRISMA_QUERY_ENGINE_BINARY)
    this.logger.info('Query Engine Library:', process.env.PRISMA_QUERY_ENGINE_LIBRARY)
    const enginePath = process.env.PRISMA_QUERY_ENGINE_BINARY
    const libPath = process.env.PRISMA_QUERY_ENGINE_LIBRARY

    if (enginePath) {
      this.logger.info('Engine exists:', fs.existsSync(enginePath))
    }
    if (libPath) {
      this.logger.info('Library exists:', fs.existsSync(libPath))
    }
  }

  private static setupErrorHandlers() {
    // Node.js의 처리되지 않은 예외 처리
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', error)
      this.logger.error('Stack:', error.stack)
      // 심각한 에러 발생 시 상세 정보 로깅
      this.logSystemInfo()
      this.logEnvironmentVariables()
    })

    // Node.js의 처리되지 않은 Promise 거부 처리
    process.on('unhandledRejection', (reason: any) => {
      this.logger.error('Unhandled Promise Rejection:', reason)
      if (reason instanceof Error) {
        this.logger.error('Stack:', reason.stack)
      }
    })

    // 전역 에러 이벤트 리스너
    process.on('error', (error) => {
      this.logger.error('Process Error:', error)
      this.logger.error('Stack:', error.stack)
    })

    // 프로세스 종료 전 마지막 로그
    process.on('exit', (code) => {
      this.logger.info('=== Application Exit ===')
      this.logger.info('Exit Code:', code)
      if (code !== 0) {
        this.logger.error('Abnormal Exit - Last known state:')
        this.logSystemInfo()
      }
    })

    // 프로세스 경고 처리
    process.on('warning', (warning) => {
      this.logger.warn('Process Warning:', warning)
      this.logger.warn('Stack:', warning.stack)
    })

    // Electron 앱 준비 완료
    app.on('ready', () => {
      this.logger.info('Electron App Ready')
    })

    // 윈도우 생성 시
    app.on('browser-window-created', (_, window) => {
      this.logger.info('Browser Window Created:', window.id)
    })
  }

  public static getLogger() {
    return this.logger
  }

  // 편의를 위한 직접 로깅 메서드들
  public static error(...params: any[]) {
    this.logger.error(...params)
  }

  public static warn(...params: any[]) {
    this.logger.warn(...params)
  }

  public static info(...params: any[]) {
    this.logger.info(...params)
  }

  public static debug(...params: any[]) {
    this.logger.debug(...params)
  }

  public static verbose(...params: any[]) {
    this.logger.verbose(...params)
  }
}
