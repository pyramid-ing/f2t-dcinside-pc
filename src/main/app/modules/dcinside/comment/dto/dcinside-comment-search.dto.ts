import { IsString, IsOptional, IsEnum } from 'class-validator'

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

  @IsOptional()
  page?: number = 1
}
