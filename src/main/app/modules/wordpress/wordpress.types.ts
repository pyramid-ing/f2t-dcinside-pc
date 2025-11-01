export enum WordPressVisibility {
  PUBLISH = 'publish',
  PRIVATE = 'private',
}

export interface WordPressAccount {
  id: number
  name: string
  desc?: string
  url: string
  wpUsername: string
  apiKey: string
  isDefault?: boolean
  defaultVisibility?: WordPressVisibility
  createdAt: Date
  updatedAt: Date
}

// 기존 WordPressPost는 WordPressPostRequest로 이름 변경
export interface WordPressPostRequest {
  title: string
  content: string
  status: string
  categories?: number[]
  tags?: number[]
  featuredMediaId?: number
}

// WordPress API 공식 문서 기반 인터페이스

export interface WordPressTag {
  id: number
  count: number
  description: string
  link: string
  name: string
  slug: string
  taxonomy: string
  meta: Record<string, any>
}

export interface WordPressCategory {
  id: number
  count: number
  description: string
  link: string
  name: string
  slug: string
  taxonomy: string
  parent: number
  meta: Record<string, any>
}

export interface WordPressMedia {
  id: number
  date: string
  date_gmt: string
  guid: {
    rendered: string
  }
  modified: string
  modified_gmt: string
  slug: string
  status: string
  type: string
  link: string
  title: {
    rendered: string
  }
  author: number
  comment_status: string
  ping_status: string
  template: string
  meta: any[]
  description: {
    rendered: string
  }
  caption: {
    rendered: string
  }
  alt_text: string
  media_type: string
  mime_type: string
  media_details: {
    width: number
    height: number
    file: string
    sizes: Record<
      string,
      {
        file: string
        width: number
        height: number
        mime_type: string
        source_url: string
      }
    >
  }
  post: number
  source_url: string
  _links: {
    self: Array<{ href: string }>
    collection: Array<{ href: string }>
    about: Array<{ href: string }>
    author: Array<{ href: string; embeddable: boolean }>
    replies: Array<{ href: string; embeddable: boolean }>
    'wp:featuredmedia': Array<{ href: string; embeddable: boolean }>
    'wp:attachment': Array<{ href: string }>
    curies: Array<{ name: string; href: string; templated: boolean }>
  }
}

// API 요청 파라미터 인터페이스
export interface WordPressTagListParams {
  context?: 'view' | 'embed' | 'edit'
  page?: number
  per_page?: number
  search?: string
  exclude?: number[]
  include?: number[]
  offset?: number
  order?: 'asc' | 'desc'
  orderby?: 'id' | 'include' | 'name' | 'slug' | 'include_slugs' | 'term_group' | 'description' | 'count'
  hide_empty?: boolean
  post?: number
  slug?: string[]
}

export interface WordPressCategoryListParams {
  context?: 'view' | 'embed' | 'edit'
  page?: number
  per_page?: number
  search?: string
  exclude?: number[]
  include?: number[]
  offset?: number
  order?: 'asc' | 'desc'
  orderby?: 'id' | 'include' | 'name' | 'slug' | 'include_slugs' | 'term_group' | 'description' | 'count'
  hide_empty?: boolean
  parent?: number
  post?: number
  slug?: string[]
}

export interface WordPressMediaListParams {
  context?: 'view' | 'embed' | 'edit'
  page?: number
  per_page?: number
  search?: string
  exclude?: number[]
  include?: number[]
  offset?: number
  order?: 'asc' | 'desc'
  orderby?: 'date' | 'id' | 'include' | 'title' | 'slug'
  author?: number[]
  author_exclude?: number[]
  before?: string
  after?: string
  parent?: number[]
  parent_exclude?: number[]
  slug?: string
  status?: string
  media_type?: string
  mime_type?: string
}

// 태그 생성 요청 인터페이스
export interface CreateWordPressTagRequest {
  name: string
  description?: string
  slug?: string
  meta?: Record<string, any>
}

// 카테고리 생성 요청 인터페이스
export interface CreateWordPressCategoryRequest {
  name: string
  description?: string
  slug?: string
  parent?: number
  meta?: Record<string, any>
}

// 태그 업데이트 요청 인터페이스
export interface UpdateWordPressTagRequest {
  name?: string
  description?: string
  slug?: string
  meta?: Record<string, any>
}

// 카테고리 업데이트 요청 인터페이스
export interface UpdateWordPressCategoryRequest {
  name?: string
  description?: string
  slug?: string
  parent?: number
  meta?: Record<string, any>
}

// WordPress Posts API 공식 문서 기반 인터페이스

export interface WordPressPost {
  id: number
  date: string
  date_gmt: string
  guid: {
    rendered: string
  }
  modified: string
  modified_gmt: string
  slug: string
  status: string
  type: string
  link: string
  title: {
    rendered: string
  }
  content: {
    rendered: string
    protected: boolean
  }
  excerpt: {
    rendered: string
    protected: boolean
  }
  author: number
  featured_media: number
  comment_status: string
  ping_status: string
  sticky: boolean
  template: string
  format: string
  meta: Record<string, any>
  categories: number[]
  tags: number[]
  _links: {
    self: Array<{ href: string }>
    collection: Array<{ href: string }>
    about: Array<{ href: string }>
    author: Array<{ href: string; embeddable: boolean }>
    replies: Array<{ href: string; embeddable: boolean }>
    'version-history': Array<{ href: string }>
    'predecessor-version': Array<{ href: string; id: number }>
    'wp:featuredmedia': Array<{ href: string; embeddable: boolean }>
    'wp:attachment': Array<{ href: string }>
    'wp:term': Array<{ taxonomy: string; embeddable: boolean; href: string }>
    curies: Array<{ name: string; href: string; templated: boolean }>
  }
}

// 포스트 목록 조회 파라미터 인터페이스
export interface WordPressPostListParams {
  context?: 'view' | 'embed' | 'edit'
  page?: number
  per_page?: number
  search?: string
  after?: string
  modified_after?: string
  author?: number[]
  author_exclude?: number[]
  before?: string
  modified_before?: string
  exclude?: number[]
  include?: number[]
  offset?: number
  order?: 'asc' | 'desc'
  orderby?:
    | 'author'
    | 'date'
    | 'id'
    | 'include'
    | 'modified'
    | 'parent'
    | 'relevance'
    | 'slug'
    | 'include_slugs'
    | 'title'
  search_columns?: string[]
  slug?: string[]
  status?: string[]
  tax_relation?: 'AND' | 'OR'
  categories?: number[]
  categories_exclude?: number[]
  tags?: number[]
  tags_exclude?: number[]
  sticky?: boolean
}

// 포스트 생성 요청 인터페이스
export interface CreateWordPressPostRequest {
  date?: string
  date_gmt?: string
  slug?: string
  status?: 'publish' | 'future' | 'draft' | 'pending' | 'private'
  password?: string
  title?: { rendered: string }
  content?: { rendered: string }
  author?: number
  excerpt?: { rendered: string }
  featured_media?: number
  comment_status?: 'open' | 'closed'
  ping_status?: 'open' | 'closed'
  format?: 'standard' | 'aside' | 'chat' | 'gallery' | 'link' | 'image' | 'quote' | 'status' | 'video' | 'audio'
  meta?: Record<string, any>
  sticky?: boolean
  template?: string
  categories?: number[]
  tags?: number[]
}

// 포스트 업데이트 요청 인터페이스
export interface UpdateWordPressPostRequest {
  date?: string
  date_gmt?: string
  slug?: string
  status?: 'publish' | 'future' | 'draft' | 'pending' | 'private'
  password?: string
  title?: { rendered: string }
  content?: { rendered: string }
  author?: number
  excerpt?: { rendered: string }
  featured_media?: number
  comment_status?: 'open' | 'closed'
  ping_status?: 'open' | 'closed'
  format?: 'standard' | 'aside' | 'chat' | 'gallery' | 'link' | 'image' | 'quote' | 'status' | 'video' | 'audio'
  meta?: Record<string, any>
  sticky?: boolean
  template?: string
  categories?: number[]
  tags?: number[]
}
