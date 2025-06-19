import { SettingOutlined } from '@ant-design/icons'
import { message, Tabs, Typography } from 'antd'
import React, { useEffect, useState } from 'react'
import AppSettingsForm from '../components/settings/AppSettingsForm'
import OpenAISettingsForm from '../components/settings/OpenAISettingsForm'

const { Title } = Typography

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('app')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
    }
    catch (error) {
      console.error('설정 로드 실패:', error)
      message.error('설정을 불러오는데 실패했습니다.')
    }
    finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        maxWidth: '1000px',
        margin: '0 auto',
      }}
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={2}>
            <SettingOutlined style={{ marginRight: 8 }} />
            설정
          </Title>
        </div>

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
      </div>
    </div>
  )
}

export default Settings
