import type { PostJobDto } from './dto/scheduled-post.dto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { PrismaService } from '@main/app/shared/prisma.service'
import { Injectable, Logger } from '@nestjs/common'
import { ZodError } from 'zod'
import { PostJobSchema } from './dto/schemas'

@Injectable()
export class PostJobService {
  private readonly logger = new Logger(PostJobService.name)
  constructor(private readonly prismaService: PrismaService) {}

  private validateImagePaths(imagePaths: string[]): { valid: string[]; errors: string[] } {
    const valid: string[] = []
    const errors: string[] = []

    for (const imagePath of imagePaths) {
      try {
        // 파일 존재 여부 확인
        if (!fs.existsSync(imagePath)) {
          errors.push(`파일이 존재하지 않습니다: ${imagePath}`)
          continue
        }

        // 파일이 이미지인지 확인 (확장자 체크)
        const ext = path.extname(imagePath).toLowerCase()
        const validImageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
        if (!validImageExts.includes(ext)) {
          errors.push(`지원하지 않는 이미지 형식입니다: ${imagePath}`)
          continue
        }

        valid.push(imagePath)
      } catch (error) {
        errors.push(`파일 접근 오류: ${imagePath} - ${error.message}`)
      }
    }

    return { valid, errors }
  }

  private validateAndSanitizeDto(rawDto: any): { sanitizedDto: PostJobDto; errors: string[] } {
    const errors: string[] = []

    try {
      // Zod로 검증 및 변환
      const sanitizedDto = PostJobSchema.parse(rawDto)

      // 추가 이미지 파일 검증
      if (sanitizedDto.imagePaths && sanitizedDto.imagePaths.length > 0) {
        const validation = this.validateImagePaths(sanitizedDto.imagePaths)
        if (validation.errors.length > 0) {
          errors.push(...validation.errors)
          return { sanitizedDto, errors }
        }
        sanitizedDto.imagePaths = validation.valid
      }

      return { sanitizedDto, errors }
    } catch (error) {
      if (error instanceof ZodError) {
        const zodErrors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        errors.push(...zodErrors)
      } else {
        errors.push(`검증 오류: ${error.message}`)
      }
      return { sanitizedDto: null as any, errors }
    }
  }

  // 예약 등록 추가 (검증 포함)
  async createPostJob(rawDto: any) {
    // 데이터 검증 및 정리
    const { sanitizedDto, errors } = this.validateAndSanitizeDto(rawDto)

    if (errors.length > 0) {
      throw new Error(`데이터 검증 실패: ${errors.join(', ')}`)
    }

    return this.prismaService.postJob.create({
      data: {
        galleryUrl: sanitizedDto.galleryUrl,
        title: sanitizedDto.title,
        contentHtml: sanitizedDto.contentHtml,
        password: sanitizedDto.password.toString(),
        nickname: sanitizedDto.nickname ?? null,
        headtext: sanitizedDto.headtext ?? null,
        imagePaths: sanitizedDto.imagePaths ? JSON.stringify(sanitizedDto.imagePaths) : null,
        loginId: sanitizedDto.loginId ?? null,
        loginPassword: sanitizedDto.loginPassword ?? null,
        scheduledAt: sanitizedDto.scheduledAt || new Date(),
        status: 'pending',
      },
    })
  }

  // 예약 작업 목록 조회 (최신 업데이트가 위로 오게 정렬)
  async getPostJobs(options?: { status?: string; search?: string; orderBy?: string; order?: 'asc' | 'desc' }) {
    const where: any = {}

    // 상태 필터
    if (options?.status) {
      where.status = options.status
    }

    // 검색 필터 (제목, 갤러리URL, 말머리에서 검색)
    if (options?.search) {
      where.OR = [
        { title: { contains: options.search } },
        { galleryUrl: { contains: options.search } },
        { headtext: { contains: options.search } },
        { resultMsg: { contains: options.search } },
      ]
    }

    // 정렬 설정
    const orderBy: any = {}
    const sortField = options?.orderBy || 'updatedAt'
    const sortOrder = options?.order || 'desc'
    orderBy[sortField] = sortOrder

    return this.prismaService.postJob.findMany({
      where,
      orderBy,
    })
  }

  // 예약 작업 상태/결과 갱신
  async updateStatus(id: number, status: string, resultMsg?: string) {
    return this.prismaService.postJob.update({
      where: { id },
      data: { status, resultMsg },
    })
  }

  // 예약 작업 상태/결과/URL 갱신 (포스팅 완료 시 사용)
  async updateStatusWithUrl(id: number, status: string, resultMsg?: string, resultUrl?: string) {
    return this.prismaService.postJob.update({
      where: { id },
      data: { status, resultMsg, resultUrl },
    })
  }

  // pending 작업 조회 (scheduledAt <= now)
  async findPending(now: Date) {
    return this.prismaService.postJob.findMany({
      where: { status: 'pending', scheduledAt: { lte: now } },
      orderBy: { scheduledAt: 'asc' },
    })
  }

  // 특정 상태인 작업들 조회
  async findByStatus(status: string) {
    return this.prismaService.postJob.findMany({
      where: { status },
      orderBy: { scheduledAt: 'asc' },
    })
  }

  // pending 상태이면서 scheduledAt <= now인 작업들을 processing으로 일괄 변경
  async updatePendingToProcessing(now: Date): Promise<number> {
    const result = await this.prismaService.postJob.updateMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: now },
      },
      data: {
        status: 'processing',
      },
    })
    return result.count
  }

  // 실패한 작업 재시도 (상태를 pending으로 변경)
  async retryPostJob(id: number) {
    const job = await this.prismaService.postJob.findUnique({ where: { id } })

    if (!job) {
      return { success: false, message: '작업을 찾을 수 없습니다.' }
    }

    if (job.status !== 'failed') {
      return { success: false, message: '실패한 작업만 재시도할 수 있습니다.' }
    }

    await this.prismaService.postJob.update({
      where: { id },
      data: {
        status: 'pending',
        resultMsg: null,
        resultUrl: null,
      },
    })

    return { success: true, message: '재시도 요청이 완료되었습니다.' }
  }

  // 작업 삭제
  async deletePostJob(id: number) {
    const job = await this.prismaService.postJob.findUnique({ where: { id } })

    if (!job) {
      return { success: false, message: '작업을 찾을 수 없습니다.' }
    }

    if (job.status === 'processing') {
      return { success: false, message: '실행 중인 작업은 삭제할 수 없습니다.' }
    }

    await this.prismaService.postJob.delete({ where: { id } })

    return { success: true, message: '작업이 삭제되었습니다.' }
  }
}
