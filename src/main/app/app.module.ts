import { join } from 'node:path'
import { ElectronModule } from '@doubleshot/nest-electron'
import { DcinsideModule } from '@main/app/modules/dcinside/dcinside.module'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { app, BrowserWindow } from 'electron'
import { GlobalExceptionFilter } from '../filters/global-exception.filter'
import customConfig from './config/custom-config'
import { SettingsModule } from './modules/settings/settings.module'
import { PrismaService } from './shared/prisma.service'

@Module({
  imports: [
    ElectronModule.registerAsync({
      useFactory: async () => {
        const isDev = !app.isPackaged
        const win = new BrowserWindow({
          width: 1024,
          height: 768,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            preload: join(__dirname, '../preload/index.js'),
          },
        })

        win.on('closed', () => {
          win.destroy()
        })

        const URL = isDev ? process.env.DS_RENDERER_URL : `file://${join(app.getAppPath(), 'dist/render/index.html')}`

        win.loadURL(URL)

        return { win }
      },
    }),
    ConfigModule.forRoot({
      load: [customConfig],
      isGlobal: true,
    }),
    SettingsModule,
    DcinsideModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    {
      // 의존성 주입이 가능하도록 module에도 설정해준다.
      provide: APP_FILTER,
      useFactory: (httpAdapter: HttpAdapterHost) => {
        return new GlobalExceptionFilter(httpAdapter)
      },
      inject: [HttpAdapterHost],
    },
    PrismaService,
  ],
  controllers: [],
})
export class AppModule {}
