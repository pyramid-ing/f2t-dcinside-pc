import { authApi } from '@render/api'
import { Tabs } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import OpenAISettingsForm from './OpenAISettingsForm'
import TwoCaptchaSettingsForm from './TwoCaptchaSettingsForm'
import SettingsForm from './SettingsForm'
import IpSettingsForm from './ip/IpSettingsForm'
import WordPressSettingsForm from './WordPressSettingsForm'
import CoupangPartnersSettingsForm from './CoupangPartnersSettingsForm'
import JobSettingsForm from './JobSettingsForm'
import { usePermissions } from '@render/hooks/usePermissions'
import { Permission } from '@render/types/permissions'

const SettingsTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('app')
  const [machineId, setMachineId] = useState<string>('')
  const { canAccess } = usePermissions()
  const hasCoupasPermission = canAccess(Permission.COUPAS)

  const fetchMachineId = useCallback(async () => {
    try {
      const { machineId } = await authApi.getMachineId()
      setMachineId(machineId)
    } catch (error) {
      console.error('Error fetching machine id:', error)
    }
  }, [])

  useEffect(() => {
    fetchMachineId()
  }, [fetchMachineId])

  const tabItems = [
    {
      key: 'app',
      label: '앱 설정',
      children: <SettingsForm />,
    },
    {
      key: 'ip',
      label: 'IP 설정',
      children: <IpSettingsForm />,
    },
    {
      key: 'openai',
      label: 'OpenAI',
      children: <OpenAISettingsForm />,
    },
    {
      key: '2captcha',
      label: '2captcha',
      children: <TwoCaptchaSettingsForm />,
    },
  ]

  if (hasCoupasPermission) {
    tabItems.push(
      {
        key: 'wordpress',
        label: '워드프레스',
        children: <WordPressSettingsForm />,
      },
      {
        key: 'coupang',
        label: '쿠팡 파트너스',
        children: <CoupangPartnersSettingsForm />,
      },
      {
        key: 'job',
        label: '작업세팅',
        children: <JobSettingsForm />,
      },
    )
  }

  return <Tabs activeKey={activeTab} onChange={setActiveTab} type="card" size="large" items={tabItems} />
}

export default SettingsTabs
