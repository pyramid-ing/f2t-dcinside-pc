import { Module } from '@nestjs/common'
import { JobLogsController } from 'src/main/app/modules/dcinside/job-logs/job-logs.controller'
import { JobLogsService } from 'src/main/app/modules/dcinside/job-logs/job-logs.service'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [CommonModule],
  controllers: [JobLogsController],
  providers: [JobLogsService],
  exports: [JobLogsService],
})
export class JobLogsModule {}
