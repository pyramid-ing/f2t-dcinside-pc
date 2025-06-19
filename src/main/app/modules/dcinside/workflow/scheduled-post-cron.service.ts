import * as fs from 'node:fs'
import * as path from 'node:path'
import { sleep } from '@main/app/utils/sleep'
import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PostJobService } from 'src/main/app/modules/dcinside/api/post-job.service'
import { DcinsidePostingService, DcinsidePostParams } from '../api/dcinside-posting.service'

@Injectable()
export class ScheduledPostCronService {
  private readonly logger = new Logger(ScheduledPostCronService.name)
  constructor(
    private readonly postJobService: PostJobService,
    private readonly postingService: DcinsidePostingService,
  ) {}

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

  private validateAndSanitizeParams(post: any): { params: DcinsidePostParams | null, error: string | null } {
    try {
      // 1. 예정시간 확인
      let scheduledAt = post.scheduledAt
      if (scheduledAt) {
        const date = new Date(scheduledAt)
        if (Number.isNaN(date.getTime())) {
          this.logger.warn(`잘못된 예정시간 형식, null로 변경: ${scheduledAt}`)
          scheduledAt = null
        }
      }

      // 2. 말머리 검증 (잘못되었을 경우 기본값으로)
      let headtext = post.headtext
      if (headtext && typeof headtext !== 'string') {
        this.logger.warn(`잘못된 말머리 형식, 기본값으로 변경: ${headtext}`)
        headtext = undefined
      }

      // 3. 이미지 경로 검증
      let imagePaths: string[] = []
      if (post.imagePaths) {
        try {
          const parsedPaths = JSON.parse(post.imagePaths)
          if (Array.isArray(parsedPaths) && parsedPaths.length > 0) {
            const validation = this.validateImagePaths(parsedPaths)
            if (validation.errors.length > 0) {
              return {
                params: null,
                error: `파일 경로가 잘못되었습니다: ${validation.errors.join(', ')}`,
              }
            }
            imagePaths = validation.valid
          }
        }
        catch (error) {
          return {
            params: null,
            error: `이미지 경로 파싱 오류: ${error.message}`,
          }
        }
      }

      // 4. 필수 필드 검증
      if (!post.galleryUrl || !post.title || !post.contentHtml) {
        return {
          params: null,
          error: '필수 필드가 누락되었습니다 (galleryUrl, title, contentHtml)',
        }
      }

      const params: DcinsidePostParams = {
        ...post,
        scheduledAt,
        headtext,
        imagePaths,
        headless: false,
      }

      return { params, error: null }
    }
    catch (error) {
      return {
        params: null,
        error: `데이터 검증 오류: ${error.message}`,
      }
    }
  }

  // 1분마다 예약 글 등록 처리
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledPosts() {
    const now = new Date()
    const posts = await this.postJobService.findPending(now)

    for (const post of posts) {
      try {
        // 데이터 검증 및 정리
        const { params, error } = this.validateAndSanitizeParams(post)

        if (error) {
          await this.postJobService.updateStatus(post.id, 'failed', error)
          continue
        }

        const result = await this.postingService.postArticle(params!)
        await this.postJobService.updateStatus(post.id, 'completed', result.message)
      }
      catch (e: any) {
        await this.postJobService.updateStatus(post.id, 'failed', e.message)
      }
      // 10초 간격으로 처리
      await sleep(10000)
    }
  }
}
