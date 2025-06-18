import { Module } from '@nestjs/common'
import { RouterModule } from '@nestjs/core'
import { InstagramApiModule } from './api/instagram-api.module'
import { InstagramWorkflowModule } from './workflow/instagram-workflow.module'

@Module({
  imports: [
    InstagramApiModule,
    InstagramWorkflowModule,
    RouterModule.register([
      {
        path: 'instagram',
        children: [
          { path: 'api', module: InstagramApiModule },
          { path: 'workflow', module: InstagramWorkflowModule },
        ],
      },
    ]),
  ],
  exports: [InstagramApiModule, InstagramWorkflowModule],
})
export class InstagramModule {}
