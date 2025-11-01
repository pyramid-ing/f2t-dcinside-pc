import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { NaverQRController } from './naver-qr.controller'
import { NaverQRService } from './naver-qr.service'
import { UtilModule } from '@main/app/modules/util/util.module'

@Module({
  imports: [
    UtilModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(xlsx|xls)$/)) {
          return callback(new Error('엑셀 파일만 업로드 가능합니다.'), false)
        }
        callback(null, true)
      },
    }),
  ],
  controllers: [NaverQRController],
  providers: [NaverQRService],
  exports: [NaverQRService],
})
export class NaverQRModule {}
