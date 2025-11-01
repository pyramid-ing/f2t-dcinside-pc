export interface CoupangProductData {
  title: string
  price: number
  originalUrl: string
  affiliateUrl: string
  originImageUrls: string[]
  images: string[]
  reviews: {
    positive: CoupangReview[]
  }
  url?: string
}

export interface CoupangReview {
  content: string
  rating: number
  author: string
  date: string
}

export interface CoupangCrawlerOptions {
  headless?: boolean
  timeout?: number
  userAgent?: string
  processImages?: boolean
}

export interface CoupangCrawlerError {
  code: string
  message: string
  details?: any
}
