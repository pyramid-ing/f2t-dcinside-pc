import { utilities as nestWinstonModuleUtilities } from 'nest-winston'
import * as winston from 'winston'
import { EnvConfig } from './env.config'
import * as path from 'path'

export const winstonConfig = {
  transports: [
    // 콘솔 출력 (개발환경에서는 상세, 프로덕션에서는 에러만)
    new winston.transports.Console({
      level: EnvConfig.isPackaged ? 'error' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        nestWinstonModuleUtilities.format.nestLike('F2T-dc', {
          prettyPrint: true,
          colors: true,
        }),
      ),
    }),

    // 파일 출력 (개발환경과 프로덕션 모두에서 활성화)
    new winston.transports.File({
      filename: path.join(EnvConfig.userDataPath, 'logs', 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),

    // 모든 로그 파일 (디버깅용)
    new winston.transports.File({
      filename: path.join(EnvConfig.userDataPath, 'logs', 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 3,
      tailable: true,
    }),
  ],

  // 로그 레벨 설정
  level: EnvConfig.isPackaged ? 'error' : 'debug',

  // 예외 처리 (개발환경과 프로덕션 모두에서 활성화)
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(EnvConfig.userDataPath, 'logs', 'exceptions.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
    }),
  ],

  // Promise 거부 처리 (개발환경과 프로덕션 모두에서 활성화)
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(EnvConfig.userDataPath, 'logs', 'rejections.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
    }),
  ],
}
