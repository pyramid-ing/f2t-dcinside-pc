import { join } from 'node:path'
import { ElectronModule } from '@doubleshot/nest-electron'
import { DcinsideModule } from '@main/app/modules/dcinside/dcinside.module'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import * as electron from 'electron'
import { GlobalExceptionFilter } from '../filters/global-exception.filter'
import customConfig from './config/custom-config'
import { SettingsModule } from './modules/settings/settings.module'
import { UtilModule } from '@main/app/modules/util/util.module'
import { CommonModule } from '@main/app/modules/common/common.module'
import { JobModule } from '@main/app/modules/dcinside/job/job.module'
import { AuthModule } from '@main/app/modules/auth/auth.module'

@Module({
  imports: [
    ElectronModule.registerAsync({
      useFactory: async () => {
        const isDev = !electron.app.isPackaged
        const win = new electron.BrowserWindow({
          width: 1024,
          height: 768,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            preload: join(__dirname, '../preload/index.cjs'),
          },
        })

        win.on('closed', () => {
          win.destroy()
        })

        const URL = isDev
          ? process.env.DS_RENDERER_URL
          : `file://${join(electron.app.getAppPath(), 'dist/render/index.html')}`

        win.loadURL(URL)

        return { win }
      },
    }),
    ConfigModule.forRoot({
      load: [customConfig],
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    UtilModule,
    CommonModule,
    JobModule,
    SettingsModule,
    DcinsideModule,
    AuthModule,
  ],
  providers: [
    {
      // 의존성 주입이 가능하도록 module에도 설정해준다.
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
  controllers: [],
})
export class AppModule {}
