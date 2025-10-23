import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { PostJobService } from './post-job.service'
import { AuthGuard, Permission, Permissions } from '@main/app/modules/auth/auth.guard'

@Controller('post-jobs')
export class PostJobController {
  constructor(private readonly postJobService: PostJobService) {}

  @Get()
  async getPostJobs(
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
  async getPostJobById(@Param('id') id: string) {
    return await this.postJobService.getPostJobById(id)
  }

  @UseGuards(AuthGuard)
  @Permissions(Permission.POSTING)
  @Post()
  async createPostJob(@Body() data: any) {
    return await this.postJobService.createPostJob(data)
  }

  @UseGuards(AuthGuard)
  @Permissions(Permission.POSTING)
  @Put(':id')
  async updatePostJob(@Param('id') id: string, @Body() data: any) {
    return await this.postJobService.updatePostJob(id, data)
  }

  @UseGuards(AuthGuard)
  @Permissions(Permission.POSTING)
  @Delete(':id')
  async deletePostJob(@Param('id') id: string) {
    return await this.postJobService.deletePostJob(id)
  }

  @UseGuards(AuthGuard)
  @Permissions(Permission.POSTING)
  @Post('update-view-counts')
  async updateViewCounts(@Body() data: { jobIds: string[] }) {
    return await this.postJobService.updateViewCounts(data.jobIds)
  }
}
