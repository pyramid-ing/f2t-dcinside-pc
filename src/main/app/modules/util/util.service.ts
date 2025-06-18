import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class UtilService {
  constructor(private readonly configService: ConfigService) {}
}
