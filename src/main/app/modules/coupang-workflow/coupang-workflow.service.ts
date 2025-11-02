import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common'
import { CoupangWorkflowRequest, CoupangWorkflowResponse } from './coupang-workflow.types'
import { WordPressApiService } from '@main/app/modules/wordpress/wordpress-api.service'
import { WordPressAccount } from '@main/app/modules/wordpress/wordpress.types'
import { CoupangCrawlerService } from '@main/app/modules/coupang-crawler/coupang-crawler.service'
import { CoupangPartnersService } from '@main/app/modules/coupang-partners/coupang-partners.service'
import { CoupangRateLimiterService } from '@main/app/modules/coupang-partners/coupang-rate-limiter.service'
import { SettingsService } from '@main/app/modules/settings/settings.service'
import { Permission } from '@main/app/modules/auth/auth.guard'
import { assertPermission } from '@main/app/utils/permission.assert'
import { DcinsidePostData } from '@main/app/modules/dcinside/crawler/dcinside-posting-crawler.types'
import { DcinsidePostingCrawlerService } from '@main/app/modules/dcinside/crawler/dcinside-posting-crawler.service'
import { CommentJobService } from '@main/app/modules/dcinside/comment/comment-job.service'
import { JobLogsService } from '@main/app/modules/dcinside/job-logs/job-logs.service'
import { JobContextService } from '@main/app/modules/common/job-context/job-context.service'
import { JobStatus } from '@main/app/modules/dcinside/job/job.types'
import { ChatOpenAI } from '@langchain/openai'
import { StateGraph, START, END, Annotation } from '@langchain/langgraph'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { pull } from 'langchain/hub'
import { z } from 'zod'
import { EnvConfig } from '@main/config/env.config'
import { MonitoringService } from '@main/app/modules/dcinside/monitoring/monitoring.service'

import * as fs from 'fs'
import * as path from 'path'
import axios from 'axios'
import sharp from 'sharp'

// CoupangWorkflowError 클래스 정의
export class CoupangWorkflowErrorClass extends Error {
  constructor(
    public readonly errorInfo: {
      code: string
      message: string
      details?: any
    },
  ) {
    super(errorInfo.message)
    this.name = 'CoupangWorkflowError'
  }
}

interface CoupangProductResult {
  제품명: string
  쿠파스링크: string
  쿠팡링크: string
  가격: number
  이미지: string
  로켓배송: boolean
  로켓배송이미지: string
  리뷰수: number
}

interface CoupangSearchResult {
  검색어: string
  제품목록: CoupangProductResult[]
}

// LangGraph State 정의
const WorkflowState = Annotation.Root({
  request: Annotation<CoupangWorkflowRequest>(),
  postData: Annotation<DcinsidePostData | null>(),
  searchKeywords: Annotation<string[]>(),
  blogTitle: Annotation<string>(),
  // 제품 검색 결과 (중간 상태)
  productSearchMap: Annotation<
    Map<
      string,
      Array<{
        title: string
        url: string
        price: number
        image: string
        isRocket: boolean
        rocketBadgeUrl: string
        reviewCount: number
      }>
    >
  >(),
  // 최종 결과 (어필리에이트 링크 포함)
  searchResults: Annotation<CoupangSearchResult[]>(),
  uploadedImageUrls: Annotation<string[]>(),
  wpContent: Annotation<string>(),
  blogLink: Annotation<string>(),
  commentText: Annotation<string>(),
  error: Annotation<Error | null>(),
})

@Injectable()
export class CoupangWorkflowService {
  private readonly logger = new Logger(CoupangWorkflowService.name)
  private llm: ChatOpenAI

  constructor(
    private readonly wordpressApiService: WordPressApiService,
    private readonly coupangCrawlerService: CoupangCrawlerService,
    private readonly coupangPartnersService: CoupangPartnersService,
    private readonly coupangRateLimiterService: CoupangRateLimiterService,
    private readonly dcinsidePostingCrawlerService: DcinsidePostingCrawlerService,
    private readonly commentJobService: CommentJobService,
    private readonly settingsService: SettingsService,
    private readonly jobLogsService: JobLogsService,
    private readonly jobContextService: JobContextService,
    @Inject(forwardRef(() => MonitoringService))
    private readonly monitoringService: MonitoringService,
  ) {
    this.llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY,
    })
  }

  /**
   * 쿠팡 워크플로우 실행 (LangGraph 방식)
   */
  public async executeWorkflow(request: CoupangWorkflowRequest): Promise<CoupangWorkflowResponse> {
    await this._checkPermission(Permission.USE_COUPANG_PARTNERS)

    try {
      // LangGraph workflow 생성
      const workflow = this._createWorkflowGraph()

      // 워크플로우 실행
      const result = await workflow.invoke({
        request,
      })

      if (result.error) {
        throw result.error
      }

      await this.jobLogsService.createJobLog('쿠팡 워크플로우 완료')

      return {
        blogLink: result.blogLink,
        commentText: result.commentText,
      }
    } finally {
      // 임시 작업 폴더 전체 삭제
      await this.jobLogsService.createJobLog('임시 작업 폴더 정리')
      await this._cleanupTempJobFolder()
    }
  }

  /**
   * LangGraph 워크플로우 그래프 생성
   */
  private _createWorkflowGraph() {
    const workflow = new StateGraph(WorkflowState)
      // 1. 블랙리스트 체크
      .addNode('checkBlacklist', async state => {
        await this.jobLogsService.createJobLog('1단계: 블랙리스트 체크')

        const galleryId = this._extractGalleryId(state.request.postUrl)
        if (galleryId) {
          const isBlacklisted = await this.monitoringService.isGalleryBlacklisted(galleryId)
          if (isBlacklisted) {
            await this.jobLogsService.createJobLog(`갤러리가 블랙리스트에 등록되어 있습니다: ${galleryId}`)
            throw new CoupangWorkflowErrorClass({
              code: 'BLACKLISTED_GALLERY',
              message: `갤러리가 블랙리스트에 등록되어 있어 쿠파스 작업을 중단합니다: ${galleryId}`,
            })
          }
          await this.jobLogsService.createJobLog(`블랙리스트 체크 완료: ${galleryId} - 정상`)
        }

        return {}
      })

      // 2. 디시인사이드 포스팅 크롤링 (리트라이 적용)
      .addNode(
        'crawlPost',
        async state => {
          await this.jobLogsService.createJobLog('2단계: 디시인사이드 포스팅 크롤링')
          const postData = await this.dcinsidePostingCrawlerService.crawlPostData(state.request.postUrl)
          return { postData }
        },
        {
          retryPolicy: { maxAttempts: 3, maxInterval: 2000 },
        },
      )

      // 3. AI를 통한 키워드 및 제목 생성 (리트라이 적용)
      .addNode(
        'generateKeywords',
        async state => {
          await this.jobLogsService.createJobLog('3단계: AI 검색 키워드 추출 및 블로그 제목 생성')
          const { searchKeywords, blogTitle } = await this._inferProductRecommendations(state.postData!)
          await this.jobLogsService.createJobLog(`추출된 검색 키워드: ${searchKeywords.join(', ')}`)
          await this.jobLogsService.createJobLog(`생성된 블로그 제목: ${blogTitle}`)
          return { searchKeywords, blogTitle }
        },
        {
          retryPolicy: { maxAttempts: 3, maxInterval: 2000 },
        },
      )

      // 4-1. 쿠팡 제품 검색 (병렬 처리, 리트라이 적용)
      .addNode(
        'searchProducts',
        async state => {
          await this.jobLogsService.createJobLog('4-1단계: 쿠팡 제품 검색')
          const productSearchMap = await this._searchProducts(state.searchKeywords)
          const totalSearchCount = Array.from(productSearchMap.values()).reduce((sum, list) => sum + list.length, 0)
          await this.jobLogsService.createJobLog(
            `검색된 제품 수: ${totalSearchCount}개 (${productSearchMap.size}개 키워드)`,
          )
          return { productSearchMap }
        },
        {
          retryPolicy: { maxAttempts: 3, maxInterval: 2000 },
        },
      )

      // 4-2. 어필리에이트 링크 생성 (순차 처리 + Rate Limiter 적용)
      .addNode(
        'createAffiliateLinks',
        async state => {
          await this.jobLogsService.createJobLog('4-2단계: 어필리에이트 링크 생성 (Rate Limiter 적용)')
          const searchResults = await this._createAffiliateLinks(state.searchKeywords, state.productSearchMap)
          const totalProductCount = searchResults.reduce((sum, result) => sum + result.제품목록.length, 0)
          await this.jobLogsService.createJobLog(
            `링크 생성 완료: ${totalProductCount}개 제품 (${searchResults.length}개 키워드)`,
          )
          return { searchResults }
        },
        {
          retryPolicy: { maxAttempts: 3, maxInterval: 2000 },
        },
      )

      // 5. 이미지 업로드
      .addNode('uploadImages', async state => {
        await this.jobLogsService.createJobLog('5단계: 워드프레스 이미지 업로드')
        const allProductImages = state.searchResults.flatMap(result =>
          result.제품목록.map(p => p.이미지).filter(Boolean),
        )
        const allImagePaths = [...(state.postData?.localImagePaths || []), ...allProductImages]
        const uploadedImageUrls = await this._uploadImagesToWordPress(allImagePaths, state.request.wordpressAccount)
        await this.jobLogsService.createJobLog(`업로드된 이미지 수: ${uploadedImageUrls.length}개`)
        return { uploadedImageUrls }
      })

      // 6. 워드프레스 컨텐츠 생성
      .addNode('buildContent', async state => {
        await this.jobLogsService.createJobLog('6단계: 워드프레스 컨텐츠 생성')
        const wpContent = this._buildWordPressContent(state.postData!, state.uploadedImageUrls, state.searchResults)
        return { wpContent }
      })

      // 7. 워드프레스 포스팅 발행
      .addNode('publishPost', async state => {
        await this.jobLogsService.createJobLog('7단계: 워드프레스 포스팅 발행')
        const publishResult = await this._publishToWordPress(
          state.blogTitle,
          state.wpContent,
          state.request.wordpressAccount as WordPressAccount,
        )

        const blogLink = this.buildShortLink(publishResult.postId, publishResult.url)
        await this.jobLogsService.createJobLog(`블로그 링크: ${blogLink}`)

        const commentText = this._generateCommentText(blogLink)

        return { blogLink, commentText }
      })

      // 8. 댓글 작업 생성
      .addNode('createCommentJob', async state => {
        await this.jobLogsService.createJobLog('8단계: 디시인사이드 댓글 작업 생성')
        await this._createCommentJob(state.request.postUrl, state.commentText, state.request)
        return {}
      })

      // 에지 연결
      .addEdge(START, 'checkBlacklist')
      .addEdge('checkBlacklist', 'crawlPost')
      .addEdge('crawlPost', 'generateKeywords')
      .addEdge('generateKeywords', 'searchProducts')
      .addEdge('searchProducts', 'createAffiliateLinks') // 추가: searchProducts → createAffiliateLinks
      .addEdge('createAffiliateLinks', 'uploadImages') // 수정: createAffiliateLinks → uploadImages
      .addEdge('uploadImages', 'buildContent')
      .addEdge('buildContent', 'publishPost')
      .addEdge('publishPost', 'createCommentJob')
      .addEdge('createCommentJob', END)

    return workflow.compile()
  }

  /**
   * 3단계: AI를 통한 쿠팡 검색 키워드 및 블로그 제목 생성 (LangChain + Gemini + LangSmith Prompt Hub 사용)
   */
  private async _inferProductRecommendations(
    postData: DcinsidePostData,
  ): Promise<{ searchKeywords: string[]; blogTitle: string }> {
    try {
      // 설정에서 이미지 포함 여부 확인
      const settings = await this.settingsService.getSettings()
      const includeImages = settings?.monitoring?.includeImagesInAiAnalysis ?? true // 쿠팡 워크플로우는 기본값 true

      // 이미지를 base64로 변환 (설정에 따라)
      let imageContents: any[] = []
      if (includeImages) {
        this.logger.log('AI 분석에 이미지를 포함합니다.')
        imageContents = await this._buildImageContentsForLangChain(postData)
      } else {
        this.logger.log('AI 분석에 이미지를 포함하지 않습니다.')
      }

      // LangSmith Prompt Hub에서 프롬프트 가져오기
      // 프롬프트 이름: "coupang-keyword-extraction"
      const prompt = await pull<ChatPromptTemplate>('coupang-keyword-extraction')
      this.logger.log('LangSmith에서 프롬프트를 가져왔습니다.')

      // 쿠파스 설정에서 키워드 최소/최대 개수 가져오기
      const keywordMin = settings?.coupas?.keywordMin ?? 2
      const keywordMax = settings?.coupas?.keywordMax ?? 5

      // StructuredOutputParser 사용 (OpenAI는 functionCalling 방식 지원)
      // LangChain OpenAI structured output type issue로 인해 any 타입 사용
      const structuredLlm: any = (this.llm as any).withStructuredOutput(
        z.object({
          검색키워드목록: z
            .array(z.string())
            .min(keywordMin)
            .max(keywordMax)
            .describe(`쿠팡에서 검색할 키워드 ${keywordMin}~${keywordMax}개`),
          블로그제목: z
            .string()
            .describe('목적성이 명확하고 SEO에 최적화된 블로그 제목 (예: "가성비 무선 헤드셋 추천", 30자 이내)'),
        }),
      )

      // 프롬프트 포맷팅
      const formattedMessages = await prompt.formatMessages({
        galleryName: postData.galleryName,
        title: postData.title,
        content: postData.content,
      })

      // 이미지 컨텐츠 추가 (설정에서 활성화된 경우에만)
      if (imageContents.length > 0) {
        // 마지막 메시지(user 메시지)에 이미지 추가
        const lastMessage = formattedMessages[formattedMessages.length - 1]
        if (lastMessage && typeof lastMessage.content === 'string') {
          lastMessage.content = [{ type: 'text' as const, text: lastMessage.content }, ...imageContents]
        }
      }

      // structuredLlm에 직접 invoke
      const response = await structuredLlm.invoke(formattedMessages)

      return {
        searchKeywords: response.검색키워드목록 || [],
        blogTitle: response.블로그제목 || postData.title,
      }
    } catch (error) {
      this.logger.error('AI 검색 키워드 추출 및 블로그 제목 생성 실패:', error)
      throw new CoupangWorkflowErrorClass({
        code: 'AI_RECOMMENDATION_FAILED',
        message: 'AI 검색 키워드 추출 및 블로그 제목 생성에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * LangChain용 이미지 컨텐츠 생성
   */
  private async _buildImageContentsForLangChain(postData: DcinsidePostData): Promise<any[]> {
    const imageContents: any[] = []

    if (postData.localImagePaths.length > 0) {
      try {
        for (let i = 0; i < postData.localImagePaths.length; i++) {
          const imagePath = postData.localImagePaths[i]
          try {
            if (fs.existsSync(imagePath)) {
              const imageBuffer = fs.readFileSync(imagePath)
              const base64 = imageBuffer.toString('base64')

              // 파일 확장자로 MIME 타입 결정
              const ext = path.extname(imagePath).toLowerCase()
              let mimeType = 'image/jpeg'
              if (ext === '.png') mimeType = 'image/png'
              else if (ext === '.gif') mimeType = 'image/gif'
              else if (ext === '.webp') mimeType = 'image/webp'

              imageContents.push({
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              })
            }
          } catch (error) {
            this.logger.warn(`이미지 ${i + 1} 처리 실패: ${imagePath}`, error)
          }
        }
      } catch (error) {
        this.logger.warn('이미지 처리 중 오류 발생:', error)
      }
    }

    return imageContents
  }

  /**
   * Step 1: 쿠팡에서 제품 검색 (순차 처리 - 1개 세션에서 이동)
   */
  private async _searchProducts(searchKeywords: string[]): Promise<
    Map<
      string,
      Array<{
        title: string
        url: string
        price: number
        image: string
        isRocket: boolean
        rocketBadgeUrl: string
        reviewCount: number
      }>
    >
  > {
    // 쿠파스 설정에서 키워드당 상품 최대 개수 가져오기
    const settings = await this.settingsService.getSettings()
    const productsPerKeyword = settings?.coupas?.productsPerKeyword ?? 1

    // 검색할 개수는 선택할 개수의 최소 2배 또는 최소 10개로 설정
    const searchCount = Math.max(10, productsPerKeyword * 2)

    const searchResultsMap = new Map<
      string,
      Array<{
        title: string
        url: string
        price: number
        image: string
        isRocket: boolean
        rocketBadgeUrl: string
        reviewCount: number
      }>
    >()

    // 각 키워드를 순차적으로 검색 (1개 세션에서 이동)
    for (const keyword of searchKeywords) {
      // 쿠팡에서 제품 검색 (설정값 기반, 최소 10개)
      const searchResults = await this.coupangCrawlerService.crawlProductList(keyword, searchCount)

      if (searchResults.length === 0) {
        this.logger.warn(`제품 검색 결과 없음: ${keyword}`)
        throw new CoupangWorkflowErrorClass({
          code: 'NO_SEARCH_RESULTS',
          message: `${keyword}: 제품 검색 결과 없음`,
          details: { keyword },
        })
      }

      await this.jobLogsService.createJobLog(`📦 ${keyword}: 검색 결과 ${searchResults.length}개 발견`)

      searchResultsMap.set(keyword, searchResults)
    }

    return searchResultsMap
  }

  /**
   * Step 2: 어필리에이트 링크 생성 (Rate Limiter 적용 - 1분당 최대 50회)
   */
  private async _createAffiliateLinks(
    searchKeywords: string[],
    searchResultsMap: Map<
      string,
      Array<{
        title: string
        url: string
        price: number
        image: string
        isRocket: boolean
        rocketBadgeUrl: string
        reviewCount: number
      }>
    >,
  ): Promise<CoupangSearchResult[]> {
    // 쿠파스 설정에서 키워드당 상품 최대 개수 가져오기
    const settings = await this.settingsService.getSettings()
    const productsPerKeyword = settings?.coupas?.productsPerKeyword ?? 1

    const results: CoupangSearchResult[] = []

    // 각 키워드를 순차적으로 처리 (Rate Limiter 적용)
    for (const keyword of searchKeywords) {
      const searchResults = searchResultsMap.get(keyword)
      if (!searchResults) continue

      const successfulProducts: CoupangProductResult[] = []

      // 랭킹 1위부터 순차적으로 시도하며, 설정값만큼의 제품이 성공할 때까지 반복
      for (let i = 0; i < searchResults.length && successfulProducts.length < productsPerKeyword; i++) {
        const product = searchResults[i]

        try {
          // ⏳ Rate Limiter: 토큰 획득 (대기 포함)
          await this.coupangRateLimiterService.acquireToken()

          // 쿠팡 파트너스 링크 생성
          const affiliateLink = await this.coupangPartnersService.createAffiliateLink(product.url)

          // 제품 이미지를 로컬에 다운로드
          let localImagePath = ''
          if (product.image) {
            try {
              localImagePath = await this._downloadProductImage(product.image)
            } catch (error) {
              this.logger.warn(`제품 이미지 다운로드 실패 (${keyword} - ${product.title}):`, error)
            }
          }

          successfulProducts.push({
            제품명: product.title,
            쿠파스링크: affiliateLink.shortenUrl,
            쿠팡링크: product.url,
            가격: product.price,
            이미지: localImagePath, // 로컬 경로 저장
            로켓배송: product.isRocket,
            로켓배송이미지: product.rocketBadgeUrl,
            리뷰수: product.reviewCount,
          })

          await this.jobLogsService.createJobLog(
            `✅ ${keyword}: ${i + 1}위 제품 링크 생성 성공 (총 ${successfulProducts.length}/${productsPerKeyword})`,
          )
        } catch (error) {
          this.logger.warn(`제품 처리 실패 (${keyword} - 랭킹 ${i + 1}위, ${product.title}):`, error)
          await this.jobLogsService.createJobLog(`❌ ${keyword}: ${i + 1}위 제품 링크 생성 실패, 다음 제품 시도`)
          // 다음 제품으로 계속 진행
          continue
        }
      }

      if (successfulProducts.length === 0) {
        throw new CoupangWorkflowErrorClass({
          code: 'ALL_PRODUCTS_FAILED',
          message: `${keyword}: 모든 제품 처리 실패`,
          details: { keyword, searchResultsCount: searchResults.length },
        })
      }

      await this.jobLogsService.createJobLog(`✅ ${keyword}: 최종 ${successfulProducts.length}개 제품 선정 완료`)

      results.push({
        검색어: keyword,
        제품목록: successfulProducts,
      })
    }

    return results
  }

  /**
   * 제품 이미지를 로컬에 다운로드
   */
  private async _downloadProductImage(imageUrl: string): Promise<string> {
    try {
      // jobId 기반 임시 디렉토리 생성
      const jobId = this.jobContextService.getJobId()
      const tempJobDir = path.join(EnvConfig.tempDir, jobId)
      if (!fs.existsSync(tempJobDir)) {
        fs.mkdirSync(tempJobDir, { recursive: true })
      }

      // 이미지 다운로드
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      })

      // 이미지 처리 및 WebP 변환
      const imageBuffer = Buffer.from(response.data)
      const processedImageBuffer = await sharp(imageBuffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()

      // 파일명 생성
      const timestamp = Date.now()
      const filename = `coupang_product_${timestamp}.webp`
      const filepath = path.join(tempJobDir, filename)

      // 파일 저장
      fs.writeFileSync(filepath, processedImageBuffer)

      return filepath
    } catch (error) {
      this.logger.error(`제품 이미지 다운로드 실패 (${imageUrl}):`, error)
      throw new CoupangWorkflowErrorClass({
        code: 'PRODUCT_IMAGE_DOWNLOAD_FAILED',
        message: '제품 이미지 다운로드에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 워드프레스에 이미지 업로드
   */
  private async _uploadImagesToWordPress(
    imagePaths: string[],
    wordpressAccount: CoupangWorkflowRequest['wordpressAccount'],
  ): Promise<string[]> {
    const uploadedImageUrls: string[] = []

    for (const imagePath of imagePaths) {
      try {
        const imageUrl = await this.wordpressApiService.uploadImage(wordpressAccount as WordPressAccount, imagePath)
        uploadedImageUrls.push(imageUrl)
      } catch (error) {
        this.logger.warn(`이미지 업로드 실패: ${imagePath}`, error)
      }
    }

    return uploadedImageUrls
  }

  /**
   * 워드프레스 포스팅 발행
   */
  private async _publishToWordPress(
    title: string,
    content: string,
    wordpressAccount: WordPressAccount,
  ): Promise<{ postId: number; url: string }> {
    try {
      const result = await this.wordpressApiService.publishPost(wordpressAccount, {
        title,
        content,
        status: 'publish',
      })

      return result
    } catch (error) {
      this.logger.error('워드프레스 포스팅 발행 실패:', error)
      throw new CoupangWorkflowErrorClass({
        code: 'WORDPRESS_PUBLISH_FAILED',
        message: '워드프레스 포스팅 발행에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * Short 링크 생성
   */
  private buildShortLink(postId: number, originalUrl: string): string {
    const url = new URL(originalUrl)
    return `${url.protocol}//${url.host}/?p=${postId}`
  }

  /**
   * 워드프레스 포스트 HTML 컨텐츠 생성 (검색어별 h2 + ul/li 구조)
   */
  private _buildWordPressContent(
    postData: DcinsidePostData,
    uploadedImageUrls: string[],
    searchResults: CoupangSearchResult[],
  ): string {
    let content = ''

    // 쿠팡 파트너스 안내 문구 추가
    content += `
      <div class="coupang-announce" style="background-color: #e3f2fd !important; border-left: 4px solid #2196f3 !important; padding: 12px 16px !important; margin: 16px 0 !important; border-radius: 4px !important; color: #1565c0 !important; font-size: 14px !important; line-height: 1.5 !important;">
        이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </div>
    `

    // 각 검색어별로 h2 + ul/li 구조로 제품 표시
    let imageIndex = postData.localImagePaths.length // DC 이미지 이후부터 시작

    for (const searchResult of searchResults) {
      if (searchResult.제품목록.length === 0) continue

      content += `<h2>${searchResult.검색어}</h2>`
      content += `<ul style="list-style: none; padding: 0; margin: 20px 0;">`

      for (const product of searchResult.제품목록) {
        const productImageUrl = uploadedImageUrls[imageIndex] || product.이미지
        imageIndex++

        content += `
          <li style="border: 1px solid #e1e5e9; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <a href="${product.쿠파스링크}" target="_blank" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 16px;">
              <div style="flex-shrink: 0;">
                <img src="${productImageUrl}" alt="${product.제품명}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 4px;" />
              </div>
              <div style="flex: 1;">
                <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #333; line-height: 1.4;">${product.제품명}</h4>
                <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: bold; color: #ff6b6b;">${product.가격.toLocaleString()}원</p>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                  <div>
                    ${product.로켓배송이미지 ? `<img src="${product.로켓배송이미지}" alt="로켓배송" style="height: 16px; width: inherit;\" />` : ''}
                  </div>
                  <div>
                    ${product.리뷰수 > 0 ? `<span style="display: inline-block; color: #666; font-size: 13px;">⭐ 리뷰 ${product.리뷰수.toLocaleString()}개</span>` : ''}
                  </div>
                </div>
              </div>
            </a>
          </li>
        `
      }

      content += `</ul>`
    }

    return content
  }

  /**
   * 7단계: 댓글 텍스트 생성
   */
  private _generateCommentText(blogLink: string): string {
    let commentText = '이거 ㄱㄱ\n'
    // URL safe 인코딩
    const encodedBlogLink = blogLink
    commentText += `${encodedBlogLink}`

    return commentText
  }

  /**
   * 8단계: 디시인사이드에 댓글 작업 생성
   */
  private async _createCommentJob(
    postUrl: string,
    commentText: string,
    request: CoupangWorkflowRequest,
  ): Promise<void> {
    try {
      await this.commentJobService.createJobWithCommentJob({
        keyword: '쿠팡 워크플로우',
        comment: commentText,
        postUrls: [postUrl],
        nickname: request.nickname,
        password: request.password,
        loginId: request.loginId,
        loginPassword: request.loginPassword,
        status: JobStatus.REQUEST,
      })
      await this.jobLogsService.createJobLog('디시인사이드 댓글 작업 생성 완료')
    } catch (error) {
      this.logger.error('디시인사이드 댓글 작업 생성 실패:', error)
      throw new CoupangWorkflowErrorClass({
        code: 'DCINSIDE_COMMENT_JOB_CREATION_FAILED',
        message: '디시인사이드 댓글 작업 생성에 실패했습니다.',
        details: error,
      })
    }
  }

  /**
   * 임시 작업 폴더 전체 삭제
   */
  private async _cleanupTempJobFolder(): Promise<void> {
    try {
      const jobId = this.jobContextService.getJobId()
      const tempJobDir = path.join(EnvConfig.tempDir, jobId)
      if (fs.existsSync(tempJobDir)) {
        fs.rmSync(tempJobDir, { recursive: true, force: true })
        this.logger.log(`임시 작업 폴더 삭제: ${tempJobDir}`)
      }
    } catch (error) {
      this.logger.error('임시 작업 폴더 삭제 실패:', error)
    }

    // dcinside-images 임시 폴더도 삭제
    try {
      const dcinsideImagesDir = path.join(EnvConfig.tempDir, 'dcinside-images')
      if (fs.existsSync(dcinsideImagesDir)) {
        fs.rmSync(dcinsideImagesDir, { recursive: true, force: true })
        this.logger.log(`디시인사이드 이미지 임시 폴더 삭제: ${dcinsideImagesDir}`)
      }
    } catch (error) {
      this.logger.error('디시인사이드 이미지 임시 폴더 삭제 실패:', error)
    }
  }

  /**
   * 권한 체크
   */
  private async _checkPermission(permission: Permission): Promise<void> {
    const settings = await this.settingsService.getSettings()
    assertPermission(settings.licenseCache, permission)
  }

  /**
   * URL에서 갤러리 ID 추출
   */
  private _extractGalleryId(url: string): string | null {
    try {
      const match = url.match(/[?&]id=([^&]+)/)
      return match ? match[1] : null
    } catch (error) {
      this.logger.warn('갤러리 ID 추출 실패:', error)
      return null
    }
  }
}
