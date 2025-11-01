export interface DcinsidePostData {
  title: string
  content: string
  imageUrls: string[]
  localImagePaths: string[]
  galleryName: string
  originalUrl: string
}

export interface DcinsidePostingCrawlerOptions {
  headless?: boolean
  timeout?: number
  downloadImages?: boolean
  imageDirectory?: string
}

export interface DcinsidePostingCrawlerError {
  code: string
  message: string
  details?: any
}
