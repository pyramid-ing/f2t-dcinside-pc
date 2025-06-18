const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const tmpDbPath = path.join(__dirname, '../prisma/tmp-initial.sqlite')
const resourcesDbPath = path.join(__dirname, '../resources/initial.sqlite')

// 1. 임시 DB 파일이 있으면 삭제
if (fs.existsSync(tmpDbPath)) {
  fs.unlinkSync(tmpDbPath)
  console.log('기존 tmp-initial.sqlite 삭제 완료')
}

// 2. DATABASE_URL을 임시 DB로 지정해서 초기화
console.log('임시 DB로 초기화(pnpm db:init) 실행...')
execSync(`DATABASE_URL="file:${tmpDbPath}" pnpm db:init`, { stdio: 'inherit' })

// 3. 임시 DB를 resources/initial.sqlite로 복사
if (fs.existsSync(tmpDbPath)) {
  fs.copyFileSync(tmpDbPath, resourcesDbPath)
  console.log('초기 DB를 resources/initial.sqlite로 복사 완료')
  // 4. 임시 DB 삭제(선택)
  fs.unlinkSync(tmpDbPath)
}
else {
  console.error('임시 DB 파일이 생성되지 않았습니다!')
  process.exit(1)
}
