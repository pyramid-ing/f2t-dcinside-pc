export interface CoupangWorkflowRequest {
  postUrl: string
  wordpressAccount: {
    id: string | number
    name: string
    url: string
    wpUsername: string
    apiKey: string
    createdAt?: Date
    updatedAt?: Date
  }
  // 댓글 작성 관련 옵션
  nickname?: string
  password?: string
  loginId?: string
  loginPassword?: string
}

export interface CoupangWorkflowResponse {
  blogLink: string
  commentText: string
}

export interface CoupangWorkflowError {
  code: string
  message: string
  details?: any
}
