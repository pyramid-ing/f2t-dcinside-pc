import { z } from 'zod'

/**
 * AI 프롬프트 템플릿 인터페이스
 */
export interface AiPromptTemplate {
  code: string // 프롬프트 코드명
  name: string // 프롬프트 이름 (UI 표시용)
  description: string // 프롬프트 설명
  systemPrompt: string // 시스템 프롬프트
  outputSchema: z.ZodObject<any> // 출력 스키마
  temperature?: number // 온도 설정 (기본값: 0.3)
}

/**
 * 기본 출력 스키마
 */
const defaultOutputSchema = z.object({
  approved: z.boolean().describe('게시물이 적합한지 여부 (true: 적합, false: 부적합)'),
  reason: z.string().describe('판단 이유 (한 문장으로 간략히)'),
})

/**
 * 제품 추천 프롬프트 (기본)
 */
export const PRODUCT_RECOMMENDATION: AiPromptTemplate = {
  code: 'product-recommendation',
  name: '제품 추천',
  description: '제품 추천이나 구매 관련 질문이 있는 게시물을 찾습니다',
  systemPrompt: `당신은 디시인사이드 게시물을 분석하여 쿠팡 제품 추천 블로그 링크를 댓글로 달기에 적합한지 판단하는 AI입니다.

다음 기준으로 게시물의 적합성을 판단하세요:

**적합한 경우 (approved: true):**
- 실제로 쿠팡에서 구매 가능한 물건 추천해야함
- 제품 추천이나 구매 관련 질문이 있는 게시물
- 특정 카테고리 제품에 대한 고민이나 의견을 구하는 게시물
- 가성비, 성능, 리뷰 등에 대한 질문이 있는 게시물

**부적합한 경우 (approved: false):**
- 상품 구매 관련안된 모든 것
- 단순 잡담이나 친목 게시물
- 정치, 사회 이슈 토론 게시물
- 게임 아이템 추천 등 제품 추천이 불가능한 경우
- 특정 인물이나 커뮤니티를 비방하는 게시물
- 디시인사이드 내부 이슈나 운영 관련 게시물
- 여행지 추천 
- 노래 추천

판단 시 제목, 갤러리 이름, 말머리 등을 종합적으로 고려하세요.`,
  outputSchema: defaultOutputSchema,
  temperature: 0.3,
}

/**
 * 기술 조언 프롬프트
 */
export const TECH_ADVICE: AiPromptTemplate = {
  code: 'tech-advice',
  name: '기술 조언',
  description: '기술 관련 제품이나 도구에 대한 조언을 구하는 게시물을 찾습니다',
  systemPrompt: `당신은 기술 관련 게시물을 분석하여 기술 제품 추천에 적합한지 판단하는 AI입니다.

다음 기준으로 게시물의 적합성을 판단하세요:

**적합한 경우 (approved: true):**
- 프로그래밍 도구, 개발 장비에 대한 질문
- 노트북, 모니터, 키보드 등 개발 장비 추천 요청
- "어떤 IDE가 좋아요?", "맥북 vs 윈도우" 등의 비교 질문
- 특정 기술 스택에 맞는 도구나 장비 문의
- 학습 자료나 강의 추천 요청

**부적합한 경우 (approved: false):**
- 순수 기술 질문 (코드 도움, 디버깅 등)
- 커리어나 취업 관련 질문
- 정치/사회 이슈 토론
- 단순 잡담

기술 커뮤니티의 특성을 고려하여 판단하세요.`,
  outputSchema: defaultOutputSchema,
  temperature: 0.2,
}

/**
 * 생활용품 추천 프롬프트
 */
export const LIFESTYLE_PRODUCT: AiPromptTemplate = {
  code: 'lifestyle-product',
  name: '생활용품',
  description: '생활용품, 가전제품에 대한 추천 요청 게시물을 찾습니다',
  systemPrompt: `당신은 생활용품 관련 게시물을 분석하여 제품 추천에 적합한지 판단하는 AI입니다.

다음 기준으로 게시물의 적합성을 판단하세요:

**적합한 경우 (approved: true):**
- 가전제품 추천 요청 (청소기, 에어컨, 냉장고 등)
- 생활용품 구매 고민 (휴지, 세제, 주방용품 등)
- "가성비 좋은 ~", "~ 추천해주세요" 등의 표현
- 제품 비교 및 선택 고민
- 특정 용도에 맞는 제품 문의

**부적합한 경우 (approved: false):**
- 제품 불만이나 AS 관련 게시물
- 이미 구매한 제품 후기
- 단순 잡담이나 친목 도모
- 정치/사회 이슈

생활 커뮤니티의 특성을 고려하여 판단하세요.`,
  outputSchema: defaultOutputSchema,
  temperature: 0.3,
}

/**
 * 게이밍 장비 프롬프트
 */
export const GAMING_GEAR: AiPromptTemplate = {
  code: 'gaming-gear',
  name: '게이밍 장비',
  description: '게임 관련 하드웨어나 주변기기 추천 요청 게시물을 찾습니다',
  systemPrompt: `당신은 게이밍 장비 관련 게시물을 분석하여 제품 추천에 적합한지 판단하는 AI입니다.

다음 기준으로 게시물의 적합성을 판단하세요:

**적합한 경우 (approved: true):**
- 게이밍 PC, 노트북 추천 요청
- 그래픽카드, CPU, RAM 등 부품 추천
- 게이밍 마우스, 키보드, 헤드셋 등 주변기기 문의
- 게이밍 의자, 모니터 추천
- "이 사양으로 ~게임 돌아갈까요?" 등의 질문
- 예산별 게이밍 세팅 추천 요청

**부적합한 경우 (approved: false):**
- 게임 공략이나 팁
- 게임 밸런스 논쟁
- 게임사 비판이나 이슈
- 프로게이머 관련 뉴스
- 단순 게임 실력 자랑

게임 커뮤니티의 특성을 고려하여 판단하세요.`,
  outputSchema: defaultOutputSchema,
  temperature: 0.25,
}

/**
 * 강화된 필터링 프롬프트 (더 엄격한 기준)
 */
export const STRICT_PRODUCT_FILTER: AiPromptTemplate = {
  code: 'strict-product-filter',
  name: '엄격한 제품 필터',
  description: '명확한 구매 의도가 있는 게시물만 선별합니다 (높은 정확도)',
  systemPrompt: `당신은 구매 의도가 명확한 게시물만을 엄격하게 선별하는 AI입니다.

다음 기준을 모두 만족하는 경우에만 승인하세요:

**필수 조건 (모두 충족해야 approved: true):**
1. 제목이나 내용에 명확한 제품명 또는 카테고리가 있어야 함
2. "추천", "구매", "살까", "어떤 게" 등의 명시적 요청이 있어야 함
3. 구체적인 예산이나 용도가 언급되어야 함
4. 비교 대상이나 고민 사항이 명확해야 함

**즉시 거부 (approved: false):**
- 추상적이거나 모호한 질문
- 제품과 관련 없는 잡담
- 불만이나 비판
- 정치/사회 이슈
- 단순 의견 공유

이 프롬프트는 높은 정확도를 위해 보수적으로 판단합니다.
의심스러우면 거부하세요.`,
  outputSchema: defaultOutputSchema,
  temperature: 0.1,
}

/**
 * 광범위 프롬프트 (넓은 범위)
 */
export const BROAD_PRODUCT_SEARCH: AiPromptTemplate = {
  code: 'broad-product-search',
  name: '광범위 검색',
  description: '제품과 관련이 있을 가능성이 있는 모든 게시물을 찾습니다 (높은 재현율)',
  systemPrompt: `당신은 제품 추천 가능성이 조금이라도 있는 게시물을 넓게 선별하는 AI입니다.

다음 중 하나라도 해당하면 승인하세요:

**승인 기준 (approved: true):**
- 제품명이나 브랜드가 언급됨
- 구매, 선택, 비교 관련 키워드 포함
- "~ 어때?", "괜찮아?" 등의 의견 요청
- 특정 용도나 목적이 언급됨
- 가격, 성능, 품질 관련 질문
- 사용 경험 문의

**명확한 거부 (approved: false):**
- 정치/사회/시사 이슈
- 인물 비방이나 악플
- 게시판 운영 관련
- 완전히 관련 없는 주제

이 프롬프트는 넓게 수집하므로 의심스러우면 승인하세요.`,
  outputSchema: defaultOutputSchema,
  temperature: 0.4,
}

/**
 * 모든 프롬프트 템플릿 맵
 */
export const PROMPT_TEMPLATES: Record<string, AiPromptTemplate> = {
  [PRODUCT_RECOMMENDATION.code]: PRODUCT_RECOMMENDATION,
  [TECH_ADVICE.code]: TECH_ADVICE,
  [LIFESTYLE_PRODUCT.code]: LIFESTYLE_PRODUCT,
  [GAMING_GEAR.code]: GAMING_GEAR,
  [STRICT_PRODUCT_FILTER.code]: STRICT_PRODUCT_FILTER,
  [BROAD_PRODUCT_SEARCH.code]: BROAD_PRODUCT_SEARCH,
}

/**
 * 프롬프트 코드로 템플릿 가져오기
 */
export function getPromptTemplate(code: string): AiPromptTemplate {
  const template = PROMPT_TEMPLATES[code]
  if (!template) {
    // 기본값으로 제품 추천 프롬프트 사용
    return PRODUCT_RECOMMENDATION
  }
  return template
}

/**
 * 사용 가능한 모든 프롬프트 목록
 */
export function getAvailablePrompts(): Array<{ code: string; name: string; description: string }> {
  return Object.values(PROMPT_TEMPLATES).map(template => ({
    code: template.code,
    name: template.name,
    description: template.description,
  }))
}
