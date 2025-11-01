export interface CoupasJobResponseDto {
  id: string
  jobId: string
  postUrl: string
  wordpressUrl: string
  wordpressUsername: string
  resultBlogLink?: string
  resultComment?: string
  createdAt: Date
  updatedAt: Date
}
