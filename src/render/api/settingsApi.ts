import { api } from './apiClient'
import { Settings } from '@render/types/settings'

export async function validateOpenAIApiKey(apiKey: string) {
  const res = await api.post('/api/settings/validate-openai-key', { apiKey })
  return { success: true, data: res.data }
}

export async function validateTwoCaptchaApiKey(apiKey: string) {
  const res = await api.post('/api/settings/validate-2captcha-key', { apiKey })
  return { success: true, data: res.data }
}

export const getSettings = async (): Promise<Settings> => {
  const response = await api.get('/api/settings')
  return response.data
}

export const updateSettings = async (settings: Partial<Settings>): Promise<Settings> => {
  const response = await api.post('/api/settings', settings)
  return response.data
}

export const uploadProxyExcel = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post('/api/settings/proxies/upload-excel', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return res.data as { success: boolean; count?: number; message?: string }
}

export const downloadProxySampleExcel = async (): Promise<Blob> => {
  const res = await api.get('/api/settings/proxies/sample-excel', { responseType: 'blob' })
  return res.data as Blob
}

export const checkTetheringConnection = async (): Promise<{
  adbFound: boolean
  connected: boolean
  output: string
}> => {
  const res = await api.post('/api/settings/tethering/check-connection')
  return res.data
}

export const changeIp = async (): Promise<{
  success: boolean
  previousIp: string
  newIp: string
  changed: boolean
}> => {
  const res = await api.post('/api/settings/tethering/change-ip')
  return res.data
}
