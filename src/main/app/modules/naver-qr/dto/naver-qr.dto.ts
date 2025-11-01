export class CreateNaverQRDto {
  title: string
  url: string
}

export class NaverQRResultDto {
  title: string
  url: string
  shortUrl: string
}

export class NaverQRBatchRequestDto {
  items: CreateNaverQRDto[]
}

export class NaverQRBatchResultDto {
  results: NaverQRResultDto[]
  failedItems: { title: string; url: string; error: string }[]
}
