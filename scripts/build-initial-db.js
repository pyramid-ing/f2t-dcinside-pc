import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const tmpDbPath = path.join(__dirname, '../prisma/tmp-initial.sqlite')
const resourcesDbPath = path.join(__dirname, '../resources/initial.sqlite')

console.log('=== 초기 DB 빌드 시작 ===')

// 1. 기존 파일들 정리
if (fs.existsSync(tmpDbPath)) {
  fs.unlinkSync(tmpDbPath)
}

// 2. resources 디렉토리 생성
const resourcesDir = path.dirname(resourcesDbPath)
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true })
}

// 3. DATABASE_URL 설정 및 DB 초기화
process.env.DATABASE_URL = `file:${tmpDbPath}`

console.log('Prisma 초기화 중...')
execSync('pnpm prisma generate', { stdio: 'inherit' })
execSync('pnpm prisma migrate deploy', { stdio: 'inherit' })
execSync('pnpm run db:seed', { stdio: 'inherit' })

// 4. 생성된 DB를 resources로 복사
if (fs.existsSync(tmpDbPath)) {
  fs.copyFileSync(tmpDbPath, resourcesDbPath)
  console.log(`DB 복사 완료: ${resourcesDbPath}`)
  
  // 임시 파일 삭제
  fs.unlinkSync(tmpDbPath)
} else {
  console.error('DB 파일 생성 실패')
  process.exit(1)
}

console.log('=== 초기 DB 빌드 완료 ===')
