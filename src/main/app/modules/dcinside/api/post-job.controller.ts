import type { PostJobDto } from './dto/scheduled-post.dto'
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { PostJobService } from './post-job.service'

@Controller('post-jobs')
export class PostJobController {
  constructor(private readonly postJobService: PostJobService) {}

  @Post()
  async create(@Body() dto: PostJobDto) {
    return this.postJobService.createPostJob(dto)
  }

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('orderBy') orderBy?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.postJobService.getPostJobs({
      status,
      search,
      orderBy: orderBy || 'updatedAt',
      order: order || 'desc',
    })
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
