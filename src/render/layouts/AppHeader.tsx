import { Layout } from 'antd'
import React from 'react'
import styled from 'styled-components'

const { Header } = Layout

const StyledHeader = styled(Header)`
  background: #fff;
  padding: 0 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
`

const AppHeader: React.FC = () => {
  return (
    <StyledHeader>
      <div style={{ fontSize: '16px', fontWeight: 600 }}>
        디씨인사이드 포스팅 도구
      </div>
      <div>
        {/* 추후 사용자 정보나 기타 헤더 컨텐츠 */}
      </div>
    </StyledHeader>
  )
}

export default AppHeader
