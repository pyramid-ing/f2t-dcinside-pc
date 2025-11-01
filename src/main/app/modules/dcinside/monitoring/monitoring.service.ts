import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { GalleryInfoCrawlerService } from './gallery-info-crawler.service'
import * as XLSX from 'xlsx'
import {
  CreateMonitoredGalleryDto,
  UpdateMonitoredGalleryDto,
  MonitoredGalleryResponseDto,
  BulkCreateMonitoredGalleryDto,
  BulkUpdateGalleryStatusDto,
} from './dto/monitored-gallery.dto'
import {
  CreateMonitoredPostDto,
  MonitoredPostResponseDto,
  GetMonitoredPostsDto,
  BulkDeleteMonitoredPostsDto,
} from './dto/monitored-post.dto'
import { MonitoringStatusDto } from './dto/monitoring-settings.dto'
import {
  CreateBlacklistedGalleryDto,
  UpdateBlacklistedGalleryDto,
  BlacklistedGalleryResponseDto,
  BulkDeleteBlacklistedGalleryDto,
} from './dto/blacklisted-gallery.dto'
import { Prisma } from '@prisma/client'

@Injectable()
export class MonitoringService {
  private readonly _logger = new Logger(MonitoringService.name)

  constructor(
    private readonly _prisma: PrismaService,
    private readonly _galleryInfoCrawler: GalleryInfoCrawlerService,
  ) {}

  // ==================== 갤러리 관리 ====================

  /**
   * 모든 모니터링 갤러리 조회
   */
  async getAllGalleries(): Promise<MonitoredGalleryResponseDto[]> {
    const galleries = await this._prisma.monitoredGallery.findMany({
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return Promise.all(
      galleries.map(async gallery => {
        const unansweredPostCount = await this._prisma.monitoredPost.count({
          where: {
            galleryId: gallery.id,
            answered: false,
          },
        })

        return {
          id: gallery.id,
          type: gallery.type,
          actionType: gallery.actionType,
          galleryUrl: gallery.galleryUrl,
          galleryId: gallery.galleryId,
          galleryName: gallery.galleryName,
          commentText: gallery.commentText,
          searchKeyword: gallery.searchKeyword,
          searchSort: gallery.searchSort,
          aiPromptCode: gallery.aiPromptCode,
          isActive: gallery.isActive,
          loginId: gallery.loginId,
          loginPassword: gallery.loginPassword,
          nickname: gallery.nickname,
          password: gallery.password,
          lastCheckedAt: gallery.lastCheckedAt,
          createdAt: gallery.createdAt,
          updatedAt: gallery.updatedAt,
          postCount: gallery._count.posts,
          unansweredPostCount,
        }
      }),
    )
  }

  /**
   * 갤러리 단일 조회
   */
  async getGalleryById(id: string): Promise<MonitoredGalleryResponseDto> {
    const gallery = await this._prisma.monitoredGallery.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    })

    if (!gallery) {
      throw new NotFoundException(`갤러리를 찾을 수 없습니다: ${id}`)
    }

    const unansweredPostCount = await this._prisma.monitoredPost.count({
      where: {
        galleryId: gallery.id,
        answered: false,
      },
    })

    return {
      id: gallery.id,
      type: gallery.type,
      actionType: gallery.actionType,
      galleryUrl: gallery.galleryUrl,
      galleryId: gallery.galleryId,
      galleryName: gallery.galleryName,
      commentText: gallery.commentText,
      searchKeyword: gallery.searchKeyword,
      searchSort: gallery.searchSort,
      aiPromptCode: gallery.aiPromptCode,
      isActive: gallery.isActive,
      loginId: gallery.loginId,
      loginPassword: gallery.loginPassword,
      nickname: gallery.nickname,
      password: gallery.password,
      lastCheckedAt: gallery.lastCheckedAt,
      createdAt: gallery.createdAt,
      updatedAt: gallery.updatedAt,
      postCount: gallery._count.posts,
      unansweredPostCount,
    }
  }

  /**
   * 갤러리 생성
   */
  async createGallery(dto: CreateMonitoredGalleryDto): Promise<MonitoredGalleryResponseDto> {
    const type = dto.type || 'gallery'
    let galleryUrl = dto.galleryUrl
    let galleryId = dto.galleryId
    let galleryName = dto.galleryName

    // 검색 타입인 경우 자동 생성
    if (type === 'search') {
      if (!dto.searchKeyword) {
        throw new Error('검색 타입은 searchKeyword가 필요합니다.')
      }
      // 검색 타입용 galleryUrl 자동 생성
      galleryUrl = `search://${dto.searchKeyword}`
      galleryId = galleryId || `search-${dto.searchKeyword}`
      galleryName = galleryName || `검색: ${dto.searchKeyword}`
    } else {
      // 갤러리 타입인 경우
      if (!galleryUrl) {
        throw new Error('갤러리 타입은 galleryUrl이 필요합니다.')
      }

      if (!galleryId || !galleryName) {
        this._logger.log(`갤러리 정보 자동 크롤링: ${galleryUrl}`)
        try {
          const crawledInfo = await this._galleryInfoCrawler.crawlGalleryInfo(galleryUrl)
          galleryId = galleryId || crawledInfo.galleryId
          galleryName = galleryName || crawledInfo.galleryName
          this._logger.log(`크롤링 완료 - ID: ${galleryId}, 이름: ${galleryName}`)
        } catch (error) {
          this._logger.error('갤러리 정보 크롤링 실패', error)
          // 크롤링 실패 시 기본값 사용
          galleryId = galleryId || 'unknown'
          galleryName = galleryName || galleryUrl
          this._logger.warn(`기본값 사용 - ID: ${galleryId}, 이름: ${galleryName}`)
        }
      }
    }

    const gallery = await this._prisma.monitoredGallery.create({
      data: {
        type,
        actionType: dto.actionType,
        galleryUrl: galleryUrl!,
        galleryId: galleryId!,
        galleryName,
        commentText: dto.commentText,
        searchKeyword: dto.searchKeyword,
        searchSort: dto.searchSort,
        aiPromptCode: dto.aiPromptCode,
        isActive: dto.isActive ?? true,
        loginId: dto.loginId,
        loginPassword: dto.loginPassword,
        nickname: dto.nickname,
        password: dto.password,
      },
    })

    return this.getGalleryById(gallery.id)
  }

  /**
   * 갤러리 일괄 생성 (엑셀 업로드) - galleryId 기준 upsert
   */
  async createBulkGalleries(dto: BulkCreateMonitoredGalleryDto): Promise<MonitoredGalleryResponseDto[]> {
    const createdGalleries: MonitoredGalleryResponseDto[] = []

    for (const galleryDto of dto.galleries) {
      try {
        // 기존 갤러리 찾기 우선순위: galleryId > galleryUrl > searchKeyword
        let existing = null
        let identifierKey = ''

        if (galleryDto.galleryId) {
          existing = await this._prisma.monitoredGallery.findFirst({
            where: { galleryId: galleryDto.galleryId },
          })
          identifierKey = `galleryId: ${galleryDto.galleryId}`
        } else if (galleryDto.galleryUrl) {
          existing = await this._prisma.monitoredGallery.findFirst({
            where: { galleryUrl: galleryDto.galleryUrl },
          })
          identifierKey = `galleryUrl: ${galleryDto.galleryUrl}`
        } else if (galleryDto.type === 'search' && galleryDto.searchKeyword) {
          // 검색 타입이면 searchKeyword로 찾기
          existing = await this._prisma.monitoredGallery.findFirst({
            where: {
              type: 'search',
              searchKeyword: galleryDto.searchKeyword,
            },
          })
          identifierKey = `searchKeyword: ${galleryDto.searchKeyword}`
        } else {
          // 식별할 수 있는 정보가 없으면 에러
          throw new Error(
            '갤러리를 식별할 수 있는 정보가 없습니다. (galleryId, galleryUrl, searchKeyword 중 하나 필요)',
          )
        }

        if (existing) {
          // 기존 갤러리가 있으면 업데이트
          this._logger.log(`갤러리 업데이트: ${identifierKey}`)
          await this.updateGallery(existing.id, galleryDto)
          const updated = await this.getGalleryById(existing.id)
          createdGalleries.push(updated)
        } else {
          // 새 갤러리 생성
          this._logger.log(`갤러리 신규 생성: ${identifierKey}`)
          const created = await this.createGallery(galleryDto)
          createdGalleries.push(created)
        }
      } catch (error) {
        this._logger.error(
          `갤러리 처리 실패: ${galleryDto.galleryId || galleryDto.galleryUrl || galleryDto.searchKeyword}`,
          error,
        )
      }
    }

    this._logger.log(`엑셀 업로드 완료: 총 ${dto.galleries.length}개 중 ${createdGalleries.length}개 처리 성공`)
    return createdGalleries
  }

  /**
   * 갤러리 수정
   */
  async updateGallery(id: string, dto: UpdateMonitoredGalleryDto): Promise<MonitoredGalleryResponseDto> {
    const gallery = await this._prisma.monitoredGallery.findUnique({ where: { id } })
    if (!gallery) {
      throw new NotFoundException(`갤러리를 찾을 수 없습니다: ${id}`)
    }

    // URL이 변경된 경우 갤러리 정보 자동 크롤링
    let updateData = { ...dto }
    if (dto.galleryUrl && dto.galleryUrl !== gallery.galleryUrl) {
      this._logger.log(`갤러리 URL 변경 감지, 정보 재크롤링: ${dto.galleryUrl}`)
      try {
        const crawledInfo = await this._galleryInfoCrawler.crawlGalleryInfo(dto.galleryUrl)
        updateData.galleryId = crawledInfo.galleryId
        updateData.galleryName = crawledInfo.galleryName
        this._logger.log(`갤러리 정보 업데이트 완료 - ID: ${crawledInfo.galleryId}, 이름: ${crawledInfo.galleryName}`)
      } catch (error) {
        this._logger.error('갤러리 정보 크롤링 실패', error)
        // 크롤링 실패 시에도 URL은 업데이트하되, ID와 이름은 기존 값 유지
        updateData.galleryId = gallery.galleryId
        updateData.galleryName = gallery.galleryName
      }
    }

    await this._prisma.monitoredGallery.update({
      where: { id },
      data: updateData,
    })

    return this.getGalleryById(id)
  }

  /**
   * 갤러리 삭제
   */
  async deleteGallery(id: string): Promise<void> {
    const gallery = await this._prisma.monitoredGallery.findUnique({ where: { id } })
    if (!gallery) {
      throw new NotFoundException(`갤러리를 찾을 수 없습니다: ${id}`)
    }

    await this._prisma.monitoredGallery.delete({ where: { id } })
  }

  /**
   * 갤러리 일괄 상태 변경
   */
  async bulkUpdateGalleryStatus(dto: BulkUpdateGalleryStatusDto): Promise<{ updatedCount: number }> {
    const result = await this._prisma.monitoredGallery.updateMany({
      where: {
        id: {
          in: dto.ids,
        },
      },
      data: {
        isActive: dto.isActive,
      },
    })

    this._logger.log(`갤러리 일괄 상태 변경 완료: ${dto.ids.length}개 중 ${result.count}개 업데이트`)
    return { updatedCount: result.count }
  }

  /**
   * 갤러리 활성화/비활성화
   */
  async toggleGalleryActive(id: string): Promise<MonitoredGalleryResponseDto> {
    const gallery = await this._prisma.monitoredGallery.findUnique({ where: { id } })
    if (!gallery) {
      throw new NotFoundException(`갤러리를 찾을 수 없습니다: ${id}`)
    }

    await this._prisma.monitoredGallery.update({
      where: { id },
      data: { isActive: !gallery.isActive },
    })

    return this.getGalleryById(id)
  }

  // ==================== 포스트 관리 ====================

  /**
   * 포스트 목록 조회
   */
  async getPosts(filter?: GetMonitoredPostsDto): Promise<MonitoredPostResponseDto[]> {
    const where: Prisma.MonitoredPostWhereInput = {}

    if (filter?.galleryId) {
      where.galleryId = filter.galleryId
    }

    if (filter?.answered !== undefined) {
      where.answered = filter.answered
    }

    const posts = await this._prisma.monitoredPost.findMany({
      where,
      include: {
        gallery: {
          select: {
            galleryUrl: true,
            galleryId: true,
            galleryName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return posts
  }

  /**
   * 포스트 단일 조회
   */
  async getPostById(id: string): Promise<MonitoredPostResponseDto> {
    const post = await this._prisma.monitoredPost.findUnique({
      where: { id },
      include: {
        gallery: {
          select: {
            galleryUrl: true,
            galleryId: true,
            galleryName: true,
          },
        },
      },
    })

    if (!post) {
      throw new NotFoundException(`포스트를 찾을 수 없습니다: ${id}`)
    }

    return post
  }

  /**
   * 포스트 생성 (크롤링 시 사용)
   */
  async createPost(dto: CreateMonitoredPostDto): Promise<MonitoredPostResponseDto> {
    // 중복 체크
    const existing = await this._prisma.monitoredPost.findUnique({
      where: { postUrl: dto.postUrl },
    })

    if (existing) {
      return this.getPostById(existing.id)
    }

    const post = await this._prisma.monitoredPost.create({
      data: {
        postUrl: dto.postUrl,
        postTitle: dto.postTitle,
        postId: dto.postId,
        headtext: dto.headtext,
        authorName: dto.authorName,
        galleryId: dto.galleryId,
      },
      include: {
        gallery: {
          select: {
            galleryUrl: true,
            galleryId: true,
            galleryName: true,
          },
        },
      },
    })

    return post
  }

  /**
   * 포스트를 answered로 표시
   */
  async markPostAsAnswered(postId: string): Promise<MonitoredPostResponseDto> {
    const post = await this._prisma.monitoredPost.findUnique({ where: { id: postId } })
    if (!post) {
      throw new NotFoundException(`포스트를 찾을 수 없습니다: ${postId}`)
    }

    await this._prisma.monitoredPost.update({
      where: { id: postId },
      data: {
        answered: true,
        answeredAt: new Date(),
      },
    })

    return this.getPostById(postId)
  }

  /**
   * 포스트 AI 검사 결과 업데이트
   */
  async updatePostAiCheckResult(
    postId: string,
    result: {
      approvedStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED' | 'PROCESSING'
      aiReason: string
    },
  ): Promise<void> {
    await this._prisma.monitoredPost.update({
      where: { id: postId },
      data: result,
    })
  }

  /**
   * 포스트 삭제
   */
  async deletePost(id: string): Promise<void> {
    const post = await this._prisma.monitoredPost.findUnique({ where: { id } })
    if (!post) {
      throw new NotFoundException(`포스트를 찾을 수 없습니다: ${id}`)
    }

    await this._prisma.monitoredPost.delete({ where: { id } })
  }

  /**
   * 포스트 일괄 삭제
   */
  async bulkDeletePosts(dto: BulkDeleteMonitoredPostsDto): Promise<{ deletedCount: number }> {
    const result = await this._prisma.monitoredPost.deleteMany({
      where: {
        id: {
          in: dto.postIds,
        },
      },
    })

    return { deletedCount: result.count }
  }

  /**
   * 포스트 벌크 답변달기 - 포스트 ID 목록만 반환 (실제 댓글 달기는 컨트롤러에서 처리)
   */
  async getUnansweredPostsForBulkAnswer(postIds: string[]): Promise<{ posts: any[]; answeredCount: number }> {
    // 선택된 포스트들 중 아직 답변하지 않은 포스트만 조회
    const posts = await this._prisma.monitoredPost.findMany({
      where: {
        id: { in: postIds },
        answered: false, // 아직 답변하지 않은 포스트만
      },
      include: {
        gallery: {
          select: {
            galleryUrl: true,
            galleryId: true,
            galleryName: true,
            commentText: true,
            loginId: true,
            loginPassword: true,
            nickname: true,
            password: true,
          },
        },
      },
    })

    return { posts, answeredCount: 0 }
  }

  /**
   * 갤러리의 마지막 체크 시간 업데이트
   */
  async updateGalleryLastChecked(galleryId: string): Promise<void> {
    await this._prisma.monitoredGallery.update({
      where: { id: galleryId },
      data: { lastCheckedAt: new Date() },
    })
  }

  // ==================== 모니터링 상태 ====================

  /**
   * 모니터링 상태 조회
   */
  async getMonitoringStatus(): Promise<MonitoringStatusDto> {
    const totalGalleries = await this._prisma.monitoredGallery.count()
    const activeGalleries = await this._prisma.monitoredGallery.count({
      where: { isActive: true },
    })
    const totalPosts = await this._prisma.monitoredPost.count()
    const unansweredPosts = await this._prisma.monitoredPost.count({
      where: { answered: false },
    })

    const lastChecked = await this._prisma.monitoredGallery.findFirst({
      where: { lastCheckedAt: { not: null } },
      orderBy: { lastCheckedAt: 'desc' },
      select: { lastCheckedAt: true },
    })

    return {
      isRunning: false, // TODO: 크롤러 상태와 연동
      totalGalleries,
      activeGalleries,
      totalPosts,
      unansweredPosts,
      lastCheckTime: lastChecked?.lastCheckedAt || null,
    }
  }

  // ==================== 엑셀 다운로드 ====================

  /**
   * 갤러리 목록을 엑셀 파일로 다운로드
   */
  async downloadGalleriesExcel(): Promise<{ buffer: Buffer; filename: string }> {
    this._logger.log('갤러리 목록 엑셀 다운로드 요청')

    // DB에서 갤러리 데이터 조회 (통계 포함)
    const galleries = await this.getAllGalleries()

    // 엑셀 데이터 변환
    const excelData = galleries.map(gallery => ({
      갤러리URL: gallery.galleryUrl,
      갤러리ID: gallery.galleryId,
      갤러리명: gallery.galleryName || '',
      타입: gallery.type === 'search' ? '검색' : '갤러리',
      작업타입: gallery.actionType === 'coupas' ? '쿠파스' : gallery.actionType === 'fixed_comment' ? '고정댓글' : '',
      검색키워드: gallery.searchKeyword || '',
      댓글내용: gallery.commentText || '',
      로그인ID: gallery.loginId || '',
      로그인비밀번호: gallery.loginPassword || '',
      닉네임: gallery.nickname || '',
      비밀번호: gallery.password || '',
      활성상태: gallery.isActive ? '활성' : '비활성',
      비고: '', // 엑셀에서 직접 관리
      게시글수: gallery.postCount || 0,
      미답변수: gallery.unansweredPostCount || 0,
      마지막확인: gallery.lastCheckedAt
        ? new Date(gallery.lastCheckedAt).toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '',
      생성일: new Date(gallery.createdAt).toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    }))

    // 워크북 생성
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(excelData)

    // 컬럼 너비 설정
    const columnWidths = [
      { wch: 50 }, // 갤러리URL
      { wch: 20 }, // 갤러리ID
      { wch: 20 }, // 갤러리명
      { wch: 10 }, // 타입
      { wch: 12 }, // 작업타입
      { wch: 15 }, // 검색키워드
      { wch: 30 }, // 댓글내용
      { wch: 15 }, // 로그인ID
      { wch: 15 }, // 로그인비밀번호
      { wch: 12 }, // 닉네임
      { wch: 12 }, // 비밀번호
      { wch: 10 }, // 활성상태
      { wch: 40 }, // 비고
      { wch: 12 }, // 게시글수
      { wch: 12 }, // 미답변수
      { wch: 18 }, // 마지막확인
      { wch: 18 }, // 생성일
    ]
    worksheet['!cols'] = columnWidths

    // 워크북에 워크시트 추가
    XLSX.utils.book_append_sheet(workbook, worksheet, '갤러리목록')

    // 파일명 생성 (한국 시간 기준)
    const now = new Date()
    const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000) // UTC + 9시간
    const dateStr = kstDate.toISOString().split('T')[0]
    const filename = `갤러리_목록_${dateStr}.xlsx`

    // 엑셀 파일을 Buffer로 변환
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    this._logger.log(`갤러리 목록 엑셀 생성 완료: ${galleries.length}개 항목, 파일명: ${filename}`)

    return {
      buffer: Buffer.from(buffer),
      filename,
    }
  }

  // ==================== 블랙리스트 관리 ====================

  /**
   * 모든 블랙리스트 조회
   */
  async getAllBlacklistedGalleries(): Promise<BlacklistedGalleryResponseDto[]> {
    const galleries = await this._prisma.blacklistedGallery.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return galleries
  }

  /**
   * 블랙리스트 단일 조회
   */
  async getBlacklistedGalleryById(id: string): Promise<BlacklistedGalleryResponseDto> {
    const gallery = await this._prisma.blacklistedGallery.findUnique({
      where: { id },
    })

    if (!gallery) {
      throw new NotFoundException(`블랙리스트를 찾을 수 없습니다: ${id}`)
    }

    return gallery
  }

  /**
   * 블랙리스트 생성
   */
  async createBlacklistedGallery(dto: CreateBlacklistedGalleryDto): Promise<BlacklistedGalleryResponseDto> {
    let galleryUrl = dto.galleryUrl
    let galleryId = dto.galleryId
    let galleryName = dto.galleryName

    // galleryId와 galleryName이 없으면 자동 크롤링
    if (!galleryId || !galleryName) {
      this._logger.log(`블랙리스트 갤러리 정보 자동 크롤링: ${galleryUrl}`)
      try {
        const crawledInfo = await this._galleryInfoCrawler.crawlGalleryInfo(galleryUrl)
        galleryId = galleryId || crawledInfo.galleryId
        galleryName = galleryName || crawledInfo.galleryName
        this._logger.log(`크롤링 완료 - ID: ${galleryId}, 이름: ${galleryName}`)
      } catch (error) {
        this._logger.error('갤러리 정보 크롤링 실패', error)
        // 크롤링 실패 시 기본값 사용
        galleryId = galleryId || 'unknown'
        galleryName = galleryName || galleryUrl
        this._logger.warn(`기본값 사용 - ID: ${galleryId}, 이름: ${galleryName}`)
      }
    }

    const gallery = await this._prisma.blacklistedGallery.create({
      data: {
        galleryUrl: galleryUrl!,
        galleryId: galleryId!,
        galleryName,
        remarks: dto.remarks,
      },
    })

    return gallery
  }

  /**
   * 블랙리스트 수정
   */
  async updateBlacklistedGallery(id: string, dto: UpdateBlacklistedGalleryDto): Promise<BlacklistedGalleryResponseDto> {
    const gallery = await this._prisma.blacklistedGallery.findUnique({ where: { id } })
    if (!gallery) {
      throw new NotFoundException(`블랙리스트를 찾을 수 없습니다: ${id}`)
    }

    // URL이 변경된 경우 갤러리 정보 자동 크롤링
    let updateData = { ...dto }
    if (dto.galleryUrl && dto.galleryUrl !== gallery.galleryUrl) {
      this._logger.log(`블랙리스트 갤러리 URL 변경 감지, 정보 재크롤링: ${dto.galleryUrl}`)
      try {
        const crawledInfo = await this._galleryInfoCrawler.crawlGalleryInfo(dto.galleryUrl)
        updateData.galleryId = crawledInfo.galleryId
        updateData.galleryName = crawledInfo.galleryName
        this._logger.log(`갤러리 정보 업데이트 완료 - ID: ${crawledInfo.galleryId}, 이름: ${crawledInfo.galleryName}`)
      } catch (error) {
        this._logger.error('갤러리 정보 크롤링 실패', error)
        // 크롤링 실패 시에도 URL은 업데이트하되, ID와 이름은 기존 값 유지
        updateData.galleryId = gallery.galleryId
        updateData.galleryName = gallery.galleryName
      }
    }

    const updated = await this._prisma.blacklistedGallery.update({
      where: { id },
      data: updateData,
    })

    return updated
  }

  /**
   * 블랙리스트 삭제
   */
  async deleteBlacklistedGallery(id: string): Promise<void> {
    const gallery = await this._prisma.blacklistedGallery.findUnique({ where: { id } })
    if (!gallery) {
      throw new NotFoundException(`블랙리스트를 찾을 수 없습니다: ${id}`)
    }

    await this._prisma.blacklistedGallery.delete({ where: { id } })
  }

  /**
   * 블랙리스트 일괄 삭제
   */
  async bulkDeleteBlacklistedGalleries(dto: BulkDeleteBlacklistedGalleryDto): Promise<{ deletedCount: number }> {
    const result = await this._prisma.blacklistedGallery.deleteMany({
      where: {
        id: {
          in: dto.ids,
        },
      },
    })

    return { deletedCount: result.count }
  }

  /**
   * galleryId로 블랙리스트 여부 확인
   */
  async isGalleryBlacklisted(galleryId: string): Promise<boolean> {
    const count = await this._prisma.blacklistedGallery.count({
      where: { galleryId },
    })

    return count > 0
  }
}
