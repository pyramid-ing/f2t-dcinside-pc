import path from 'node:path'
import { DcinsideLoginService } from '@main/app/modules/dcinside/api/dcinside-login.service'
import { Injectable } from '@nestjs/common'
import * as XLSX from 'xlsx'
import { DcinsidePostingService, DcinsidePostParams } from '../api/dcinside-posting.service'

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
  로그인ID?: string
  로그인비번?: string
  말머리?: string // headtext
}

@Injectable()
export class DcinsideWorkflowService {
  constructor(
    private readonly postingService: DcinsidePostingService,
    private readonly loginService: DcinsideLoginService,
  ) {}

  async handleExcelUpload(file: Express.Multer.File) {
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
      로그인ID: 'loginId',
      로그인비번: 'loginPassword',
      말머리: 'headtext',
    }

    // 각 행을 posting params로 변환
    const postList: DcinsidePostParams[] = rows.map((row) => {
      const mappedRow: any = {}
      Object.entries(colMap).forEach(([kor, eng]) => {
        if (row[kor as keyof ExcelRow] !== undefined)
          mappedRow[eng] = row[kor as keyof ExcelRow]
      })
      // 이미지경로1,2,3... 배열로 합치기
      mappedRow.imagePaths = []
      Object.keys(mappedRow).forEach((key) => {
        if (key !== 'imagePaths' && key.startsWith('imagePath') && mappedRow[key]) {
          let imgPath = mappedRow[key]
          if (!path.isAbsolute(imgPath)) {
            imgPath = path.resolve(process.cwd(), imgPath)
          }
          mappedRow.imagePaths.push(imgPath)
        }
      })
      return mappedRow as DcinsidePostParams
    })

    // postList 순회하며 포스팅
    const results = []
    for (const row of postList) {
      // 로그인 필요 체크 및 로그인
      if (row.loginId && row.loginPassword) {
        const loginResult = await this.loginService.login(row.loginId, row.loginPassword, false)
        if (!loginResult.success) {
          results.push({ ...row, success: false, message: '로그인 실패' })
          continue
        }
      }
      // 포스팅
      try {
        const postResult = await this.postingService.postArticle({
          ...row,
          headless: false,
        })
        results.push({ ...row, ...postResult })
      }
      catch (e) {
        results.push({ ...row, success: false, message: e.message })
      }
    }
    return results
  }
}
