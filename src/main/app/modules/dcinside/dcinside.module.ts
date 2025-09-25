import { Module } from '@nestjs/common'
import { RouterModule } from '@nestjs/core'
import { DcinsideApiModule } from './api/api.module'
import { DcinsideWorkflowModule } from './workflow/workflow.module'
import { JobModule } from './job/job.module'
import { CommentModule } from './comment/comment.module'

@Module({
  imports: [
    RouterModule.register([
      {
        path: 'dcinside',
        children: [
          { path: 'api', module: DcinsideApiModule },
          { path: 'workflow', module: DcinsideWorkflowModule },
          { path: 'comment', module: CommentModule },
        ],
      },
    ]),
    DcinsideApiModule,
    DcinsideWorkflowModule,
    JobModule,
    CommentModule,
  ],
})
export class DcinsideModule {}
