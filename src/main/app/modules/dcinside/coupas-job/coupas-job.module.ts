import { Module } from '@nestjs/common'
import { CoupasJobService } from './coupas-job.service'
import { CoupasJobController } from './coupas-job.controller'
import { JobLogsModule } from '@main/app/modules/dcinside/job-logs/job-logs.module'
import { CoupangWorkflowModule } from '@main/app/modules/coupang-workflow/coupang-workflow.module'
import { CommonModule } from '@main/app/modules/common/common.module'

@Module({
  imports: [JobLogsModule, CoupangWorkflowModule, CommonModule],
  controllers: [CoupasJobController],
  providers: [CoupasJobService],
  exports: [CoupasJobService],
})
export class CoupasJobModule {}
