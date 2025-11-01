import { Injectable, Logger } from '@nestjs/common'
import { ChatOpenAI } from '@langchain/openai'
import { getPromptTemplate, PRODUCT_RECOMMENDATION } from './ai-prompts/prompt-templates'
import { DcinsidePostingCrawlerService } from '../crawler/dcinside-posting-crawler.service'
import { retry } from '@main/app/utils/retry'

export interface PostSuitabilityResult {
  approved: boolean
  reason: string
}

export interface PostInfo {
  postUrl: string
  postTitle: string
  postId: string
  galleryName: string | null
  headtext: string | null
  authorName: string | null
}

@Injectable()
export class MonitoringAiService {
  private readonly logger = new Logger(MonitoringAiService.name)

  constructor(private readonly postingCrawlerService: DcinsidePostingCrawlerService) {}

  /**
   * 게시물 적합성 검사
   * @param post 검사할 게시물 정보
   * @param promptCode 프롬프트 코드명 (예: 'product-recommendation')
   */
  async checkPostSuitability(post: PostInfo, promptCode?: string): Promise<PostSuitabilityResult> {
    this.logger.log(`AI 적합성 검사 시작: ${post.postTitle}`)

    // 프롬프트 템플릿 가져오기
    const template = promptCode ? getPromptTemplate(promptCode) : PRODUCT_RECOMMENDATION
    this.logger.log(`사용 프롬프트: ${template.name} (${template.code})`)

    // 게시글 내용 크롤링 (3회 재시도)
    const crawledData = await retry(
      async () => {
        return await this.postingCrawlerService.crawlPostData(post.postUrl, {
          downloadImages: false,
        })
      },
      2000,
      3,
      'linear',
    )

    // LLM 인스턴스 생성 (템플릿별 temperature 사용)
    const llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: template.temperature || 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
    })

    // Structured Output 정의 (템플릿의 스키마 사용)
    const structuredLlm: any = (llm as any).withStructuredOutput(template.outputSchema)

    // 사용자 메시지 생성 (크롤링된 내용 포함)
    const userMessage = this.buildUserMessage(post, crawledData.content.trim())

    // AI 호출 (에러 발생 시 throw하여 재시도 가능하도록 함)
    const response = await structuredLlm.invoke([
      { role: 'system', content: template.systemPrompt },
      { role: 'user', content: userMessage },
    ])

    this.logger.log(`AI 판단 완료 - 승인: ${response.approved}, 이유: ${response.reason}`)

    return {
      approved: response.approved,
      reason: response.reason,
    }
  }

  /**
   * 사용자 메시지 생성
   */
  private buildUserMessage(post: PostInfo, postContent?: string): string {
    return `아래 게시물에 쿠팡 제품 추천 블로그 링크를 댓글로 달기에 적합한가요?
---
제목: ${post.postTitle}
갤러리: ${post.galleryName || '알 수 없음'}
말머리: ${post.headtext || '없음'}
내용: ${postContent}
`
  }
}
