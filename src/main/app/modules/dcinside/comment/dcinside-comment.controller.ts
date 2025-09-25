import { Controller, Post, Get, Body, Param, Patch, ValidationPipe } from '@nestjs/common'
import { DcinsideCommentService } from 'src/main/app/modules/dcinside/comment/dcinside-comment.service'
import { DcinsideCommentSearchDto } from 'src/main/app/modules/dcinside/comment/dto/dcinside-comment-search.dto'
import {
  CreateCommentJobDto,
  CommentJobResponseDto,
} from 'src/main/app/modules/dcinside/comment/dto/dcinside-comment-job.dto'
import { PostSearchResponseDto } from 'src/main/app/modules/dcinside/comment/dto/dcinside-post-item.dto'

@Controller()
export class DcinsideCommentController {
  constructor(private readonly commentService: DcinsideCommentService) {}

  /**
   * 게시물 검색
   */
  @Post('search')
  async searchPosts(@Body(ValidationPipe) searchDto: DcinsideCommentSearchDto): Promise<PostSearchResponseDto> {
    return this.commentService.searchPosts(searchDto)
  }

  /**
   * 댓글 작업 생성
   */
  @Post('job')
  async createCommentJob(@Body(ValidationPipe) createDto: CreateCommentJobDto): Promise<CommentJobResponseDto> {
    return this.commentService.createCommentJob(createDto)
  }

  /**
   * 댓글 작업 목록 조회
   */
  @Get('jobs')
  async getCommentJobs(): Promise<CommentJobResponseDto[]> {
    return this.commentService.getCommentJobs()
  }

  /**
   * 댓글 작업 상태 업데이트
   */
  @Patch('job/:id/status')
  async updateJobStatus(
    @Param('id') jobId: string,
    @Body('status') status: 'RUNNING' | 'STOPPED',
  ): Promise<{ success: boolean }> {
    await this.commentService.updateCommentJobStatus(jobId, status)
    return { success: true }
  }
}
