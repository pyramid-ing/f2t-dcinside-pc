import { Controller, Get, Post, Put, Delete, Body, Param, Query, ValidationPipe, UseGuards, Res } from '@nestjs/common'
import { Response } from 'express'
import { MonitoringService } from './monitoring.service'
import { MonitoringCrawlerService } from './monitoring-crawler.service'
import { MonitoringAutoCommentService } from './monitoring-auto-comment.service'
import { MonitoringAiService } from './monitoring-ai.service'
import { CoupasJobService } from '@main/app/modules/dcinside/coupas-job/coupas-job.service'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import {
  CreateMonitoredGalleryDto,
  UpdateMonitoredGalleryDto,
  MonitoredGalleryResponseDto,
  BulkCreateMonitoredGalleryDto,
  BulkUpdateGalleryStatusDto,
} from './dto/monitored-gallery.dto'
import {
  MonitoredPostResponseDto,
  GetMonitoredPostsDto,
  AnswerMonitoredPostDto,
  BulkDeleteMonitoredPostsDto,
  BulkAnswerMonitoredPostsDto,
} from './dto/monitored-post.dto'
import {
  CreateBlacklistedGalleryDto,
  UpdateBlacklistedGalleryDto,
  BlacklistedGalleryResponseDto,
  BulkDeleteBlacklistedGalleryDto,
} from './dto/blacklisted-gallery.dto'
import { MonitoringStatusDto } from './dto/monitoring-settings.dto'
import { AuthGuard, Permission, Permissions } from '@main/app/modules/auth/auth.guard'
import { getAvailablePrompts } from './ai-prompts/prompt-templates'

@Controller()
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly crawlerService: MonitoringCrawlerService,
    private readonly autoCommentService: MonitoringAutoCommentService,
    private readonly aiService: MonitoringAiService,
    private readonly coupasJobService: CoupasJobService,
    private readonly settingsService: SettingsService,
  ) {}

  // ==================== 갤러리 관리 ====================

  /**
   * 모든 갤러리 조회
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Get('galleries')
  async getAllGalleries(): Promise<MonitoredGalleryResponseDto[]> {
    return this.monitoringService.getAllGalleries()
  }

  /**
   * 갤러리 목록 엑셀 다운로드
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Get('galleries/download')
  async downloadGalleriesExcel(@Res() res: Response): Promise<void> {
    const { buffer, filename } = await this.monitoringService.downloadGalleriesExcel()

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': buffer.length.toString(),
    })

    res.send(buffer)
  }

  /**
   * 갤러리 일괄 생성 (엑셀 업로드)
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Post('galleries/bulk')
  async createBulkGalleries(
    @Body(ValidationPipe) dto: BulkCreateMonitoredGalleryDto,
  ): Promise<MonitoredGalleryResponseDto[]> {
    return this.monitoringService.createBulkGalleries(dto)
  }

  /**
   * 갤러리 일괄 상태 변경
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Post('galleries/bulk/status')
  async bulkUpdateGalleryStatus(
    @Body(ValidationPipe) dto: BulkUpdateGalleryStatusDto,
  ): Promise<{ updatedCount: number }> {
    return this.monitoringService.bulkUpdateGalleryStatus(dto)
  }

  /**
   * 갤러리 단일 조회
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Get('galleries/:id')
  async getGalleryById(@Param('id') id: string): Promise<MonitoredGalleryResponseDto> {
    return this.monitoringService.getGalleryById(id)
  }

  /**
   * 갤러리 생성
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Post('galleries')
  async createGallery(@Body(ValidationPipe) dto: CreateMonitoredGalleryDto): Promise<MonitoredGalleryResponseDto> {
    return this.monitoringService.createGallery(dto)
  }

  /**
   * 갤러리 수정
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Put('galleries/:id')
  async updateGallery(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateMonitoredGalleryDto,
  ): Promise<MonitoredGalleryResponseDto> {
    return this.monitoringService.updateGallery(id, dto)
  }

  /**
   * 갤러리 삭제
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Delete('galleries/:id')
  async deleteGallery(@Param('id') id: string): Promise<void> {
    return this.monitoringService.deleteGallery(id)
  }

  /**
   * 갤러리 활성화/비활성화 토글
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Post('galleries/:id/toggle')
  async toggleGalleryActive(@Param('id') id: string): Promise<MonitoredGalleryResponseDto> {
    return this.monitoringService.toggleGalleryActive(id)
  }

  // ==================== 포스트 관리 ====================

  /**
   * 포스트 목록 조회
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Get('posts')
  async getPosts(@Query(ValidationPipe) filter: GetMonitoredPostsDto): Promise<MonitoredPostResponseDto[]> {
    return this.monitoringService.getPosts(filter)
  }

  /**
   * 포스트 단일 조회
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Get('posts/:id')
  async getPostById(@Param('id') id: string): Promise<MonitoredPostResponseDto> {
    return this.monitoringService.getPostById(id)
  }

  /**
   * 포스트 삭제
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Delete('posts/:id')
  async deletePost(@Param('id') id: string): Promise<void> {
    return this.monitoringService.deletePost(id)
  }

  /**
   * 포스트 일괄 삭제
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Post('posts/bulk/delete')
  async bulkDeletePosts(@Body(ValidationPipe) dto: BulkDeleteMonitoredPostsDto): Promise<{ deletedCount: number }> {
    return this.monitoringService.bulkDeletePosts(dto)
  }

  /**
   * 포스트 벌크 답변달기
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Post('posts/bulk/answer')
  async bulkAnswerPosts(
    @Body(ValidationPipe) dto: BulkAnswerMonitoredPostsDto,
  ): Promise<{ answeredCount: number; failedCount: number }> {
    // 미답변 포스트들 조회
    const { posts } = await this.monitoringService.getUnansweredPostsForBulkAnswer(dto.postIds)

    let answeredCount = 0
    let failedCount = 0

    // 각 포스트에 대해 댓글 달기 시도
    for (const post of posts) {
      try {
        await this.autoCommentService.answerPost(post.id, dto.commentText)
        answeredCount++
      } catch (error) {
        failedCount++
      }
    }

    return { answeredCount, failedCount }
  }

  /**
   * 포스트에 댓글 달기
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Post('posts/:id/answer')
  async answerPost(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: AnswerMonitoredPostDto,
  ): Promise<MonitoredPostResponseDto> {
    await this.autoCommentService.answerPost(id, dto.commentText)
    return this.monitoringService.getPostById(id)
  }

  /**
   * AI 검증 재시도 (단일 포스트)
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Post('posts/:id/retry-ai')
  async retryAiCheck(@Param('id') id: string): Promise<MonitoredPostResponseDto> {
    const post = await this.monitoringService.getPostById(id)
    const gallery = await this.monitoringService.getGalleryById(post.galleryId)

    try {
      const postInfo = {
        postUrl: post.postUrl,
        postTitle: post.postTitle,
        postId: post.postId,
        galleryName: post.gallery?.galleryName || null,
        headtext: post.headtext,
        authorName: post.authorName,
      }

      const result = await this.aiService.checkPostSuitability(postInfo, gallery.aiPromptCode || undefined)

      await this.monitoringService.updatePostAiCheckResult(post.id, {
        approvedStatus: result.approved ? 'APPROVED' : 'REJECTED',
        aiReason: result.reason,
      })
    } catch (error) {
      await this.monitoringService.updatePostAiCheckResult(post.id, {
        approvedStatus: 'FAILED',
        aiReason: `AI 검사 실패: ${error?.message || '알 수 없는 오류'}`,
      })
    }

    return this.monitoringService.getPostById(id)
  }

  // ==================== 갤러리 크롤링 ====================

  /**
   * 갤러리 크롤링 (단일 또는 일괄)
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Post('galleries/crawl')
  async crawlGalleries(@Body() dto: { ids: string[] }): Promise<{
    successCount: number
    failedCount: number
    results: Array<{ id: string; success: boolean; newPostCount?: number; error?: string }>
  }> {
    return this.crawlerService.crawlGalleriesManually(dto.ids)
  }

  // ==================== 쿠파스 수동 실행 ====================

  /**
   * 쿠파스 수동 실행 (게시물 URL 직접 입력)
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.USE_COUPANG_PARTNERS)
  @Post('coupas/manual')
  async executeManualCoupas(
    @Body()
    dto: {
      postUrl: string
      wordpressId: string
      loginId?: string
      loginPassword?: string
      nickname?: string
      password?: string
    },
  ): Promise<{ jobId: string; coupasJobId: string; message: string }> {
    // settings에서 워드프레스 계정 정보 가져오기
    const settings = await this.settingsService.getSettings()

    const wordpressAccount = settings.wordpressAccounts?.find(account => account.id === dto.wordpressId)
    if (!wordpressAccount) {
      throw new Error(`워드프레스 계정을 찾을 수 없습니다: ${dto.wordpressId}`)
    }

    // 쿠파스 작업 생성
    const result = await this.coupasJobService.createCoupasJob({
      postUrl: dto.postUrl,
      wordpressUrl: wordpressAccount.url,
      wordpressUsername: wordpressAccount.wpUsername,
      wordpressApiKey: wordpressAccount.apiKey,
      loginId: dto.loginId,
      loginPassword: dto.loginPassword,
      nickname: dto.nickname,
      password: dto.password,
    })

    return {
      jobId: result.jobId,
      coupasJobId: result.coupasJobId,
      message:
        result.message || (result.isExisting ? '동일한 작업이 이미 존재합니다.' : '쿠파스 작업이 생성되었습니다.'),
    }
  }

  // ==================== 크롤링 ====================

  /**
   * 크롤링 시작
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Post('crawling/start')
  async startCrawling(): Promise<void> {
    await this.crawlerService.startCrawling()
  }

  /**
   * 크롤링 중지
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Post('crawling/stop')
  async stopCrawling(): Promise<void> {
    this.crawlerService.stopCrawling()
  }

  /**
   * 크롤링 상태 조회
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Get('crawling/status')
  async getCrawlingStatus(): Promise<{ isRunning: boolean }> {
    return this.crawlerService.getStatus()
  }

  // ==================== 자동 댓글 ====================

  /**
   * 자동 댓글 시작
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Post('auto-comment/start')
  async startAutoComment(@Body() body: { comments?: string[] }): Promise<void> {
    await this.autoCommentService.startAutoComment(body.comments)
  }

  /**
   * 자동 댓글 중지
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Post('auto-comment/stop')
  async stopAutoComment(): Promise<void> {
    this.autoCommentService.stopAutoComment()
  }

  /**
   * 자동 댓글 상태 조회
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Get('auto-comment/status')
  async getAutoCommentStatus(): Promise<{ isRunning: boolean; comments: string[] }> {
    return await this.autoCommentService.getStatus()
  }

  // ==================== 모니터링 상태 ====================

  /**
   * 모니터링 전체 상태 조회
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Get('status')
  async getMonitoringStatus(): Promise<MonitoringStatusDto & { crawler: any; autoComment: any }> {
    const status = await this.monitoringService.getMonitoringStatus()
    const crawlerStatus = this.crawlerService.getStatus()
    const autoCommentStatus = await this.autoCommentService.getStatus()

    return {
      ...status,
      isRunning: crawlerStatus.isRunning || autoCommentStatus.isRunning,
      crawler: crawlerStatus,
      autoComment: autoCommentStatus,
    }
  }

  // ==================== AI 프롬프트 ====================

  /**
   * 사용 가능한 AI 프롬프트 목록 조회
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Get('ai-prompts')
  async getAiPrompts(): Promise<Array<{ code: string; name: string; description: string }>> {
    return getAvailablePrompts()
  }

  // ==================== 블랙리스트 관리 ====================

  /**
   * 모든 블랙리스트 조회
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Get('blacklist')
  async getAllBlacklistedGalleries(): Promise<BlacklistedGalleryResponseDto[]> {
    return this.monitoringService.getAllBlacklistedGalleries()
  }

  /**
   * 블랙리스트 단일 조회
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Get('blacklist/:id')
  async getBlacklistedGalleryById(@Param('id') id: string): Promise<BlacklistedGalleryResponseDto> {
    return this.monitoringService.getBlacklistedGalleryById(id)
  }

  /**
   * 블랙리스트 생성
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Post('blacklist')
  async createBlacklistedGallery(
    @Body(ValidationPipe) dto: CreateBlacklistedGalleryDto,
  ): Promise<BlacklistedGalleryResponseDto> {
    return this.monitoringService.createBlacklistedGallery(dto)
  }

  /**
   * 블랙리스트 수정
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Put('blacklist/:id')
  async updateBlacklistedGallery(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateBlacklistedGalleryDto,
  ): Promise<BlacklistedGalleryResponseDto> {
    return this.monitoringService.updateBlacklistedGallery(id, dto)
  }

  /**
   * 블랙리스트 삭제
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Delete('blacklist/:id')
  async deleteBlacklistedGallery(@Param('id') id: string): Promise<void> {
    return this.monitoringService.deleteBlacklistedGallery(id)
  }

  /**
   * 블랙리스트 일괄 삭제
   */
  @UseGuards(AuthGuard)
  @Permissions(Permission.COMMENT)
  @Post('blacklist/bulk/delete')
  async bulkDeleteBlacklistedGalleries(
    @Body(ValidationPipe) dto: BulkDeleteBlacklistedGalleryDto,
  ): Promise<{ deletedCount: number }> {
    return this.monitoringService.bulkDeleteBlacklistedGalleries(dto)
  }
}
