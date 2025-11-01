import { api } from '@render/api'

export interface CreateCoupasJobRequest {
  postUrl: string
  wordpressUrl: string
  wordpressUsername: string
  wordpressApiKey: string
  subject?: string
  desc?: string
  scheduledAt?: string
  nickname?: string
  password?: string
  loginId?: string
  loginPassword?: string
}

export interface CoupasJobResponse {
  success: boolean
  jobId: string
  coupasJobId: string
}

export const coupasApi = {
  /**
   * 쿠파스 작업 생성
   */
  async createCoupasJob(data: CreateCoupasJobRequest): Promise<CoupasJobResponse> {
    const response = await api.post('/coupas-jobs', data)
    return response.data
  },
}
