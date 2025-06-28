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
