import { Controller, Delete, Get, Param, Post, Query, Body, UseGuards } from '@nestjs/common'
import { PostJobService } from 'src/main/app/modules/dcinside/post-job/post-job.service'
import { AuthGuard, Permissions } from '../../auth/auth.guard'

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

  @UseGuards(AuthGuard)
  @Permissions('posting')
  @Post()
  async create(@Body() data: any) {
    return this.postJobService.createPostJob(data)
  }

  @UseGuards(AuthGuard)
  @Permissions('posting')
  @Post(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.postJobService.updatePostJob(id, data)
  }

  @UseGuards(AuthGuard)
  @Permissions('posting')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.postJobService.deletePostJob(id)
  }
}
