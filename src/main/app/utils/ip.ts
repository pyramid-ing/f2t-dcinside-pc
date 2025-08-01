import { Page } from 'playwright'

/**
 * Playwright page를 이용해 외부(공인) IP를 조회한다.
 * @param page Playwright Page 인스턴스
 * @returns string (외부 IP)
 */
export async function getExternalIp(page: Page): Promise<string> {
  try {
    await page.goto('https://api.ipify.org', { waitUntil: 'domcontentloaded', timeout: 15000 })
    const ip = await page.evaluate(() => document.body.textContent?.trim() || '')
    if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
      throw new Error('IP 형식이 올바르지 않습니다.')
    }
    return ip
  } catch (e) {
    throw new Error('외부 IP 조회 실패: ' + (e instanceof Error ? e.message : e))
  }
}
