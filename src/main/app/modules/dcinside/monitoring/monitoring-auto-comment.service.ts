import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common'
import { MonitoringService } from './monitoring.service'
import { CommentJobService } from '@main/app/modules/dcinside/comment/comment-job.service'
import { CoupasJobService } from '@main/app/modules/dcinside/coupas-job/coupas-job.service'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { JobStatus } from '@main/app/modules/dcinside/job/job.types'
import { CommentSelector } from '@main/app/utils/comment-selector'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'

@Injectable()
export class MonitoringAutoCommentService {
  private readonly _logger = new Logger(MonitoringAutoCommentService.name)
  private _isRunning = false
  private _processInterval: NodeJS.Timeout | null = null
  private readonly _commentSelector = new CommentSelector()

  constructor(
    private readonly _monitoringService: MonitoringService,
    private readonly _commentJobService: CommentJobService,
    @Inject(forwardRef(() => CoupasJobService))
    private readonly _coupasJobService: CoupasJobService,
    private readonly _settingsService: SettingsService,
    private readonly _prisma: PrismaService,
  ) {}

  /**
   * 자동 댓글 시작
   */
  async startAutoComment(comments?: string[]): Promise<void> {
    // 체크 간격은 고정값 5분 사용
    const fixedIntervalMinutes = 1
    if (this._isRunning) {
      this._logger.warn('자동 댓글이 이미 실행 중입니다.')
      return
    }

    this._isRunning = true
    this._logger.log('자동 댓글을 시작합니다.')

    // 댓글 목록을 설정에 저장
    if (comments) {
      const settings = await this._settingsService.getSettings()
      await this._settingsService.updateSettings({
        ...settings,
        comments,
      })
    }

    // 즉시 한 번 실행
    await this._processUnansweredPosts()

    // 주기적 실행 (고정값 5분)
    this._processInterval = setInterval(
      async () => {
        await this._processUnansweredPosts()
      },
      fixedIntervalMinutes * 60 * 1000, // 분을 밀리초로 변환
    )
  }

  /**
   * 자동 댓글 중지
   */
  stopAutoComment(): void {
    if (!this._isRunning) {
      this._logger.warn('자동 댓글이 실행 중이 아닙니다.')
      return
    }

    this._isRunning = false
    if (this._processInterval) {
      clearInterval(this._processInterval)
      this._processInterval = null
    }

    this._logger.log('자동 댓글을 중지합니다.')
  }

  /**
   * 미답변 포스트 처리
   */
  private async _processUnansweredPosts(): Promise<void> {
    try {
      this._logger.log('미답변 포스트 처리를 시작합니다.')

      // 미답변 포스트 조회
      const unansweredPosts = await this._monitoringService.getPosts({ answered: false })

      if (unansweredPosts.length === 0) {
        this._logger.log('미답변 포스트가 없습니다.')
        return
      }

      this._logger.log(`${unansweredPosts.length}개의 미답변 포스트를 발견했습니다.`)

      // 각 포스트에 댓글 달기
      for (const post of unansweredPosts) {
        try {
          await this.answerPost(post.id)
        } catch (error) {
          this._logger.error(`포스트 댓글 달기 실패: ${post.postUrl}`, error)
        }
      }

      this._logger.log('미답변 포스트 처리를 완료했습니다.')
    } catch (error) {
      this._logger.error('미답변 포스트 처리 중 오류가 발생했습니다.', error)
    }
  }

  /**
   * 특정 포스트에 댓글 달기
   */
  async answerPost(postId: string, customComment?: string): Promise<void> {
    const post = await this._monitoringService.getPostById(postId)

    if (post.answered) {
      this._logger.warn(`이미 답변한 포스트입니다: ${post.postUrl}`)
      return
    }

    // 갤러리 정보 조회
    const gallery = await this._monitoringService.getGalleryById(post.galleryId)

    // 설정에서 댓글 가져오기
    const settings = await this._settingsService.getSettings()

    // 댓글 내용 결정
    let commentText: string

    if (customComment) {
      // 1순위: 직접 지정한 댓글
      commentText = customComment
    } else if (gallery.commentText) {
      // 2순위: 갤러리 설정 댓글
      commentText = gallery.commentText
    } else {
      // 3순위: 공통 설정의 댓글 목록에서 선택
      if (settings.comments && settings.comments.length > 0) {
        const selectionMethod = settings.commentSelectionMethod || 'random'
        const selectedComment = this._commentSelector.select(settings.comments, selectionMethod)
        commentText = selectedComment || '좋은 정보 감사합니다!'
      } else {
        // 4순위: 기본 댓글 텍스트
        commentText = '좋은 정보 감사합니다!'
      }
    }

    // 접두어/접미사 템플릿 조합
    if (settings.commentPrefixes || settings.commentSuffixes) {
      commentText = this._commentSelector.combineWithTemplates(
        commentText,
        settings.commentPrefixes,
        settings.commentSuffixes,
      )
    }

    this._logger.log(`포스트에 댓글 달기: ${post.postUrl}`)
    this._logger.log(`댓글 내용: ${commentText}`)

    try {
      // 댓글 작업 생성 (Job으로 등록하여 처리)
      await this._commentJobService.createJobWithCommentJob({
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

      // answered 상태 업데이트
      await this._monitoringService.markPostAsAnswered(postId)

      this._logger.log(`포스트에 댓글 작업을 생성했습니다: ${post.postUrl}`)
    } catch (error) {
      this._logger.error(`포스트에 댓글 작업 생성 실패: ${post.postUrl}`, error)
      throw error
    }
  }

  /**
   * AI 승인된 쿠파스 포스트 처리
   */
  async processCoupasPosts(galleryId: string): Promise<void> {
    try {
      this._logger.log(`쿠파스 포스트 처리 시작: ${galleryId}`)

      // 갤러리 정보 조회
      const gallery = await this._monitoringService.getGalleryById(galleryId)

      // AI 승인된 미답변 포스트 조회
      const approvedPosts = await this._prisma.monitoredPost.findMany({
        where: {
          galleryId,
          answered: false,
          approvedStatus: 'APPROVED',
        },
      })

      if (approvedPosts.length === 0) {
        this._logger.log('처리할 AI 승인 포스트가 없습니다.')
        return
      }

      this._logger.log(`${approvedPosts.length}개의 AI 승인 포스트를 처리합니다.`)

      // 워드프레스 계정 정보 가져오기
      const settings = await this._settingsService.getSettings()
      const wordpressAccounts = settings.wordpressAccounts || []

      if (wordpressAccounts.length === 0) {
        this._logger.error('워드프레스 계정이 설정되어 있지 않습니다. 설정에서 워드프레스 계정을 추가하세요.')
        return
      }

      // 첫 번째 워드프레스 계정 사용 (향후 갤러리별로 선택 가능하도록 개선 필요)
      const wpAccount = wordpressAccounts[0]

      // 각 포스트에 대해 쿠파스 작업 생성
      for (const post of approvedPosts) {
        try {
          await this._createCoupasJob(post, gallery, wpAccount)
        } catch (error) {
          this._logger.error(`쿠파스 작업 생성 실패: ${post.postUrl}`, error)
        }
      }

      this._logger.log('쿠파스 포스트 처리 완료')
    } catch (error) {
      this._logger.error('쿠파스 포스트 처리 중 오류 발생:', error)
    }
  }

  /**
   * 쿠파스 작업 생성
   */
  private async _createCoupasJob(post: any, gallery: any, wpAccount: any): Promise<void> {
    this._logger.log(`쿠파스 작업 생성: ${post.postUrl}`)

    try {
      // CoupasJobService를 통해 작업 생성 (중복 체크 포함)
      await this._coupasJobService.createCoupasJob({
        postUrl: post.postUrl,
        wordpressUrl: wpAccount.url,
        wordpressUsername: wpAccount.wpUsername,
        wordpressApiKey: wpAccount.apiKey,
        subject: `[쿠파스] ${post.postTitle}`,
        desc: `AI 승인된 포스트: ${post.aiReason}`,
        scheduledAt: new Date(), // 즉시 실행
        nickname: gallery.nickname,
        password: gallery.password,
        loginId: gallery.loginId,
        loginPassword: gallery.loginPassword,
      })

      // 포스트를 answered로 표시
      await this._monitoringService.markPostAsAnswered(post.id)

      this._logger.log(`쿠파스 작업 생성 완료`)
    } catch (error) {
      this._logger.error(`쿠파스 작업 생성 실패: ${post.postUrl}`, error)
      throw error
    }
  }

  /**
   * 고정 댓글 포스트 처리 (기존 로직, actionType이 'fixed_comment'인 경우)
   */
  async processFixedCommentPosts(galleryId: string): Promise<void> {
    try {
      this._logger.log(`고정 댓글 포스트 처리 시작: ${galleryId}`)

      // 미답변 포스트 조회
      const unansweredPosts = await this._monitoringService.getPosts({
        galleryId,
        answered: false,
      })

      if (unansweredPosts.length === 0) {
        this._logger.log('처리할 미답변 포스트가 없습니다.')
        return
      }

      this._logger.log(`${unansweredPosts.length}개의 미답변 포스트를 처리합니다.`)

      // 각 포스트에 댓글 달기
      for (const post of unansweredPosts) {
        try {
          await this.answerPost(post.id)
        } catch (error) {
          this._logger.error(`포스트 댓글 달기 실패: ${post.postUrl}`, error)
        }
      }

      this._logger.log('고정 댓글 포스트 처리 완료')
    } catch (error) {
      this._logger.error('고정 댓글 포스트 처리 중 오류 발생:', error)
    }
  }

  /**
   * 자동 댓글 상태 조회
   */
  async getStatus(): Promise<{ isRunning: boolean; comments: string[] }> {
    const settings = await this._settingsService.getSettings()

    return {
      isRunning: this._isRunning,
      comments: settings.comments || [],
    }
  }
}
