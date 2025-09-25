import { Controller, Post, Get, Body, Param, Patch, ValidationPipe } from '@nestjs/common'
import { CommentService } from './comment.service'
import { CommentSearchDto } from './dto/comment-search.dto'
import { CreateCommentJobDto, CommentJobResponseDto } from './dto/comment-job.dto'
import { PostSearchResponseDto } from './dto/post-item.dto'

@Controller()
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  /**
   * 게시물 검색
   */
  @Post('search')
  async searchPosts(@Body(ValidationPipe) searchDto: CommentSearchDto): Promise<PostSearchResponseDto> {
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
