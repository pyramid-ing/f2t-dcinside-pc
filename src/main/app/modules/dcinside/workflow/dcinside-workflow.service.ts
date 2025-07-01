import { DcinsideLoginService } from '@main/app/modules/dcinside/api/dcinside-login.service'
import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import { PostJobService } from '@main/app/modules/dcinside/post-job/post-job.service'
import * as XLSX from 'xlsx'
import { DcinsidePostingService } from '../api/dcinside-posting.service'
import { ExcelRowSchema } from '../api/dto/post-job.schema'

@Injectable()
export class DcinsideWorkflowService {
  constructor(
    private readonly postingService: DcinsidePostingService,
    private readonly loginService: DcinsideLoginService,
    private readonly postJobService: PostJobService,
  ) {}

  async handleExcelUpload(file: any) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    const results = []

    for (const row of rows) {
      // ExcelRowSchema를 사용하여 데이터 변환 및 검증
      const parseResult = ExcelRowSchema.safeParse(row)

      if (!parseResult.success) {
        results.push({
          row,
          success: false,
          message: `데이터 검증 실패: ${parseResult.error.message}`,
        })
        continue
      }

      const transformedRow = parseResult.data

      // 모든 포스팅을 예약 등록으로 통일 처리 (즉시 실행도 현재 시간으로 예약)
      try {
        const scheduled = await this.postJobService.createPostJob({
          galleryUrl: transformedRow.galleryUrl,
          title: transformedRow.title,
          contentHtml: transformedRow.contentHtml,
          password: transformedRow.password,
          nickname: transformedRow.nickname,
          imagePaths: transformedRow.imagePaths,
          scheduledAt: transformedRow.scheduledAt,
          headtext: transformedRow.headtext,
          loginId: transformedRow.loginId,
          loginPassword: transformedRow.loginPassword,
          imagePosition: transformedRow.imagePosition,
        })

        const isScheduled = transformedRow.scheduledAt && dayjs(transformedRow.scheduledAt).isAfter(dayjs())
        const messageType = isScheduled ? '예약 등록' : '즉시 등록'
        results.push({ ...transformedRow, success: true, message: messageType, postJobId: scheduled.id })
      } catch (e) {
        results.push({ ...transformedRow, success: false, message: `등록 실패: ${e.message}` })
      }
    }
    return results
  }
}
