import { Injectable } from '@nestjs/common'
import { ClsService } from 'nestjs-cls'
import { JobContextStore } from './job-context.store'

/**
 * Job Context를 관리하는 서비스
 * - jobId를 설정하고 조회하는 헬퍼 메서드 제공
 */
@Injectable()
export class JobContextService {
  constructor(private readonly cls: ClsService<JobContextStore>) {}

  /**
   * 현재 실행 중인 Job의 ID를 반환
   * @throws {Error} jobId가 설정되지 않은 경우
   */
  getJobId(): string {
    const jobId = this.cls.get('jobId')
    if (!jobId) {
      throw new Error('JobId is not set in context. Make sure to call setJobId() before using it.')
    }
    return jobId
  }

  /**
   * 현재 실행 중인 Job의 ID를 반환 (Optional)
   * @returns jobId 또는 undefined
   */
  getJobIdOrUndefined(): string | undefined {
    return this.cls.get('jobId')
  }

  /**
   * Job Context를 설정
   */
  setJobId(jobId: string): void {
    this.cls.set('jobId', jobId)
  }

  /**
   * Job 타입을 설정
   */
  setJobType(jobType: string): void {
    this.cls.set('jobType', jobType)
  }

  /**
   * Job 타입을 반환
   */
  getJobType(): string | undefined {
    return this.cls.get('jobType')
  }

  /**
   * 메타데이터 설정
   */
  setMetadata(key: string, value: any): void {
    const metadata = this.cls.get('metadata') || {}
    metadata[key] = value
    this.cls.set('metadata', metadata)
  }

  /**
   * 메타데이터 조회
   */
  getMetadata(key: string): any {
    const metadata = this.cls.get('metadata')
    return metadata?.[key]
  }

  /**
   * Job Context를 초기화하면서 콜백 함수를 실행
   * @param jobId - Job의 고유 ID
   * @param jobType - Job 타입
   * @param callback - 실행할 콜백 함수
   */
  async runWithContext<T>(jobId: string, jobType: string, callback: () => Promise<T>): Promise<T> {
    return this.cls.run(async () => {
      this.setJobId(jobId)
      this.setJobType(jobType)
      return callback()
    })
  }
}
