export interface InstagramSearchResult {
  success: boolean
  error?: string
  keyword?: string
  type?: 'hashtag' | 'keyword'
  posts: InstagramPost[]
  users: InstagramUser[]
  tags: InstagramTag[]
}

export interface InstagramPost {
  id: string
  shortcode: string
  displayUrl: string
  caption: string
  owner: InstagramUser
  likeCount: number
  commentCount: number
  timestamp: string
}

export interface InstagramUser {
  id: string
  username: string
  profilePicUrl: string
  isPrivate: boolean
  isVerified: boolean
  followersCount?: number
  followingCount?: number
}

export interface InstagramTag {
  name: string
  mediaCount: number
}

export interface InstagramLoginResponse {
  success: boolean
  userId?: string
  error?: string
}

export interface InstagramActionResponse {
  success: boolean
  error?: string
}

export interface InstagramLoginStatus {
  isLoggedIn: boolean
  username?: string
}
