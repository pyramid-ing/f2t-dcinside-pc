import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { PostJobService } from './post-job.service'
import { CustomHttpException } from '@main/common/errors/custom-http.exception'
import { ErrorCode } from '@main/common/errors/error-code.enum'
import { AuthGuard, Permissions } from '@main/app/modules/auth/auth.guard'

@Controller('post-jobs')
export class PostJobController {
  constructor(private readonly postJobService: PostJobService) {}

  @Get()
  async getPostJobs(
    @Query('search') search?: string,
    @Query('orderBy') orderBy?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    try {
      return await this.postJobService.getPostJobs({
        search,
        orderBy: orderBy || 'updatedAt',
        order: order || 'desc',
      })
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  @Get(':id')
  async getPostJobById(@Param('id') id: string) {
    try {
      return await this.postJobService.getPostJobById(id)
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  @UseGuards(AuthGuard)
  @Permissions('posting')
  @Post()
  async createPostJob(@Body() data: any) {
    try {
      return await this.postJobService.createPostJob(data)
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  @UseGuards(AuthGuard)
  @Permissions('posting')
  @Put(':id')
  async updatePostJob(@Param('id') id: string, @Body() data: any) {
    try {
      return await this.postJobService.updatePostJob(id, data)
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }

  @UseGuards(AuthGuard)
  @Permissions('posting')
  @Delete(':id')
  async deletePostJob(@Param('id') id: string) {
    try {
      return await this.postJobService.deletePostJob(id)
    } catch (error) {
      throw new CustomHttpException(ErrorCode.JOB_FETCH_FAILED)
    }
  }
}
