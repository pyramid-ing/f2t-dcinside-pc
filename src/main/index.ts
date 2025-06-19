import { BadRequestException, type ValidationError, ValidationPipe } from '@nestjs/common'
import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import * as bodyParser from 'body-parser'
import { app, ipcMain, shell } from 'electron'
import { WinstonModule } from 'nest-winston'
import { utilities as nestWinstonModuleUtilities } from 'nest-winston/dist/winston.utilities'
import winston from 'winston'
import { AppModule } from './app/app.module'
import { EnvConfig } from './config/env.config'
import { LoggerConfig } from './config/logger.config'
import { environment } from './environments/environment'
import { GlobalExceptionFilter } from './filters/global-exception.filter'

EnvConfig.initialize()
LoggerConfig.info(process.env.NODE_ENV)
LoggerConfig.info(process.env.PRISMA_QUERY_ENGINE_BINARY)
LoggerConfig.info(process.env.PRISMA_QUERY_ENGINE_LIBRARY)
LoggerConfig.info(process.env.PUPPETEER_EXECUTABLE_PATH)
LoggerConfig.info(process.env.COOKIE_DIR)

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'


class JobQueue {
  private queue: (() => Promise<void>)[] = []
  private isRunning = false

  async enqueue(job: () => Promise<void>) {
    this.queue.push(job)
    this.runQueue()
  }

  private async runQueue() {
    if (this.isRunning)
      return
    this.isRunning = true

    while (this.queue.length > 0) {
      const job = this.queue.shift()
      if (job) {
        await job() // ✨ 여기서 다음 작업을 기다림
      }
    }

    this.isRunning = false
  }
}

// 테스트용 비동기 작업
function createJob(id: number, delay: number): () => Promise<void> {
  return async () => {
    console.log(`▶ 작업 ${id} 시작`)
    await new Promise(resolve => setTimeout(resolve, delay))
    console.log(`✅ 작업 ${id} 완료`)
  }
}

// 실행 테스트
(async () => {
  const queue = new JobQueue()

  queue.enqueue(createJob(1, 60000)) // 3초 걸리는 작업
  queue.enqueue(createJob(2, 5000)) // 1초 걸리는 작업
  queue.enqueue(createJob(3, 500)) // 0.5초 걸리는 작업
})()
// IPC 핸들러 설정
function setupIpcHandlers() {
  ipcMain.handle('get-backend-port', () => null)
  ipcMain.handle('open-external', async (_, url) => {
    await shell.openExternal(url)
  })
}

async function electronAppInit() {
  const isDev = !app.isPackaged
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
      app.quit()
  })

  if (isDev) {
    if (process.platform === 'win32') {
      process.on('message', (data) => {
        if (data === 'graceful-exit')
          app.quit()
      })
    }
    else {
      process.on('SIGTERM', () => {
        app.quit()
      })
    }
  }

  await app.whenReady()
  setupIpcHandlers()
}

async function bootstrap() {
  try {
    await electronAppInit()

    const instance = winston.createLogger({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            nestWinstonModuleUtilities.format.nestLike('ITB', {
              colors: true,
              prettyPrint: true,
            }),
          ),
          level: environment.production ? 'info' : 'silly',
        }),
      ],
    })

    const app = await NestFactory.create(AppModule, {
      logger: WinstonModule.createLogger({
        instance,
      }),
    })

    app.enableCors()
    // app.enableVersioning({
    //   defaultVersion: '1',
    //   type: VersioningType.URI,
    // })
    // app.setGlobalPrefix('api', { exclude: ['sitemap.xml'] })
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        exceptionFactory: (validationErrors: ValidationError[] = []) => {
          console.error(JSON.stringify(validationErrors))
          return new BadRequestException(validationErrors)
        },
      }),
    )

    const httpAdapter = app.get(HttpAdapterHost)
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapter)) // HttpAdapterHost 주입

    // Support 10mb csv/json files for importing activities
    app.use(bodyParser.json({ limit: '10mb' }))

    await app.listen(3554)

    console.log('NestJS HTTP server is running on port 3554')
  }
  catch (error) {
    console.log(error)
    app.quit()
  }
}

bootstrap()
