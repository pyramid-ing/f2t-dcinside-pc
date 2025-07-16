import { Tabs } from 'antd'
import React, { useState } from 'react'
import OpenAISettingsForm from './OpenAISettingsForm'
import SettingsForm from './SettingsForm'
import ProxySettingsForm from './ProxySettingsForm'

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
      ]}
    />
  )
}

export default SettingsTabs
