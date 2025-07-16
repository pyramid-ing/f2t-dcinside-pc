import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 시딩 시작...')

    // 기존 데이터 정리 (개발 환경에서만)
    if (process.env.NODE_ENV !== 'production') {
        console.log('📝 기존 데이터 정리 중...')
        await prisma.settings.deleteMany({})
    }

    // 1. 기본 설정 데이터 생성
    console.log('⚙️ 기본 설정 생성 중...')

    // Global 설정 (ID: 1)
    const globalSettings = await prisma.settings.upsert({
        where: {id: 1},
        update: {},
        create: {
            id: 1,
            data: {
                "showBrowserWindow": true,
                "taskDelay": 10,
                "actionDelay": 0,
                "imageUploadFailureAction": "fail",
                "openAIApiKey": "",
                "proxies": [],
                "proxyChangeMethod": "sequential",
                "proxyEnabled": false
            }

        }
    })

    console.log('✅ Global 설정 생성됨:', globalSettings.id)

    // 2. 통계 출력
    const settingsCount = await prisma.settings.count()

    console.log('\n📊 시딩 완료 통계:')
    console.log(`⚙️ 설정: ${settingsCount}개`)
    console.log('✨ 시딩이 성공적으로 완료되었습니다!')
}

(async () => {
    try {
        await main()
    } catch (e) {
        console.error('❌ 시딩 중 오류 발생:', e)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
        console.log('🔌 데이터베이스 연결 해제됨')
    }
})()
