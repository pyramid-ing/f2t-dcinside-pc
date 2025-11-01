import { IsString, IsBoolean, IsNumber, IsOptional } from 'class-validator'

// 모니터링 설정 DTO
export class MonitoringSettingsDto {
  @IsString()
  @IsOptional()
  defaultCommentText?: string // 기본 댓글 내용

  @IsBoolean()
  @IsOptional()
  autoAnswer?: boolean // 자동 댓글 활성화 여부

  @IsNumber()
  @IsOptional()
  checkIntervalMinutes?: number // 체크 간격 (분)
}

// 모니터링 상태 응답
export class MonitoringStatusDto {
  isRunning: boolean
  totalGalleries: number
  activeGalleries: number
  totalPosts: number
  unansweredPosts: number
  lastCheckTime: Date | null
}
