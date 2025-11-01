export interface CoupangPartnersConfig {
  accessKey: string
  secretKey: string
  baseUrl: string
}

export interface CoupangDeeplinkRequest {
  coupangUrls: string[]
  subId?: string
}

export interface CoupangDeeplinkResponse {
  rCode: string
  rMessage: string
  data: CoupangDeeplinkData[]
}

export interface CoupangDeeplinkData {
  originalUrl: string
  shortenUrl: string
  landingUrl: string
}

export interface CoupangAffiliateLink {
  originalUrl: string
  shortenUrl: string
  landingUrl: string
}

export interface CoupangPartnersError {
  code: string
  message: string
  details?: any
}
