import { Global, Module } from '@nestjs/common'
import { ClsModule } from 'nestjs-cls'
import { JobContextService } from './job-context.service'

/**
 * Job Context 모듈
 * - @Global() 데코레이터를 사용하여 전역적으로 사용 가능
 * - ClsModule을 설정하고 JobContextService를 제공
 */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        // HTTP 요청에서는 자동으로 컨텍스트 생성 (필요한 경우)
        mount: false, // Electron 앱이므로 HTTP 미들웨어는 비활성화
      },
    }),
  ],
  providers: [JobContextService],
  exports: [JobContextService],
})
export class JobContextModule {}
