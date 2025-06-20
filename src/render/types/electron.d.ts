export interface UpdateInfo {
  version: string
  releaseNotes?: string
}

export interface DownloadProgress {
  percent: number
  transferred: number
  total: number
}

export interface UpdateResult {
  updateInfo?: any
  message: string
  error?: string
}

export interface IElectronAPI {
  getBackendPort: () => Promise<number>
  openExternal: (url: string) => void
  
  // 앱 정보 API
  getAppVersion: () => Promise<string>
  
  // 업데이트 관련 API
  checkForUpdates: () => Promise<UpdateResult>
  downloadUpdate: () => Promise<UpdateResult>
  installUpdate: () => Promise<UpdateResult>
  
  // 업데이트 이벤트 리스너
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => void
  removeAllListeners: (channel: string) => void
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
    global: Window & typeof globalThis
  }
}

declare let global: Window & typeof globalThis
