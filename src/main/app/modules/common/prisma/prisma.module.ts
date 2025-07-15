import { PrismaService } from '@main/app/modules/common/prisma/prisma.service'
import { Global, Module } from '@nestjs/common'

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
