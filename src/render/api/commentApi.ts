import { api as apiClient } from './apiClient'

export interface PostItem {
  id: string
  title: string
  url: string
  board: string
  date: string
}

export interface PostSearchResponse {
  posts: PostItem[]
  totalCount: number
  currentPage: number
  hasNextPage: boolean
}

export interface CommentJob {
  id: string
  keyword: string
  comment: string
  postUrls: string[]
  nickname: string
  password: string
  isRunning: boolean
  createdAt: string
  taskDelay: number
}

export interface CommentSearchRequest {
  keyword: string
  sortType?: 'new' | 'accuracy'
  page?: number
}

export interface CreateCommentJobRequest {
  keyword: string
  comment: string
  postUrls: string[]
  nickname?: string
  password?: string
  taskDelay?: number
}

export const commentApi = {
  /**
   * 게시물 검색
   */
  async searchPosts(request: CommentSearchRequest): Promise<PostSearchResponse> {
    const response = await apiClient.post('/dcinside/comment/search', request)
    return response.data
  },

  /**
   * 댓글 작업 생성
   */
  async createCommentJob(request: CreateCommentJobRequest): Promise<CommentJob> {
    const response = await apiClient.post('/dcinside/comment/job', request)
    return response.data
  },

  /**
   * 댓글 작업 목록 조회
   */
  async getCommentJobs(): Promise<CommentJob[]> {
    const response = await apiClient.get('/dcinside/comment/jobs')
    return response.data
  },

  /**
   * 댓글 작업 상태 업데이트
   */
  async updateJobStatus(jobId: string, status: 'RUNNING' | 'STOPPED'): Promise<{ success: boolean }> {
    const response = await apiClient.patch(`/dcinside/comment/job/${jobId}/status`, { status })
    return response.data
  },
}
