import { Tabs } from 'antd'
import React, { useState } from 'react'
import AppSettingsForm from './AppSettingsForm'
import OpenAISettingsForm from './OpenAISettingsForm'

const SettingsTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('app')

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
          children: <AppSettingsForm />,
        },
        {
          key: 'openai',
          label: 'OpenAI',
          children: <OpenAISettingsForm />,
        },
      ]}
    />
  )
}

export default SettingsTabs
