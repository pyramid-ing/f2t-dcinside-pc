import { Module } from '@nestjs/common'
import { RouterModule } from '@nestjs/core'
import { DcinsideWorkflowModule } from './workflow/workflow.module'
import { JobModule } from './job/job.module'
import { DcinsideCommentModule } from 'src/main/app/modules/dcinside/comment/dcinsideCommentModule'
import { DcinsidePostingModule } from '@main/app/modules/dcinside/posting/dcinside-posting.module'

@Module({
  imports: [
    RouterModule.register([
      {
        path: 'dcinside',
        children: [
          { path: 'posting', module: DcinsidePostingModule },
          { path: 'workflow', module: DcinsideWorkflowModule },
          { path: 'comment', module: DcinsideCommentModule },
        ],
      },
    ]),
    DcinsidePostingModule,
    DcinsideWorkflowModule,
    JobModule,
    DcinsideCommentModule,
  ],
})
export class DcinsideModule {}
