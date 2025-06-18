import { Module } from '@nestjs/common'
import { RouterModule } from '@nestjs/core'
import { DcinsideApiModule } from './api/api.module'
import { DcinsideWorkflowModule } from './workflow/workflow.module'

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
  ],
})
export class DcinsideModule {}
