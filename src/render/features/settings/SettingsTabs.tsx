import { authApi } from '@render/api'
import { Tabs } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import LicenseRegistrationForm from './LicenseRegistrationForm'
import OpenAISettingsForm from './OpenAISettingsForm'
import SettingsForm from './SettingsForm'
import ProxySettingsForm from './ProxySettingsForm'

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
          key: 'proxy',
          label: '프록시 설정',
          children: <ProxySettingsForm />,
        },
        {
          key: 'openai',
          label: 'OpenAI',
          children: <OpenAISettingsForm />,
        },
        {
          key: 'license',
          label: '라이센스',
          children: <LicenseRegistrationForm machineId={machineId} />,
        },
      ]}
    />
  )
}

export default SettingsTabs
