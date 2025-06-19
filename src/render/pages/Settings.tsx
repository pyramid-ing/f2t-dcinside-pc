import { SettingOutlined } from '@ant-design/icons'
import React from 'react'
import PageContainer from '../components/shared/PageContainer'
import SettingsTabs from '../features/settings/SettingsTabs'

const Settings: React.FC = () => {
  return (
    <PageContainer
      title={
        <span>
          <SettingOutlined style={{ marginRight: 8 }} />
          설정
        </span>
      }
      maxWidth="1000px"
      centered
    >
      <SettingsTabs />
    </PageContainer>
  )
}

export default Settings
