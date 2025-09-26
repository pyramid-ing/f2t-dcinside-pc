import { Controller, Post, Body, ValidationPipe, Get, Patch, Param } from '@nestjs/common'
import { DcinsideCommentSearchDto } from 'src/main/app/modules/dcinside/comment/dto/dcinside-comment-search.dto'
import { CreateCommentJobDto } from 'src/main/app/modules/dcinside/comment/dto/dcinside-comment-job.dto'
import { PostSearchResponseDto } from 'src/main/app/modules/dcinside/comment/dto/dcinside-post-item.dto'
import { CommentJobResponseDto } from 'src/main/app/modules/dcinside/comment/dto/dcinside-comment-job.dto'
import { DcinsideCommentAutomationService } from '@main/app/modules/dcinside/comment/dcinside-comment-automation.service'
import { CommentJobService } from '@main/app/modules/dcinside/comment/comment-job.service'

@Controller()
export class DcinsideCommentController {
  constructor(
    private readonly commentAutomationService: DcinsideCommentAutomationService,
    private readonly commentJobService: CommentJobService,
  ) {}

  /**
   * 게시물 검색
   */
  @Post('search')
  async searchPosts(@Body(ValidationPipe) searchDto: DcinsideCommentSearchDto): Promise<PostSearchResponseDto> {
    return this.commentAutomationService.searchPosts(searchDto)
  }

  /**
   * 댓글 작업 생성
   */
  @Post('jobs')
  async createCommentJob(@Body(ValidationPipe) createDto: CreateCommentJobDto): Promise<CommentJobResponseDto[]> {
    const jobs = await this.commentJobService.createJobWithCommentJob(createDto)
    return this.commentJobService.getCommentJobs()
  }

  /**
   * 댓글 작업 목록 조회
   */
  @Get('jobs')
  async getCommentJobs(): Promise<CommentJobResponseDto[]> {
    return this.commentJobService.getCommentJobs()
  }

  /**
   * 댓글 작업 상태 업데이트
   */
  @Patch('jobs/:id/status')
  async updateCommentJobStatus(
    @Param('id') jobId: string,
    @Body() body: { status: 'RUNNING' | 'STOPPED' },
  ): Promise<void> {
    return this.commentJobService.updateCommentJobStatus(jobId, body.status)
  }
}
