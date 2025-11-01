/**
 * 댓글 선택 유틸리티
 */

export class CommentSelector {
  private currentIndex = 0

  /**
   * 랜덤으로 댓글 선택
   */
  selectRandom(comments: string[]): string | null {
    if (!comments || comments.length === 0) {
      return null
    }

    const randomIndex = Math.floor(Math.random() * comments.length)
    return comments[randomIndex]
  }

  /**
   * 순차적으로 댓글 선택
   */
  selectSequential(comments: string[]): string | null {
    if (!comments || comments.length === 0) {
      return null
    }

    const selected = comments[this.currentIndex]
    this.currentIndex = (this.currentIndex + 1) % comments.length
    return selected
  }

  /**
   * 설정에 따라 댓글 선택
   */
  select(comments: string[], method: 'random' | 'sequential'): string | null {
    if (method === 'random') {
      return this.selectRandom(comments)
    } else {
      return this.selectSequential(comments)
    }
  }

  /**
   * 댓글에 접두어와 접미사를 랜덤으로 조합
   * @param comment 기본 댓글 내용
   * @param prefixes 접두어 목록
   * @param suffixes 접미사 목록
   * @returns 조합된 댓글 (예: "좋은 정보 감사합니다!")
   */
  combineWithTemplates(comment: string, prefixes?: string[], suffixes?: string[]): string {
    let result = comment

    // 접두어 추가 (있을 경우)
    if (prefixes && prefixes.length > 0) {
      const randomPrefix = this.selectRandom(prefixes)
      if (randomPrefix) {
        result = `${randomPrefix} ${result}`
      }
    }

    // 접미사 추가 (있을 경우)
    if (suffixes && suffixes.length > 0) {
      const randomSuffix = this.selectRandom(suffixes)
      if (randomSuffix) {
        result = `${result} ${randomSuffix}`
      }
    }

    return result
  }

  /**
   * 현재 인덱스 리셋
   */
  reset(): void {
    this.currentIndex = 0
  }
}
