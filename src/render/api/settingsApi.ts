import type { AppSettings } from '../types/settings'
import { api } from './apiClient'
import { errorNormalizer } from './errorHelpers'
import type { NormalizedError } from './error.type'

export async function saveOpenAIApiKeyToServer(key: string): Promise<{ success: true; data: any } | NormalizedError> {
  try {
    const res = await api.post('/settings/global', { openAIApiKey: key })
    return { success: true, data: res.data }
  } catch (e) {
    return errorNormalizer(e)
  }
}

export async function getOpenAIApiKeyFromServer(): Promise<{ success: true; data: string } | NormalizedError> {
  try {
    const res = await api.get('/settings/global')
    return { success: true, data: res.data?.data?.openAIApiKey || '' }
  } catch (e) {
    return errorNormalizer(e)
  }
}

export async function validateOpenAIApiKey(
  apiKey: string,
): Promise<{ success: true; data: { valid: boolean; error?: string; model?: string } } | NormalizedError> {
  try {
    const res = await api.post('/settings/validate-openai-key', { apiKey })
    return { success: true, data: res.data }
  } catch (e) {
    return errorNormalizer(e)
  }
}

export async function saveAppSettingsToServer(
  settings: AppSettings,
): Promise<{ success: true; data: any } | NormalizedError> {
  try {
    const res = await api.post('/settings/app', settings)
    return { success: true, data: res.data }
  } catch (e) {
    return errorNormalizer(e)
  }
}

export async function getAppSettingsFromServer(): Promise<{ success: true; data: AppSettings } | NormalizedError> {
  try {
    const res = await api.get('/settings/app')
    return { success: true, data: res.data?.data || { showBrowserWindow: true, taskDelay: 10 } }
  } catch (e) {
    return errorNormalizer(e)
  }
}
