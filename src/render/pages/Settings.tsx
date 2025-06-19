import { SettingOutlined } from '@ant-design/icons'
import { Card, message, Tabs, Typography } from 'antd'
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
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <SettingOutlined style={{ marginRight: 8 }} />
          설정
        </Title>
      </div>

      <Card>
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
      </Card>
    </div>
  )
}

export default Settings
