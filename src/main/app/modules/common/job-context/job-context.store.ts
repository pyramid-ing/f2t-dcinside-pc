import { ClsStore } from 'nestjs-cls'

/**
 * Job 실행 컨텍스트를 저장하는 Store
 * - jobId를 암묵적으로 전달하기 위해 사용
 * - AsyncLocalStorage 기반으로 동작
 */
export interface JobContextStore extends ClsStore {
  /**
   * 현재 실행 중인 Job의 고유 ID
   */
  jobId?: string

  /**
   * Job 타입 (comment, post, coupas 등)
   */
  jobType?: string

  /**
   * 추가 메타데이터
   */
  metadata?: Record<string, any>
}
