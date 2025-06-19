import { Injectable } from '@nestjs/common'

@Injectable()
export class PostingQueueService {
  private queue: (() => Promise<void>)[] = []
  private isRunning = false

  async enqueue(job: () => Promise<void>) {
    this.queue.push(job)
    this.runQueue()
  }

  private async runQueue() {
    if (this.isRunning)
      return
    this.isRunning = true

    while (this.queue.length > 0) {
      const job = this.queue.shift()
      if (job) {
        await job()
      }
    }

    this.isRunning = false
  }
}
