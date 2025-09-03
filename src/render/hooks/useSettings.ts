import { useCallback } from 'react'
import { useRecoilState } from 'recoil'
import { message } from 'antd'
import { settingsErrorState, settingsLoadingState, settingsSavingState, settingsState } from '@render/atoms/settings'
import { Settings } from '@render/types/settings'
import { getSettings, updateSettings as apiUpdateSettings } from '@render/api/settingsApi'

export const useSettings = () => {
  const [settings, setSettings] = useRecoilState(settingsState)
  const [isLoading, setIsLoading] = useRecoilState(settingsLoadingState)
  const [error, setError] = useRecoilState(settingsErrorState)
  const [isSaving, setIsSaving] = useRecoilState(settingsSavingState)

  // 설정 로드
  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getSettings()
      setSettings(data)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '설정을 불러오는데 실패했습니다.'
      setError(errorMessage)
      message.error(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [setSettings, setIsLoading, setError])

  // 설정 업데이트 (전체)
  const updateSettings = useCallback(
    async (newSettings: Settings) => {
      setIsSaving(true)
      setError(null)
      try {
        // 서버에 설정 업데이트
        await apiUpdateSettings(newSettings)

        // 업데이트 후 최신 설정을 다시 가져옴
        const updatedSettings = await getSettings()
        setSettings(updatedSettings)

        message.success('설정이 저장되었습니다.')
        return updatedSettings
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '설정 저장에 실패했습니다.'
        setError(errorMessage)
        message.error(errorMessage)
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [setSettings, setIsSaving, setError],
  )

  // 부분 설정 업데이트
  const updatePartialSettings = useCallback(
    async (partialSettings: Partial<Settings>) => {
      setIsSaving(true)
      setError(null)
      try {
        // 현재 설정을 가져와서 병합
        const currentSettings = await getSettings()
        const newSettings = { ...currentSettings, ...partialSettings }

        // 서버에 설정 업데이트
        await apiUpdateSettings(newSettings)

        // 업데이트 후 최신 설정을 다시 가져옴
        const updatedSettings = await getSettings()
        setSettings(updatedSettings)

        message.success('설정이 저장되었습니다.')
        return updatedSettings
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '설정 저장에 실패했습니다.'
        setError(errorMessage)
        message.error(errorMessage)
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [setSettings, setIsSaving, setError],
  )

  return {
    settings,
    isLoading,
    isSaving,
    error,
    loadSettings,
    updateSettings,
    updatePartialSettings,
    setSettings,
  }
}
