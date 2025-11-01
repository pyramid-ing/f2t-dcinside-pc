import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { MonitoringService } from './monitoring.service'
import { MonitoringAiService } from './monitoring-ai.service'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { CommentJobService } from '@main/app/modules/dcinside/comment/comment-job.service'
import { CoupasJobService } from '@main/app/modules/dcinside/coupas-job/coupas-job.service'
import { JobStatus } from '@main/app/modules/dcinside/job/job.types'
import { sleep } from '@main/app/utils/sleep'

/**
 * 모니터링 작업 프로세서
 * 게시물별로 독립적인 AI 검사를 수행하고, 승인된 게시물에 대해 자동 작업을 생성합니다.
 */
@Injectable()
export class MonitoringProcessor {
  private readonly logger = new Logger(MonitoringProcessor.name)

  constructor(
    private readonly prismaService: PrismaService,
    private readonly monitoringService: MonitoringService,
    private readonly aiService: MonitoringAiService,
    private readonly settingsService: SettingsService,
    private readonly commentJobService: CommentJobService,
    @Inject(forwardRef(() => CoupasJobService))
    private readonly coupasJobService: CoupasJobService,
  ) {}

  /**
   * 10초마다 대기 중인 모니터링 게시물 처리
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processPendingPosts() {
    try {
      // PENDING 또는 FAILED 상태인 게시물 조회 (최대 5개)
      const pendingPosts = await this.prismaService.monitoredPost.findMany({
        where: {
          OR: [{ approvedStatus: 'PENDING' }, { approvedStatus: 'FAILED' }],
          answered: false, // 아직 처리되지 않은 게시물만
          gallery: {
            isActive: true, // 활성화된 갤러리의 게시물만
            actionType: 'coupas', // coupas 타입만 (AI 검사 필요)
          },
        },
        include: {
          gallery: true,
        },
        orderBy: {
          createdAt: 'asc', // 오래된 것부터 처리
        },
        take: 5,
      })

      if (pendingPosts.length === 0) {
        return
      }

      this.logger.log(`${pendingPosts.length}개의 대기 중인 게시물 처리 시작`)

      // 각 게시물 처리
      for (const post of pendingPosts) {
        try {
          await this.processPost(post)
        } catch (error) {
          this.logger.error(`게시물 처리 실패: ${post.postTitle}`, error)
        }

        // 각 게시물 처리 사이 짧은 대기 (1초)
        await sleep(1000)
      }

      this.logger.log('대기 중인 게시물 처리 완료')
    } catch (error) {
      this.logger.error('게시물 처리 중 오류:', error)
    }
  }

  /**
   * 개별 게시물 처리
   * 1. 상태를 PROCESSING으로 변경
   * 2. AI 유효성 검사
   * 3. 갤러리 마지막 체크 시간 업데이트
   * 4. (승인된 경우) 자동 작업 생성
   */
  private async processPost(post: any): Promise<void> {
    this.logger.log(`게시물 처리 시작: ${post.postTitle}`)

    // 1. 상태를 PROCESSING으로 변경 (동시 처리 방지)
    try {
      await this.monitoringService.updatePostAiCheckResult(post.id, {
        approvedStatus: 'PROCESSING',
        aiReason: 'AI 검사 진행 중...',
      })
    } catch (error) {
      this.logger.error(`게시물 상태 업데이트 실패: ${post.postTitle}`, error)
      return
    }

    try {
      // 2. AI 적합성 검사
      const postInfo = {
        postUrl: post.postUrl,
        postTitle: post.postTitle,
        postId: post.postId,
        galleryName: post.gallery?.galleryName || null,
        headtext: post.headtext,
        authorName: post.authorName,
      }

      const result = await this.aiService.checkPostSuitability(postInfo, post.gallery.aiPromptCode || undefined)

      // 3. AI 검사 결과를 DB에 업데이트
      await this.monitoringService.updatePostAiCheckResult(post.id, {
        approvedStatus: result.approved ? 'APPROVED' : 'REJECTED',
        aiReason: result.reason,
      })

      this.logger.log(`AI 검사 완료 - ${post.postTitle}: ${result.approved ? '승인' : '거부'}`)

      // 4. 갤러리 마지막 체크 시간 업데이트
      await this.monitoringService.updateGalleryLastChecked(post.gallery.id)

      // 5. 승인된 경우 자동 작업 생성
      if (result.approved) {
        if (post.gallery.actionType === 'coupas') {
          await this.createCoupasJob(post, post.gallery)
        } else if (post.gallery.actionType === 'fixed_comment') {
          await this.createFixedCommentJob(post, post.gallery)
        }
      }
    } catch (error) {
      // AI 에러 발생 시 FAILED 상태로 저장
      this.logger.error(`AI 검사 오류 (FAILED 상태로 저장): ${post.postTitle}`, error)

      await this.monitoringService.updatePostAiCheckResult(post.id, {
        approvedStatus: 'FAILED',
        aiReason: `AI 검사 실패: ${error?.message || '알 수 없는 오류'}`,
      })
    }
  }

  /**
   * 쿠파스 작업 생성 (단일 게시물)
   */
  private async createCoupasJob(post: any, gallery: any): Promise<void> {
    this.logger.log(`쿠파스 작업 생성 시작: ${post.postTitle}`)

    // 워드프레스 계정 정보 가져오기
    const settings = await this.settingsService.getSettings()
    const wordpressAccounts = settings.wordpressAccounts || []

    if (wordpressAccounts.length === 0) {
      this.logger.error('워드프레스 계정이 설정되어 있지 않습니다. 설정에서 워드프레스 계정을 추가하세요.')
      return
    }

    // 첫 번째 워드프레스 계정 사용
    const wpAccount = wordpressAccounts[0]

    // CoupasJobService를 통해 작업 생성 (중복 체크 포함)
    await this.coupasJobService.createCoupasJob({
      postUrl: post.postUrl,
      wordpressUrl: wpAccount.url,
      wordpressUsername: wpAccount.wpUsername,
      wordpressApiKey: wpAccount.apiKey,
      subject: `[쿠파스] ${post.postTitle}`,
      desc: `AI 승인된 포스트: ${post.aiReason}`,
      scheduledAt: new Date(),
      nickname: gallery.nickname,
      password: gallery.password,
      loginId: gallery.loginId,
      loginPassword: gallery.loginPassword,
    })

    // 포스트를 answered로 표시
    await this.prismaService.monitoredPost.update({
      where: { id: post.id },
      data: { answered: true },
    })

    this.logger.log(`쿠파스 작업 생성 완료: ${post.postUrl}`)
  }

  /**
   * 고정 댓글 작업 생성 (단일 게시물)
   */
  private async createFixedCommentJob(post: any, gallery: any): Promise<void> {
    this.logger.log(`고정 댓글 작업 생성 시작: ${post.postTitle}`)

    // 댓글 내용 결정
    let commentText: string

    if (gallery.commentText) {
      // 갤러리 설정 댓글 우선
      commentText = gallery.commentText
    } else {
      // 기본 댓글 텍스트
      commentText = '좋은 정보 감사합니다!'
    }

    // 댓글 작업 생성
    await this.commentJobService.createJobWithCommentJob({
      keyword: `[모니터링] ${gallery.galleryName || gallery.galleryId}`,
      comment: commentText,
      postUrls: [post.postUrl],
      postTitles: [post.postTitle],
      nickname: gallery.nickname || undefined,
      password: gallery.password || undefined,
      loginId: gallery.loginId || undefined,
      loginPassword: gallery.loginPassword || undefined,
      scheduledAt: new Date(), // 즉시 실행
      status: JobStatus.REQUEST,
    })

    // 포스트를 answered로 표시
    await this.monitoringService.markPostAsAnswered(post.id)

    this.logger.log(`고정 댓글 작업 생성 완료: ${post.postUrl}`)
  }
}
