import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { CommentQueueService } from './comment-queue.service'
import { CommentSearchDto, SortType } from './dto/comment-search.dto'
import { CreateCommentJobDto, CommentJobResponseDto } from './dto/comment-job.dto'
import { PostItemDto, PostSearchResponseDto } from './dto/post-item.dto'
import * as cheerio from 'cheerio'
import axios from 'axios'

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name)

  constructor(
    private prisma: PrismaService,
    private commentQueueService: CommentQueueService,
  ) {}

  /**
   * 디시인사이드 게시물 검색
   */
  async searchPosts(searchDto: CommentSearchDto): Promise<PostSearchResponseDto> {
    try {
      const { keyword, sortType = SortType.NEW, page = 1 } = searchDto

      // URL 구성
      let searchUrl: string
      if (sortType === SortType.NEW) {
        searchUrl = `https://search.dcinside.com/post/q/${encodeURIComponent(keyword)}`
      } else {
        searchUrl = `https://search.dcinside.com/post/sort/accuracy/q/${encodeURIComponent(keyword)}`
      }

      if (page > 1) {
        searchUrl += `/p/${page}`
        if (sortType === SortType.ACCURACY) {
          searchUrl += '/sort/accuracy'
        }
      }

      this.logger.log(`Searching posts: ${searchUrl}`)

      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 10000,
      })

      const $ = cheerio.load(response.data)
      const posts: PostItemDto[] = []

      // 게시물 목록 파싱
      $('.sch_result_list li').each((index, element) => {
        const $item = $(element)
        const $link = $item.find('a.tit_txt')
        const $sub = $item.find('.sub_txt')
        const $date = $item.find('.date_time')

        if ($link.length > 0) {
          const title = $link.text().trim()
          const url = $link.attr('href')
          const board = $sub.text().trim()
          const date = $date.text().trim()

          if (url && title) {
            posts.push({
              id: `${Date.now()}_${index}`,
              title,
              url: url.startsWith('http') ? url : `https://gall.dcinside.com${url}`,
              board,
              date,
            })
          }
        }
      })

      // 다음 페이지 존재 여부 확인
      const hasNextPage =
        $('.paging a').filter(function () {
          return $(this).text().trim() === '다음'
        }).length > 0

      this.logger.log(`Found ${posts.length} posts for keyword: ${keyword}`)

      return {
        posts,
        totalCount: posts.length,
        currentPage: page,
        hasNextPage,
      }
    } catch (error) {
      this.logger.error(`Failed to search posts: ${error.message}`, error.stack)
      throw new Error('게시물 검색에 실패했습니다.')
    }
  }

  /**
   * 댓글 작업 생성
   */
  async createCommentJob(createDto: CreateCommentJobDto): Promise<CommentJobResponseDto> {
    try {
      // Job 생성
      const job = await this.prisma.job.create({
        data: {
          type: 'COMMENT',
          subject: `댓글 작업 - ${createDto.keyword}`,
          desc: `키워드: ${createDto.keyword}, 게시물 수: ${createDto.postUrls.length}`,
          status: 'pending',
          priority: 1,
          scheduledAt: new Date(),
        },
      })

      // CommentJob 생성
      const commentJob = await this.prisma.commentJob.create({
        data: {
          keyword: createDto.keyword,
          comment: createDto.comment,
          postUrls: JSON.stringify(createDto.postUrls),
          nickname: createDto.nickname ?? null,
          password: createDto.password ?? null,
          galleryUrl: createDto.galleryUrl ?? null,
          loginId: createDto.loginId ?? null,
          loginPassword: createDto.loginPassword ?? null,
          taskDelay: createDto.taskDelay ?? 3,
          jobId: job.id,
        },
      })

      this.logger.log(`Created comment job: ${commentJob.id}`)

      // 작업을 큐에 추가 (비동기로 처리하여 응답 속도 향상)
      this.commentQueueService.queueCommentJob(job.id).catch(error => {
        this.logger.error(`Failed to queue comment job: ${error.message}`)
      })

      return {
        id: commentJob.id,
        keyword: commentJob.keyword,
        comment: commentJob.comment,
        postUrls: JSON.parse(commentJob.postUrls),
        nickname: commentJob.nickname,
        password: commentJob.password,
        isRunning: job.status === 'pending', // 초기에는 pending 상태
        createdAt: commentJob.createdAt,
        taskDelay: commentJob.taskDelay,
        galleryUrl: commentJob.galleryUrl,
        loginId: commentJob.loginId,
        loginPassword: commentJob.loginPassword,
      }
    } catch (error) {
      this.logger.error(`Failed to create comment job: ${error.message}`, error.stack)
      throw new Error('댓글 작업 생성에 실패했습니다.')
    }
  }

  /**
   * 댓글 작업 목록 조회
   */
  async getCommentJobs(): Promise<CommentJobResponseDto[]> {
    try {
      const commentJobs = await this.prisma.commentJob.findMany({
        include: {
          job: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return commentJobs.map(commentJob => ({
        id: commentJob.id,
        keyword: commentJob.keyword,
        comment: commentJob.comment,
        postUrls: JSON.parse(commentJob.postUrls),
        nickname: commentJob.nickname,
        password: commentJob.password,
        isRunning: commentJob.job.status === 'processing',
        createdAt: commentJob.createdAt,
        taskDelay: commentJob.taskDelay,
      }))
    } catch (error) {
      this.logger.error(`Failed to get comment jobs: ${error.message}`, error.stack)
      throw new Error('댓글 작업 목록 조회에 실패했습니다.')
    }
  }

  /**
   * 댓글 작업 상태 업데이트
   */
  async updateCommentJobStatus(jobId: string, status: 'RUNNING' | 'STOPPED'): Promise<void> {
    try {
      if (status === 'RUNNING') {
        // 작업 재시작
        await this.commentQueueService.restartCommentJob(jobId)
      } else {
        // 작업 중지
        await this.commentQueueService.stopCommentJob(jobId)
      }

      this.logger.log(`Updated comment job ${jobId} status to ${status}`)
    } catch (error) {
      this.logger.error(`Failed to update comment job status: ${error.message}`, error.stack)
      throw new Error('댓글 작업 상태 업데이트에 실패했습니다.')
    }
  }
}
