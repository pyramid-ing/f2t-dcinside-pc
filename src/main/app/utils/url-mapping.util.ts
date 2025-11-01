/**
 * URL 매핑 유틸리티 함수들
 */

/**
 * 발행된 포스트의 URL을 사용자가 설정한 커스텀 도메인으로 매핑
 * @param originalUrl 원본 URL
 * @param customDomainUrl 커스텀 도메인 URL
 * @param options 매핑 옵션
 * @returns 매핑된 URL 또는 원본 URL
 */
export function mapPublishedUrl(
  originalUrl: string | null,
  customDomainUrl: string,
  options?: {
    skipDefaultDomain?: boolean // 기본 도메인인 경우 매핑 건너뛰기 (티스토리용)
  },
): string | null {
  if (!originalUrl) return originalUrl

  try {
    const current = new URL(originalUrl)
    const base = new URL(customDomainUrl)

    // 기본 도메인 체크 (티스토리용)
    if (options?.skipDefaultDomain) {
      if (base.host === 'tistory.com' || base.host.includes('tistory.com')) {
        return originalUrl
      }
    }

    // 커스텀 도메인으로 새로운 URL 생성
    const mappedUrl = `${base.protocol}//${base.host}${current.pathname}${current.search}${current.hash}`

    return mappedUrl
  } catch (error) {
    console.warn(`URL 매핑 실패, 원본 URL 사용: ${error.message}`)
    return originalUrl
  }
}
