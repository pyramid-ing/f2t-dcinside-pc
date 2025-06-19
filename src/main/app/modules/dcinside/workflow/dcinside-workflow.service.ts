import path from 'node:path'
import { DcinsideLoginService } from '@main/app/modules/dcinside/api/dcinside-login.service'
import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { PostJobService } from 'src/main/app/modules/dcinside/api/post-job.service'
import * as XLSX from 'xlsx'
import { DcinsidePostingService, DcinsidePostParams } from '../api/dcinside-posting.service'

dayjs.extend(customParseFormat)

// 엑셀 한 행의 타입 명확화
interface ExcelRow {
  갤러리주소: string
  제목: string
  닉네임?: string
  내용HTML: string
  비밀번호?: string
  이미지경로1?: string
  이미지경로2?: string
  이미지경로3?: string
  이미지경로4?: string
  이미지경로5?: string
  이미지경로6?: string
  이미지경로7?: string
  이미지경로8?: string
  이미지경로9?: string
  이미지경로10?: string
  로그인ID?: string
  로그인비번?: string
  말머리?: string // headtext
  예약날짜?: string // publishAt (YYYY-MM-DD HH:mm or ISO format)
}

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
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' })

    // 한글 컬럼명 → 내부 파라미터명 매핑 (index, headless 제거)
    const colMap: { [K in keyof ExcelRow]: string } = {
      갤러리주소: 'galleryUrl',
      제목: 'title',
      닉네임: 'nickname',
      내용HTML: 'contentHtml',
      비밀번호: 'password',
      이미지경로1: 'imagePath1',
      이미지경로2: 'imagePath2',
      이미지경로3: 'imagePath3',
      이미지경로4: 'imagePath4',
      이미지경로5: 'imagePath5',
      이미지경로6: 'imagePath6',
      이미지경로7: 'imagePath7',
      이미지경로8: 'imagePath8',
      이미지경로9: 'imagePath9',
      이미지경로10: 'imagePath10',
      로그인ID: 'loginId',
      로그인비번: 'loginPassword',
      말머리: 'headtext',
      예약날짜: 'scheduledAt',
    }

    // 각 행을 posting params로 변환
    const postList: DcinsidePostParams[] = rows.map(row => {
      const mappedRow: any = {}
      Object.entries(colMap).forEach(([kor, eng]) => {
        if (row[kor as keyof ExcelRow] !== undefined) mappedRow[eng] = row[kor as keyof ExcelRow]
      })
      // 이미지경로1~n 배열로 합치기
      mappedRow.imagePaths = []
      Object.keys(mappedRow).forEach(key => {
        if (key !== 'imagePaths' && key.startsWith('imagePath') && mappedRow[key]) {
          let imgPath = mappedRow[key]
          if (!path.isAbsolute(imgPath)) {
            imgPath = path.resolve(process.cwd(), imgPath)
          }
          mappedRow.imagePaths.push(imgPath)
        }
      })
      // password를 문자열로 변환
      if (mappedRow.password !== undefined) {
        mappedRow.password = String(mappedRow.password)
      }
      // imagePath1~10 키 제거
      delete mappedRow.imagePath1
      delete mappedRow.imagePath2
      delete mappedRow.imagePath3
      delete mappedRow.imagePath4
      delete mappedRow.imagePath5
      delete mappedRow.imagePath6
      delete mappedRow.imagePath7
      delete mappedRow.imagePath8
      delete mappedRow.imagePath9
      delete mappedRow.imagePath10
      return mappedRow as DcinsidePostParams
    })

    const results = []

    for (const row of postList) {
      if (row.scheduledAt) {
        let parsed = dayjs(row.scheduledAt.toString().trim(), 'YYYY-MM-DD HH:mm', true)
        if (!parsed.isValid()) {
          parsed = dayjs(row.scheduledAt)
        }
        if (parsed.isValid()) {
          row.scheduledAt = parsed.toDate()
        }
      }

      // 로그인 필요 체크 및 로그인
      if (row.loginId && row.loginPassword) {
        const loginResult = await this.loginService.login({
          id: row.loginId,
          password: row.loginPassword,
          headless: false,
        })
        if (!loginResult.success) {
          results.push({ ...row, success: false, message: '로그인 실패' })
          continue
        }
      }

      // 모든 포스팅을 예약 등록으로 통일 처리 (즉시 실행도 현재 시간으로 예약)
      try {
        const scheduled = await this.postJobService.createPostJob({
          galleryUrl: row.galleryUrl,
          title: row.title,
          contentHtml: row.contentHtml,
          password: String(row.password),
          nickname: row.nickname,
          imagePaths: row.imagePaths,
          scheduledAt: row.scheduledAt,
          headtext: row.headtext,
          loginId: row.loginId,
          loginPassword: row.loginPassword,
        })

        const isScheduled = row.scheduledAt && dayjs(row.scheduledAt).isAfter(dayjs())
        const messageType = isScheduled ? '예약 등록' : '즉시 등록'
        results.push({ ...row, success: true, message: messageType, postJobId: scheduled.id })
      } catch (e) {
        results.push({ ...row, success: false, message: `등록 실패: ${e.message}` })
      }
    }
    return results
  }
}
