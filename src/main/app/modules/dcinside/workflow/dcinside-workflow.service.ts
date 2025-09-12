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
    const validRows = []
    const invalidRows = []

    // 1단계: 데이터 검증 및 분류
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

          invalidRows.push({
            row,
            success: false,
            message: `행 ${rowIndex + 2}: ${isDateFormatError ? errorMessage : `데이터 검증 실패: ${errorMessage}`}`,
          })
          continue
        }

        const transformedRow = parseResult.data
        validRows.push({
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
          // 원본 데이터 보존 (결과 반환용)
          originalData: transformedRow,
        })
      } catch (error) {
        // CustomHttpException이나 다른 예외가 직접 발생한 경우
        let errorMessage = error.message || '알 수 없는 오류'

        // CustomHttpException인 경우 metadata에서 메시지 추출
        if (error.metadata && error.metadata.message) {
          errorMessage = error.metadata.message
        }

        invalidRows.push({
          row,
          success: false,
          message: `행 ${rowIndex + 2}: ${errorMessage}`,
        })
      }
    }

    // 2단계: 유효한 데이터를 배치로 처리
    if (validRows.length > 0) {
      try {
        const batchSize = 100 // 배치 크기 설정
        const batches = this.chunkArray(validRows, batchSize)

        for (const batch of batches) {
          try {
            const batchResults = await this.postJobService.bulkCreateJobsWithPostJobs(batch)

            // 배치 결과를 results에 추가
            batchResults.forEach((result, index) => {
              const originalData = batch[index].originalData
              const isScheduled = originalData.scheduledAt && dayjs(originalData.scheduledAt).isAfter(dayjs())
              const messageType = isScheduled ? '예약 등록' : '즉시 등록'

              results.push({
                ...originalData,
                success: true,
                message: messageType,
                postJobId: result.id,
              })
            })
          } catch (batchError) {
            // 배치 실패 시 개별 처리로 폴백
            console.warn(`배치 처리 실패, 개별 처리로 폴백: ${batchError.message}`)

            for (const row of batch) {
              try {
                const scheduled = await this.postJobService.createJobWithPostJob({
                  galleryUrl: row.galleryUrl,
                  title: row.title,
                  contentHtml: row.contentHtml,
                  password: row.password,
                  nickname: row.nickname,
                  headtext: row.headtext,
                  imagePaths: row.imagePaths,
                  loginId: row.loginId,
                  loginPassword: row.loginPassword,
                  scheduledAt: row.scheduledAt,
                  imagePosition: row.imagePosition,
                  deleteAt: row.deleteAt,
                  autoDeleteMinutes: row.autoDeleteMinutes,
                })

                const isScheduled = row.originalData.scheduledAt && dayjs(row.originalData.scheduledAt).isAfter(dayjs())
                const messageType = isScheduled ? '예약 등록' : '즉시 등록'
                results.push({
                  ...row.originalData,
                  success: true,
                  message: messageType,
                  postJobId: scheduled.id,
                })
              } catch (e) {
                results.push({
                  ...row.originalData,
                  success: false,
                  message: `등록 실패: ${e.message}`,
                })
              }
            }
          }
        }
      } catch (e) {
        // 전체 배치 처리 실패 시 모든 행을 실패로 처리
        validRows.forEach(row => {
          results.push({
            ...row.originalData,
            success: false,
            message: `배치 등록 실패: ${e.message}`,
          })
        })
      }
    }

    // 3단계: 검증 실패한 행들을 결과에 추가
    results.push(...invalidRows)

    return results
  }

  /**
   * 배열을 지정된 크기의 청크로 나누는 유틸리티 메서드
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }
}
