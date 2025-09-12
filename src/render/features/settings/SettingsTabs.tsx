import { authApi } from '@render/api'
import { Tabs } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import OpenAISettingsForm from './OpenAISettingsForm'
import TwoCaptchaSettingsForm from './TwoCaptchaSettingsForm'
import SettingsForm from './SettingsForm'
import IpSettingsForm from './ip/IpSettingsForm'

const SettingsTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('app')
  const [machineId, setMachineId] = useState<string>('')

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

  return (
    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      type="card"
      size="large"
      items={[
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
      ]}
    />
  )
}

export default SettingsTabs
