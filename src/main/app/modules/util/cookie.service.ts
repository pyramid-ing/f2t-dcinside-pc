import * as fs from 'node:fs'
import * as path from 'node:path'
import { Injectable } from '@nestjs/common'

@Injectable()
export class CookieService {
  private getCookieDir(serviceName: string): string {
    const dir = path.join(process.env.COOKIE_DIR || path.join(process.cwd(), 'static', 'cookies'), serviceName)

    return dir
  }

  getCookiePath(serviceName: string, id: string): string {
    const safeId = id.replace(/[^\w\-]/g, '_')
    const dir = this.getCookieDir(serviceName)

    return path.join(dir, `${safeId}.json`)
  }

  saveCookies(serviceName: string, id: string, cookies: any): void {
    const filePath = this.getCookiePath(serviceName, id)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2), 'utf-8')
  }

  loadCookies(serviceName: string, id: string): any[] | null {
    const filePath = this.getCookiePath(serviceName, id)
    if (!fs.existsSync(filePath)) return null
    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data)
  }

  deleteCookies(serviceName: string, id: string): void {
    const filePath = this.getCookiePath(serviceName, id)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  }
}
