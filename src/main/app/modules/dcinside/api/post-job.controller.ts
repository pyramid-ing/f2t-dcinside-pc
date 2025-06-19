import { Body, Controller, Get, Post } from '@nestjs/common'
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
}
