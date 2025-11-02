import { Body, Controller, Delete, Get, Header, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common'
import { Response } from 'express'
import { PostJobService } from './post-job.service'
import { AuthGuard, Permission, Permissions } from '@main/app/modules/auth/auth.guard'
import { ExportExcelDto, BulkUpdateViewCountsDto } from '@main/app/modules/dcinside/job/dto/bulk-action.dto'

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
  async updateViewCounts(@Body() body: BulkUpdateViewCountsDto) {
    return await this.postJobService.updateViewCounts(body)
  }

  @Post('export-excel')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportJobsToExcel(@Body() body: ExportExcelDto, @Res() res: Response) {
    const excelBuffer = await this.postJobService.exportJobsToExcel(body)

    const fileName = `포스팅목록_${new Date().toISOString().slice(0, 10)}.xlsx`
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
    res.send(excelBuffer)
  }
}
