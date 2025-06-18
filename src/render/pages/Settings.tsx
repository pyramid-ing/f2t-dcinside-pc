import { SettingOutlined } from '@ant-design/icons'
import { Card, message, Tabs, Typography } from 'antd'
import React, { useEffect, useState } from 'react'
import DelaySettings from '../components/settings/DelaySettings'

const { Title } = Typography

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('delay')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)

      // 전역 엔진 설정 로드
      try {
      }
      catch (engineError) {
        console.log('전역 엔진 설정 로드 실패 (첫 실행일 수 있음):', engineError)
      }
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
              key: 'delay',
              label: '일반',
              children: <DelaySettings />,
            },
          ]}
        />
      </Card>
    </div>
  )
}

export default Settings
