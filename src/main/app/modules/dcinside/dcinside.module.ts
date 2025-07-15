import { Module } from '@nestjs/common'
import { RouterModule } from '@nestjs/core'
import { DcinsideApiModule } from './api/api.module'
import { DcinsideWorkflowModule } from './workflow/workflow.module'
import { JobModule } from './job/job.module'

@Module({
  imports: [
    RouterModule.register([
      {
        path: 'dcinside',
        children: [
          { path: 'api', module: DcinsideApiModule },
          { path: 'workflow', module: DcinsideWorkflowModule },
        ],
      },
    ]),
    DcinsideApiModule,
    DcinsideWorkflowModule,
    JobModule,
  ],
})
export class DcinsideModule {}
