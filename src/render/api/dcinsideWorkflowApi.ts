import { api } from './apiClient'
import { errorNormalizer } from './errorHelpers'
import type { NormalizedError } from './error.type'

export async function uploadDcinsideExcel(file: File): Promise<{ success: true; data: any } | NormalizedError> {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await api.post('/dcinside/workflow/posting/excel-upload', formData)
    return { success: true, data: res.data }
  } catch (e) {
    return errorNormalizer(e)
  }
}
