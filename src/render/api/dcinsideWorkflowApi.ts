import { api } from './apiClient'

export async function uploadDcinsideExcel(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post('/dcinside/workflow/posting/excel-upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return res
}
