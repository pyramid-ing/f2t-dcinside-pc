interface UpdateInfo {
  version: string
  releaseNotes?: string
}

interface DownloadProgress {
  percent: number
  transferred: number
  total: number
}

interface UpdateResult {
  updateInfo?: any
  message: string
  error?: string
}

declare global {
  interface Window {
    electronAPI: {
      getBackendPort: () => Promise<number>
      openExternal: (url: string) => Promise<void>
      
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
  }
}

export {}
