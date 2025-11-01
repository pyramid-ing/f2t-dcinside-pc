import { Injectable, Logger } from '@nestjs/common'

/**
 * 쿠팡 파트너스 API Rate Limiter (메모리 기반)
 *
 * - 1분당 최대 50회 요청으로 제한 (안전 마진)
 * - Token Bucket 알고리즘 사용
 * - 토큰이 없을 경우 대기 후 재시도
 */
@Injectable()
export class CoupangRateLimiterService {
  private readonly logger = new Logger(CoupangRateLimiterService.name)

  // Token Bucket 설정
  private readonly maxTokens = 50 // 최대 토큰 수 (50회/분)
  private readonly refillInterval = 60000 // 1분 (밀리초)
  private tokens = 50 // 현재 토큰 수
  private lastRefill = Date.now() // 마지막 토큰 보충 시각

  constructor() {
    // 1분마다 토큰 보충
    setInterval(() => {
      this.refillTokens()
    }, this.refillInterval)
  }

  /**
   * 토큰 보충 (1분마다 50개로 리셋)
   */
  private refillTokens(): void {
    this.tokens = this.maxTokens
    this.lastRefill = Date.now()
    this.logger.debug(`토큰 보충 완료: ${this.tokens}/${this.maxTokens}`)
  }

  /**
   * API 호출 전 토큰 획득 (대기 포함)
   * - 토큰이 있으면 즉시 소비
   * - 토큰이 없으면 다음 보충 시각까지 대기
   */
  async acquireToken(): Promise<void> {
    // 토큰이 있으면 즉시 소비
    if (this.tokens > 0) {
      this.tokens--
      this.logger.debug(`토큰 사용: 남은 토큰 ${this.tokens}/${this.maxTokens}`)
      return
    }

    // 토큰이 없으면 대기
    const waitTime = this.refillInterval - (Date.now() - this.lastRefill)
    this.logger.warn(`⏳ Rate Limit 도달 (50회/분 초과). ${Math.ceil(waitTime / 1000)}초 후 재시도합니다...`)

    // 1초 단위로 토큰 상태 체크
    await this.waitForToken(waitTime)

    // 재귀 호출 (토큰 획득 재시도)
    return this.acquireToken()
  }

  /**
   * 토큰 대기 (1초 단위로 체크)
   */
  private async waitForToken(maxWaitTime: number): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      await this.sleep(1000) // 1초 대기

      // 토큰이 보충되었는지 확인
      if (this.tokens > 0) {
        this.logger.debug('토큰 보충 감지, 대기 종료')
        return
      }

      const elapsed = Math.ceil((Date.now() - startTime) / 1000)
      const remaining = Math.ceil((maxWaitTime - (Date.now() - startTime)) / 1000)
      this.logger.debug(`대기 중... (경과: ${elapsed}초, 남은 시간: ${remaining}초)`)
    }
  }

  /**
   * Sleep 유틸리티
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 현재 토큰 상태 조회 (디버깅용)
   */
  getStatus(): { tokens: number; maxTokens: number; lastRefill: Date } {
    return {
      tokens: this.tokens,
      maxTokens: this.maxTokens,
      lastRefill: new Date(this.lastRefill),
    }
  }
}
