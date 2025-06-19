import { HomeOutlined } from '@ant-design/icons'
import React from 'react'
import DashboardTabs from '../features/dashboard/DashboardTabs'

const Dashboard: React.FC = () => {
  return (
    <div
      style={{
        padding: '24px',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          padding: '32px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: '600px',
        }}
      >
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>
            <HomeOutlined style={{ marginRight: 8 }} />
            대시보드
          </h2>
        </div>
        <DashboardTabs />
      </div>
    </div>
  )
}

export default Dashboard
