import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const tmpDbPath = path.join(__dirname, '../prisma/tmp-initial.sqlite')
const resourcesDbPath = path.join(__dirname, '../resources/initial.sqlite')

console.log('=== 초기 DB 빌드 시작 ===')
console.log(`임시 DB 경로: ${tmpDbPath}`)
console.log(`최종 DB 경로: ${resourcesDbPath}`)

// 1. 임시 DB 파일이 있으면 삭제
if (fs.existsSync(tmpDbPath)) {
  fs.unlinkSync(tmpDbPath)
  console.log('기존 tmp-initial.sqlite 삭제 완료')
}

// 2. resources 디렉토리 생성
const resourcesDir = path.dirname(resourcesDbPath)
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true })
  console.log(`resources 디렉토리 생성: ${resourcesDir}`)
}

// 3. DATABASE_URL 설정 및 초기화
const databaseUrl = `file:${tmpDbPath}`
process.env.DATABASE_URL = databaseUrl

console.log(`DATABASE_URL 설정: ${databaseUrl}`)

try {
  // Prisma 클라이언트 생성
  console.log('Prisma 클라이언트 생성 중...')
  execSync('pnpm prisma generate', { stdio: 'inherit' })
  
  // 마이그레이션 실행
  console.log('Prisma 마이그레이션 실행 중...')
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit' })
  
  // 시드 실행
  console.log('Prisma 시드 실행 중...')
  execSync('pnpm run db:seed', { stdio: 'inherit' })
  
} catch (error) {
  console.error('DB 초기화 중 오류 발생:', error.message)
  process.exit(1)
}

// 4. 임시 DB 파일 확인
if (!fs.existsSync(tmpDbPath)) {
  console.error('임시 DB 파일이 생성되지 않았습니다!')
  console.log('prisma 디렉토리 내용:')
  try {
    const prismaDir = path.join(__dirname, '../prisma')
    const files = fs.readdirSync(prismaDir)
    files.forEach(file => console.log(`  - ${file}`))
  } catch (e) {
    console.log('prisma 디렉토리를 읽을 수 없습니다.')
  }
  process.exit(1)
}

const stats = fs.statSync(tmpDbPath)
console.log(`임시 DB 파일 생성 확인: ${tmpDbPath} (${stats.size} bytes)`)

// 5. 임시 DB를 resources로 복사
try {
  fs.copyFileSync(tmpDbPath, resourcesDbPath)
  console.log(`DB 파일 복사 완료: ${tmpDbPath} -> ${resourcesDbPath}`)
  
  // 파일 권한 설정
  if (process.platform === 'win32') {
    try {
      execSync(`attrib -R "${resourcesDbPath}"`, { stdio: 'inherit' })
      console.log('Windows: 읽기 전용 속성 제거')
    } catch (e) {
      console.warn('Windows 권한 설정 실패 (무시):', e.message)
    }
  } else {
    try {
      fs.chmodSync(resourcesDbPath, 0o666)
      console.log('Unix: 파일 권한 설정 (0o666)')
    } catch (e) {
      console.warn('Unix 권한 설정 실패 (무시):', e.message)
    }
  }
  
} catch (error) {
  console.error('DB 파일 복사 중 오류:', error.message)
  process.exit(1)
}

// 6. 임시 DB 삭제
try {
  fs.unlinkSync(tmpDbPath)
  console.log('임시 DB 파일 삭제 완료')
} catch (error) {
  console.warn('임시 DB 파일 삭제 실패 (무시):', error.message)
}

console.log('=== 초기 DB 빌드 완료 ===')
