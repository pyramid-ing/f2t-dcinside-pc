import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const tmpDbPath = path.join(__dirname, '../prisma/tmp-initial.sqlite')
const resourcesDbPath = path.join(__dirname, '../resources/initial.sqlite')

// 1. 임시 DB 파일이 있으면 삭제
if (fs.existsSync(tmpDbPath)) {
  fs.unlinkSync(tmpDbPath)
  console.log('기존 tmp-initial.sqlite 삭제 완료')
}

// 2. DATABASE_URL을 임시 DB로 지정해서 초기화 (크로스 플랫폼 지원)
console.log('임시 DB로 초기화(pnpm db:init) 실행...')

// Windows와 Unix 환경 모두 지원하는 방식
const isWindows = process.platform === 'win32'
const databaseUrl = `file:${tmpDbPath}`

if (isWindows) {
  // Windows: PowerShell 환경변수 설정 방식
  execSync(`$env:DATABASE_URL="${databaseUrl}"; pnpm db:init`, { 
    stdio: 'inherit',
    shell: 'powershell'
  })
} else {
  // Unix/Linux/macOS: 기존 방식
  execSync(`DATABASE_URL="${databaseUrl}" pnpm db:init`, { stdio: 'inherit' })
}

// 3. 임시 DB를 resources/initial.sqlite로 복사
if (fs.existsSync(tmpDbPath)) {
  fs.copyFileSync(tmpDbPath, resourcesDbPath)
  console.log('초기 DB를 resources/initial.sqlite로 복사 완료')
  // 4. 임시 DB 삭제(선택)
  fs.unlinkSync(tmpDbPath)
} else {
  console.error('임시 DB 파일이 생성되지 않았습니다!')
  process.exit(1)
}
