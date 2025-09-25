export class PostItemDto {
  id: string
  title: string
  url: string
  board: string
  date: string
}

export class PostSearchResponseDto {
  posts: PostItemDto[]
  totalCount: number
  currentPage: number
  hasNextPage: boolean
}
