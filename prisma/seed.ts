import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
}

(async () => {
  try {
    await main()
  }
  catch (e) {
    console.error(e)
    process.exit(1)
  }
  finally {
    await prisma.$disconnect()
  }
})()
