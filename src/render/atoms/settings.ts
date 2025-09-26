import { atom } from 'recoil'
import { Settings } from '@render/types/settings'

// 기본 설정값
const defaultSettings: Settings = {
  actionDelay: 0,
  imageUploadFailureAction: undefined,
  openAIApiKey: '',
  showBrowserWindow: false,
  taskDelay: 0,
  reuseWindowBetweenTasks: false,
}

// 설정 상태 atom
export const settingsState = atom<Settings>({
  key: 'settingsState',
  default: defaultSettings,
})

// 로딩 상태 atom
export const settingsLoadingState = atom<boolean>({
  key: 'settingsLoadingState',
  default: false,
})

// 에러 상태 atom
export const settingsErrorState = atom<string | null>({
  key: 'settingsErrorState',
  default: null,
})

// 설정 저장 중 상태 atom
export const settingsSavingState = atom<boolean>({
  key: 'settingsSavingState',
  default: false,
})
