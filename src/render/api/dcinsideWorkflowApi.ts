import { api } from './apiClient'

export async function uploadDcinsideExcel(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post('/api/dcinside/workflow/posting/upload-excel', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return res
}
