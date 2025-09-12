import { Permission } from '@main/app/modules/auth/auth.guard'

export interface Settings {
  showBrowserWindow: boolean // 창보임/창숨김 모드 (true = 창보임, false = 창숨김)
  reuseWindowBetweenTasks: boolean // 작업 간 브라우저 창 재사용 여부 (true = 창 유지, false = 매번 새 창)
  taskDelay: number // 작업간 딜레이 (초)
  actionDelay: number // 포스팅 과정 중 각 동작 사이의 딜레이 (초)
  imageUploadFailureAction: 'fail' | 'skip' // 이미지 업로드 실패 시 처리 방식 ('fail' = 작업 실패, 'skip' = 이미지 무시하고 진행)
  openAIApiKey: string
  /** 2captcha API 키 */
  twoCaptchaApiKey?: string
  licenseKey?: string // 라이센스 키
  /**
   * 라이센스 캐시 정보
   */
  licenseCache?: {
    isValid: boolean // 라이센스 유효성
    permissions: Permission[] // 권한 목록
    expiresAt?: number // 만료 시간 (timestamp)
  }
  /**
   * 프록시 목록
   * 예: [{ ip: '1.2.3.4', port: 8080, id: 'user', pw: 'pass' }]
   */
  proxies?: {
    ip: string
    port: number
    id?: string
    pw?: string
  }[]
  /**
   * 프록시 변경 방식 (예: 'random', 'sequential', 'fixed')
   */
  proxyChangeMethod?: 'random' | 'sequential' | 'fixed'
  /** 프록시 사용 여부 */
  proxyEnabled?: boolean

  /**
   * IP 변경 모드
   * - none: 변경 안 함
   * - proxy: 프록시 사용
   * - tethering: 안드로이드 USB 테더링으로 변경
   */
  ipMode?: IpMode

  /**
   * 테더링 설정
   */
  tethering?: {
    changeInterval?: {
      type: TetheringChangeType // 변경 주기 타입
      timeMinutes?: number // 시간 기반: 마지막 변경 후 N분이 지나면 변경 (기본 30분)
      postCount?: number // 포스팅 수 기반: N개 포스팅 후 변경 (기본 5개)
    }
  }
}

export enum IpMode {
  NONE = 'none',
  PROXY = 'proxy',
  TETHERING = 'tethering',
}

export enum TetheringChangeType {
  TIME = 'time',
  COUNT = 'count',
}
