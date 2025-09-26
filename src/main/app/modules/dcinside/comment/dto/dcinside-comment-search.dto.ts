import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator'

export enum SortType {
  NEW = 'new',
  ACCURACY = 'accuracy',
}

export class DcinsideCommentSearchDto {
  @IsString()
  keyword: string

  @IsOptional()
  @IsEnum(SortType)
  sortType?: SortType = SortType.NEW

  // 최대 수집 개수 (지정 시 백엔드에서 페이지를 순회하며 누적 수집)
  @IsOptional()
  @IsInt()
  @Min(1)
  maxCount?: number
}
