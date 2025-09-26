export class DcinsidePostItemDto {
  id: string
  title: string
  url: string
  board: string
  date: string
  summary?: string
  galleryName?: string
}

export class PostSearchResponseDto {
  posts: DcinsidePostItemDto[]
  totalCount: number
  currentPage: number
  hasNextPage: boolean
}
