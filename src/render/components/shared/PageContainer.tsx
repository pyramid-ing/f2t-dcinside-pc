import { Typography } from 'antd'
import React from 'react'

const { Title } = Typography

interface PageContainerProps {
  title?: React.ReactNode
  children: React.ReactNode
  maxWidth?: string
  centered?: boolean
}

const PageContainer: React.FC<PageContainerProps> = ({ title, children, maxWidth = '1200px', centered = false }) => {
  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxWidth,
          margin: centered ? '0 auto' : undefined,
        }}
      >
        {title && (
          <div style={{ marginBottom: '24px' }}>
            <Title level={4}>{title}</Title>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export default PageContainer
