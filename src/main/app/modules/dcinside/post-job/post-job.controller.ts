import { Controller, Delete, Get, Param, Post, Query, Body } from '@nestjs/common'
import { PostJobService } from 'src/main/app/modules/dcinside/post-job/post-job.service'

@Controller('post-jobs')
export class PostJobController {
  constructor(private readonly postJobService: PostJobService) {}

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('orderBy') orderBy?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.postJobService.getPostJobs({
      search,
      orderBy: orderBy || 'updatedAt',
      order: order || 'desc',
    })
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.postJobService.getPostJobById(id)
  }

  @Post()
  async create(@Body() data: any) {
    return this.postJobService.createPostJob(data)
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.postJobService.updatePostJob(id, data)
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.postJobService.deletePostJob(id)
  }
}
