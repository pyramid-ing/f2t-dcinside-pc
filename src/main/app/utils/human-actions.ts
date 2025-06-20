import type { ElementHandle, Page } from 'puppeteer-core'
import { createCursor } from 'ghost-cursor'

export async function humanClick(page: Page, target: string | ElementHandle) {
  const cursor = createCursor(page)
  await cursor.move(target)
  await cursor.click()
}

/**
 * 사람처럼 보이는 타이핑 (랜덤 딜레이, 오타/백스페이스 포함)
 * @param page puppeteer Page
 * @param selector input/textarea 셀렉터
 * @param text 입력할 텍스트
 * @param typoChance 오타 확률 (0~1, 기본 0.05)
 */
export async function humanType(page: Page, selector: string, text: string, typoChance = 0.05) {
  await page.focus(selector)
  for (const char of text) {
    // 오타 확률
    if (Math.random() < typoChance) {
      const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26))
      await page.keyboard.type(wrongChar, { delay: 50 + Math.random() * 100 })
      await page.keyboard.press('Backspace')
    }
    await page.keyboard.type(char, { delay: 80 + Math.random() * 120 })
  }
}
