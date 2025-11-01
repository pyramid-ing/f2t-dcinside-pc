// 타입 정의
import { api } from '@render/api'

export interface MonitoredGallery {
  id: string
  type: string // 'gallery' | 'search'
  actionType: string | null // 'coupas' | 'fixed_comment'
  galleryUrl: string
  galleryId: string
  galleryName: string | null
  commentText: string | null
  searchKeyword: string | null // search 타입용
  searchSort: string | null // 'latest' | 'accuracy'
  aiPromptCode: string | null // AI 프롬프트 코드명
  isActive: boolean
  loginId: string | null
  loginPassword: string | null
  nickname: string | null
  password: string | null
  lastCheckedAt: Date | null
  createdAt: Date
  updatedAt: Date
  postCount?: number
  unansweredPostCount?: number
}

export type ApprovedStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED'

export interface MonitoredPost {
  id: string
  postUrl: string
  postTitle: string
  postId: string
  headtext: string | null
  authorName: string | null
  answered: boolean
  answeredAt: Date | null
  approvedStatus: ApprovedStatus // AI 검증 상태
  aiReason: string | null // AI 판단 이유
  galleryId: string
  createdAt: Date
  updatedAt: Date
  gallery?: {
    galleryUrl: string
    galleryId: string
    galleryName: string | null
  }
}

export interface CreateMonitoredGalleryDto {
  type?: string // 'gallery' | 'search'
  actionType?: string // 'coupas' | 'fixed_comment'
  galleryUrl?: string // 검색 타입일 때는 자동 생성
  galleryId?: string
  galleryName?: string
  commentText?: string
  searchKeyword?: string // search 타입용
  searchSort?: string // 'latest' | 'accuracy'
  aiPromptCode?: string // AI 프롬프트 코드명
  loginId?: string
  loginPassword?: string
  nickname?: string
  password?: string
  isActive?: boolean
}

export interface UpdateMonitoredGalleryDto {
  type?: string // 'gallery' | 'search'
  actionType?: string // 'coupas' | 'fixed_comment'
  galleryUrl?: string
  galleryId?: string
  galleryName?: string
  commentText?: string
  searchKeyword?: string // search 타입용
  searchSort?: string // 'latest' | 'accuracy'
  aiPromptCode?: string // AI 프롬프트 코드명
  loginId?: string
  loginPassword?: string
  nickname?: string
  password?: string
  isActive?: boolean
}

export interface BulkCreateMonitoredGalleryDto {
  galleries: CreateMonitoredGalleryDto[]
}

export interface BulkUpdateGalleryStatusDto {
  ids: string[]
  isActive: boolean
}

export interface BulkAnswerMonitoredPostsDto {
  postIds: string[]
  commentText?: string
}

export interface GetMonitoredPostsDto {
  galleryId?: string
  answered?: boolean
}

export interface AnswerMonitoredPostDto {
  postId: string
  commentText?: string
}

export interface MonitoringStatus {
  isRunning: boolean
  totalGalleries: number
  activeGalleries: number
  totalPosts: number
  unansweredPosts: number
  lastCheckTime: Date | null
  crawler: {
    isRunning: boolean
  }
  autoComment: {
    isRunning: boolean
    comments: string[]
  }
}

// ==================== 갤러리 관리 ====================

/**
 * 모든 갤러리 조회
 */
export async function getAllGalleries(): Promise<MonitoredGallery[]> {
  const response = await api.get('/api/dcinside/monitoring/galleries')
  return response.data
}

/**
 * 갤러리 단일 조회
 */
export async function getGalleryById(id: string): Promise<MonitoredGallery> {
  const response = await api.get(`/api/dcinside/monitoring/galleries/${id}`)
  return response.data
}

/**
 * 갤러리 생성
 */
export async function createGallery(dto: CreateMonitoredGalleryDto): Promise<MonitoredGallery> {
  const response = await api.post('/api/dcinside/monitoring/galleries', dto)
  return response.data
}

/**
 * 갤러리 일괄 생성
 */
export async function createBulkGalleries(dto: BulkCreateMonitoredGalleryDto): Promise<MonitoredGallery[]> {
  const response = await api.post('/api/dcinside/monitoring/galleries/bulk', dto)
  return response.data
}

/**
 * 갤러리 수정
 */
export async function updateGallery(id: string, dto: UpdateMonitoredGalleryDto): Promise<MonitoredGallery> {
  const response = await api.put(`/api/dcinside/monitoring/galleries/${id}`, dto)
  return response.data
}

/**
 * 갤러리 삭제
 */
export async function deleteGallery(id: string): Promise<void> {
  await api.delete(`/api/dcinside/monitoring/galleries/${id}`)
}

/**
 * 갤러리 활성화/비활성화 토글
 */
export async function toggleGalleryActive(id: string): Promise<MonitoredGallery> {
  const response = await api.post(`/api/dcinside/monitoring/galleries/${id}/toggle`)
  return response.data
}

/**
 * 갤러리 일괄 상태 변경
 */
export async function bulkUpdateGalleryStatus(dto: BulkUpdateGalleryStatusDto): Promise<{ updatedCount: number }> {
  const response = await api.post('/api/dcinside/monitoring/galleries/bulk/status', dto)
  return response.data
}

// ==================== 포스트 관리 ====================

/**
 * 포스트 목록 조회
 */
export async function getPosts(filter?: GetMonitoredPostsDto): Promise<MonitoredPost[]> {
  const response = await api.get('/api/dcinside/monitoring/posts', { params: filter })
  return response.data
}

/**
 * 포스트 단일 조회
 */
export async function getPostById(id: string): Promise<MonitoredPost> {
  const response = await api.get(`/api/dcinside/monitoring/posts/${id}`)
  return response.data
}

/**
 * 포스트 삭제
 */
export async function deletePost(id: string): Promise<void> {
  await api.delete(`/api/dcinside/monitoring/posts/${id}`)
}

/**
 * 포스트 일괄 삭제
 */
export async function bulkDeletePosts(postIds: string[]): Promise<{ deletedCount: number }> {
  const response = await api.post('/api/dcinside/monitoring/posts/bulk/delete', { postIds })
  return response.data
}

/**
 * 포스트 벌크 답변달기
 */
export async function bulkAnswerPosts(
  dto: BulkAnswerMonitoredPostsDto,
): Promise<{ answeredCount: number; failedCount: number }> {
  const response = await api.post('/api/dcinside/monitoring/posts/bulk/answer', dto)
  return response.data
}

/**
 * 포스트에 댓글 달기
 */
export async function answerPost(dto: AnswerMonitoredPostDto): Promise<MonitoredPost> {
  const response = await api.post(`/api/dcinside/monitoring/posts/${dto.postId}/answer`, dto)
  return response.data
}

/**
 * AI 검증 재시도
 */
export async function retryAiCheck(postId: string): Promise<MonitoredPost> {
  const response = await api.post(`/api/dcinside/monitoring/posts/${postId}/retry-ai`)
  return response.data
}

// ==================== 갤러리 크롤링 ====================

/**
 * 갤러리 크롤링 (단일 또는 일괄)
 */
export async function crawlGalleries(ids: string[]): Promise<{
  successCount: number
  failedCount: number
  results: Array<{ id: string; success: boolean; newPostCount?: number; error?: string }>
}> {
  const response = await api.post('/api/dcinside/monitoring/galleries/crawl', { ids })
  return response.data
}

// ==================== 크롤링 ====================

/**
 * 크롤링 시작
 */
export async function startCrawling(): Promise<void> {
  await api.post('/api/dcinside/monitoring/crawling/start')
}

/**
 * 크롤링 중지
 */
export async function stopCrawling(): Promise<void> {
  await api.post('/api/dcinside/monitoring/crawling/stop')
}

/**
 * 크롤링 상태 조회
 */
export async function getCrawlingStatus(): Promise<{ isRunning: boolean }> {
  const response = await api.get('/api/dcinside/monitoring/crawling/status')
  return response.data
}

// ==================== 자동 댓글 ====================

/**
 * 자동 댓글 시작
 */
export async function startAutoComment(comments?: string[]): Promise<void> {
  await api.post('/api/dcinside/monitoring/auto-comment/start', { comments })
}

/**
 * 자동 댓글 중지
 */
export async function stopAutoComment(): Promise<void> {
  await api.post('/api/dcinside/monitoring/auto-comment/stop')
}

/**
 * 자동 댓글 기본 텍스트 설정
 */
export async function setDefaultCommentText(text: string): Promise<void> {
  await api.post('/api/dcinside/monitoring/auto-comment/default-text', { text })
}

/**
 * 자동 댓글 상태 조회
 */
export async function getAutoCommentStatus(): Promise<{ isRunning: boolean; comments: string[] }> {
  const response = await api.get('/api/dcinside/monitoring/auto-comment/status')
  return response.data
}

// ==================== 모니터링 상태 ====================

/**
 * 모니터링 전체 상태 조회
 */
export async function getMonitoringStatus(): Promise<MonitoringStatus> {
  const response = await api.get('/api/dcinside/monitoring/status')
  return response.data
}

// ==================== AI 프롬프트 ====================

export interface AiPromptOption {
  code: string
  name: string
  description: string
}

/**
 * 사용 가능한 AI 프롬프트 목록 조회
 */
export async function getAiPrompts(): Promise<AiPromptOption[]> {
  const response = await api.get('/api/dcinside/monitoring/ai-prompts')
  return response.data
}

// ==================== 엑셀 다운로드 ====================

/**
 * 갤러리 목록 엑셀 다운로드
 */
export async function downloadGalleriesExcel(): Promise<void> {
  const response = await api.get('/api/dcinside/monitoring/galleries/download', {
    responseType: 'blob',
  })

  // Content-Disposition 헤더에서 파일명 추출
  const contentDisposition = response.headers['content-disposition']
  let filename = '갤러리_목록.xlsx'

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/)
    if (filenameMatch) {
      filename = decodeURIComponent(filenameMatch[1])
    }
  }

  // Blob을 이용한 파일 다운로드
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

// ==================== 블랙리스트 관리 ====================

export interface BlacklistedGallery {
  id: string
  galleryUrl: string
  galleryId: string
  galleryName: string | null
  remarks: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateBlacklistedGalleryDto {
  galleryUrl: string
  galleryId?: string
  galleryName?: string
  remarks?: string
}

export interface UpdateBlacklistedGalleryDto {
  galleryUrl?: string
  galleryId?: string
  galleryName?: string
  remarks?: string
}

/**
 * 모든 블랙리스트 조회
 */
export async function getAllBlacklistedGalleries(): Promise<BlacklistedGallery[]> {
  const response = await api.get('/api/dcinside/monitoring/blacklist')
  return response.data
}

/**
 * 블랙리스트 단일 조회
 */
export async function getBlacklistedGalleryById(id: string): Promise<BlacklistedGallery> {
  const response = await api.get(`/api/dcinside/monitoring/blacklist/${id}`)
  return response.data
}

/**
 * 블랙리스트 생성
 */
export async function createBlacklistedGallery(dto: CreateBlacklistedGalleryDto): Promise<BlacklistedGallery> {
  const response = await api.post('/api/dcinside/monitoring/blacklist', dto)
  return response.data
}

/**
 * 블랙리스트 수정
 */
export async function updateBlacklistedGallery(
  id: string,
  dto: UpdateBlacklistedGalleryDto,
): Promise<BlacklistedGallery> {
  const response = await api.put(`/api/dcinside/monitoring/blacklist/${id}`, dto)
  return response.data
}

/**
 * 블랙리스트 삭제
 */
export async function deleteBlacklistedGallery(id: string): Promise<void> {
  await api.delete(`/api/dcinside/monitoring/blacklist/${id}`)
}

/**
 * 블랙리스트 일괄 삭제
 */
export async function bulkDeleteBlacklistedGalleries(ids: string[]): Promise<{ deletedCount: number }> {
  const response = await api.post('/api/dcinside/monitoring/blacklist/bulk/delete', { ids })
  return response.data
}

// ==================== 쿠파스 수동 실행 ====================

/**
 * 쿠파스 수동 실행 (게시물 URL 직접 입력)
 */
export async function executeManualCoupas(dto: {
  postUrl: string
  wordpressId: string
  loginId?: string
  loginPassword?: string
  nickname?: string
  password?: string
}): Promise<{ jobId: string; coupasJobId: string; message: string }> {
  const response = await api.post('/api/dcinside/monitoring/coupas/manual', dto)
  return response.data
}
