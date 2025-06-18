import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from 'src/main/app/shared/prisma.service'

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  // key로 조회
  async findByKey(key: string) {
    return this.prisma.settings.findFirst({ where: { id: this.keyToId(key) } })
  }

  // key로 저장 (upsert)
  async saveByKey(key: string, data: any) {
    return this.prisma.settings.upsert({
      where: { id: this.keyToId(key) },
      update: { data },
      create: { id: this.keyToId(key), data },
    })
  }

  // key를 id로 변환 (간단 매핑, 실제 운영시 key 컬럼 추가 권장)
  private keyToId(key: string): number {
    // 예시: 'instagram' -> 100, 필요시 매핑 확장
    if (key === 'instagram')
      return 100
    if (key === 'global')
      return 2
    if (key === 'app')
      return 1
    return 9999 // 기타
  }
}
