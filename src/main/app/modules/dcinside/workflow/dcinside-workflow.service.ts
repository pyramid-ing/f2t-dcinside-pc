import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { ExcelRowSchema } from '@main/app/modules/dcinside/workflow/dto/excel-row.schema'
import { PostJobService } from '@main/app/modules/dcinside/post-job/post-job.service'

@Injectable()
export class DcinsideWorkflowService {
  constructor(private readonly postJobService: PostJobService) {}

  async handleExcelUpload(file: any) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    const results = []

    // 데이터 검증 및 처리
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]

      try {
        const parseResult = ExcelRowSchema.safeParse(row)

        if (!parseResult.success) {
          // Zod 에러에서 실제 에러 추출
          let errorMessage = parseResult.error.message

          // CustomHttpException이 포함된 경우 처리
          const zodError = parseResult.error
          if (zodError.issues && zodError.issues.length > 0) {
            const issue = zodError.issues[0]
            if (issue.message && issue.message.includes('예약날짜 형식이 잘못되었습니다')) {
              errorMessage = issue.message
            }
          }

          const isDateFormatError = errorMessage.includes('예약날짜 형식이 잘못되었습니다')

          results.push({
            row,
            success: false,
            message: `행 ${rowIndex + 2}: ${isDateFormatError ? errorMessage : `데이터 검증 실패: ${errorMessage}`}`,
          })
          continue
        }

        const transformedRow = parseResult.data

        // 유효한 데이터는 바로 작업 등록 처리
        try {
          const scheduled = await this.postJobService.createJobWithPostJob({
            galleryUrl: transformedRow.galleryUrl,
            title: transformedRow.title,
            contentHtml: transformedRow.contentHtml,
            password: transformedRow.password ?? null,
            nickname: transformedRow.nickname ?? null,
            headtext: transformedRow.headtext ?? null,
            imagePaths: transformedRow.imagePaths ? JSON.stringify(transformedRow.imagePaths) : null,
            loginId: transformedRow.loginId ?? null,
            loginPassword: transformedRow.loginPassword ?? null,
            scheduledAt: transformedRow.scheduledAt || new Date(),
            imagePosition: transformedRow.imagePosition ?? null,
            deleteAt: transformedRow.deleteAt ?? undefined,
            autoDeleteMinutes: transformedRow.autoDeleteMinutes ?? undefined,
          })

          const isScheduled = transformedRow.scheduledAt && dayjs(transformedRow.scheduledAt).isAfter(dayjs())
          const messageType = isScheduled ? '예약 등록' : '즉시 등록'

          results.push({
            ...transformedRow,
            success: true,
            message: `행 ${rowIndex + 2}: ${messageType}`,
            postJobId: scheduled.id,
          })
        } catch (jobError) {
          results.push({
            ...transformedRow,
            success: false,
            message: `행 ${rowIndex + 2}: 등록 실패: ${jobError.message}`,
          })
        }
      } catch (error) {
        // CustomHttpException이나 다른 예외가 직접 발생한 경우
        let errorMessage = error.message || '알 수 없는 오류'

        // CustomHttpException인 경우 metadata에서 메시지 추출
        if (error.metadata && error.metadata.message) {
          errorMessage = error.metadata.message
        }

        results.push({
          row,
          success: false,
          message: `행 ${rowIndex + 2}: ${errorMessage}`,
        })
      }
    }

    return results
  }
}
