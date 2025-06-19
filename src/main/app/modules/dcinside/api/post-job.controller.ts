import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { PostJobDto } from './dto/scheduled-post.dto'
import { PostJobService } from './post-job.service'

@Controller('post-jobs')
export class PostJobController {
  constructor(private readonly postJobService: PostJobService) {}

  @Post()
  async create(@Body() dto: PostJobDto) {
    return this.postJobService.createPostJob(dto)
  }

  @Get()
  async findAll() {
    return this.postJobService.getPostJobs()
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    return this.postJobService.retryPostJob(Number(id))
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.postJobService.deletePostJob(Number(id))
  }
}
