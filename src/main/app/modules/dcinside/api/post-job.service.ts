import * as fs from 'node:fs'
import * as path from 'node:path'
import { PrismaService } from '@main/app/shared/prisma.service'
import { Injectable, Logger } from '@nestjs/common'
import { PostJobDto } from './dto/scheduled-post.dto'

@Injectable()
export class PostJobService {
  private readonly logger = new Logger(PostJobService.name)
  constructor(private readonly prismaService: PrismaService) {
  }

  private validateImagePaths(imagePaths: string[]): { valid: string[], errors: string[] } {
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
      }
      catch (error) {
        errors.push(`파일 접근 오류: ${imagePath} - ${error.message}`)
      }
    }

    return { valid, errors }
  }

  private validateAndSanitizeDto(dto: PostJobDto): { sanitizedDto: Partial<PostJobDto>, errors: string[] } {
    const errors: string[] = []
    const sanitizedDto: Partial<PostJobDto> = { ...dto }

    // 1. 필수 필드 검증
    if (!dto.galleryUrl || !dto.title || !dto.contentHtml) {
      errors.push('필수 필드가 누락되었습니다 (galleryUrl, title, contentHtml)')
      return { sanitizedDto, errors }
    }

    // 2. 예정시간 검증 및 정리
    if (dto.scheduledAt) {
      const date = new Date(dto.scheduledAt)
      if (Number.isNaN(date.getTime())) {
        this.logger.warn(`잘못된 예정시간 형식, 현재 시간으로 변경: ${dto.scheduledAt}`)
        sanitizedDto.scheduledAt = new Date().toISOString()
      }
      else {
        sanitizedDto.scheduledAt = date.toISOString()
      }
    }
    else {
      sanitizedDto.scheduledAt = new Date().toISOString()
    }

    // 3. 말머리 검증 및 정리
    if (dto.headtext && typeof dto.headtext !== 'string') {
      this.logger.warn(`잘못된 말머리 형식, 제거됨: ${dto.headtext}`)
      sanitizedDto.headtext = undefined
    }

    // 4. 이미지 경로 검증 및 정리
    if (dto.imagePaths && dto.imagePaths.length > 0) {
      const validation = this.validateImagePaths(dto.imagePaths)
      if (validation.errors.length > 0) {
        errors.push(...validation.errors)
        return { sanitizedDto, errors }
      }
      sanitizedDto.imagePaths = validation.valid
    }

    // 5. 비밀번호 검증
    if (!dto.password) {
      errors.push('비밀번호는 필수입니다')
    }

    return { sanitizedDto, errors }
  }

  // 예약 등록 추가 (검증 포함)
  async createPostJob(dto: PostJobDto) {
    // 데이터 검증 및 정리
    const { sanitizedDto, errors } = this.validateAndSanitizeDto(dto)

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
        scheduledAt: new Date(sanitizedDto.scheduledAt),
        status: 'pending',
      },
    })
  }

  // 예약 작업 목록 조회
  async getPostJobs() {
    return this.prismaService.postJob.findMany({ orderBy: { scheduledAt: 'asc' } })
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
}
