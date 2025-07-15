import { api } from './apiClient'
import { Settings } from '@render/types/settings'

export async function validateOpenAIApiKey(apiKey: string) {
  const res = await api.post('/settings/validate-openai-key', { apiKey })
  return { success: true, data: res.data }
}

export const getSettings = async (): Promise<Settings> => {
  const response = await api.get('/settings')
  return response.data
}

export const updateSettings = async (settings: Partial<Settings>): Promise<Settings> => {
  const response = await api.post('/settings', settings)
  return response.data
}
