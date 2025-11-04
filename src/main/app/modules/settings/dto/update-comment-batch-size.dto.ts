import { IsNumber, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'

export class UpdateCommentBatchSizeDto {
  @Type(() => Number)
  @IsNumber({}, { message: '댓글 동시 처리 개수는 숫자여야 합니다.' })
  @Min(1, { message: '댓글 동시 처리 개수는 최소 1개 이상이어야 합니다.' })
  @Max(10, { message: '댓글 동시 처리 개수는 최대 10개까지 가능합니다.' })
  commentBatchSize: number
}
