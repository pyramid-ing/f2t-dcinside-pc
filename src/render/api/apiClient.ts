import axios from 'axios'
import { errorNormalizer } from './errorHelpers'

const API_BASE_URL = 'http://localhost:3554'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.response.use(
  r => r,
  e => {
    // 공통 에러 처리(예: 401 자동 로그아웃 등) 가능
    // ...
    return Promise.reject(errorNormalizer(e))
  },
)
