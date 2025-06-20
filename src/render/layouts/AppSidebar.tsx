import { HomeOutlined, SettingOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { Layout, Menu, Typography } from 'antd'
import React, { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import styled from 'styled-components'
import UpdateManager from '../components/UpdateManager'

const { Text } = Typography

const { Sider } = Layout

const Logo = styled.div`
  height: 32px;
  margin: 16px;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  border-radius: 4px;
`

const UpdateSection = styled.div`
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  padding: 16px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
`

const VersionInfo = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`

const VersionLabel = styled.span`
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
`

const VersionBadge = styled.span`
  background: rgba(24, 144, 255, 0.2);
  color: #69c0ff;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid rgba(24, 144, 255, 0.3);
`

const UpdateButtonWrapper = styled.div`
  .ant-btn {
    width: 100%;
    height: 32px;
    background: rgba(24, 144, 255, 0.1);
    border: 1px solid rgba(24, 144, 255, 0.3);
    color: #69c0ff;
    font-size: 12px;
    font-weight: 500;

    &:hover {
      background: rgba(24, 144, 255, 0.2);
      border-color: rgba(24, 144, 255, 0.5);
      color: #91d5ff;
    }

    &:focus {
      background: rgba(24, 144, 255, 0.2);
      border-color: rgba(24, 144, 255, 0.5);
      color: #91d5ff;
    }

    .anticon {
      font-size: 12px;
    }
  }

  .ant-btn-primary {
    background: rgba(82, 196, 26, 0.2);
    border-color: rgba(82, 196, 26, 0.4);
    color: #95de64;

    &:hover {
      background: rgba(82, 196, 26, 0.3);
      border-color: rgba(82, 196, 26, 0.6);
      color: #b7eb8f;
    }

    &:focus {
      background: rgba(82, 196, 26, 0.3);
      border-color: rgba(82, 196, 26, 0.6);
      color: #b7eb8f;
    }
  }

  .ant-btn-loading {
    opacity: 0.7;
  }
`

const AppSidebar: React.FC = () => {
  const location = useLocation()
  const [appVersion, setAppVersion] = useState<string>('...')

  useEffect(() => {
    const getVersion = async () => {
      try {
        const version = await window.electronAPI.getAppVersion()
        setAppVersion(version)
      } catch (error) {
        console.error('앱 버전을 가져오는데 실패했습니다:', error)
        setAppVersion('Unknown')
      }
    }

    getVersion()
  }, [])

  const getSelectedKey = () => {
    if (location.pathname === '/') return '1'
    if (location.pathname === '/scheduled-posts') return '2'
    if (location.pathname === '/settings') return '3'
    return '1'
  }

  return (
    <Sider width={200} style={{ position: 'relative' }}>
      <Logo>윈소프트 디씨 포스팅 봇</Logo>
      <Menu
        theme="dark"
        selectedKeys={[getSelectedKey()]}
        mode="inline"
        style={{ paddingBottom: '80px' }}
        items={[
          {
            key: '1',
            icon: <HomeOutlined />,
            label: <NavLink to="/">대시보드</NavLink>,
          },
          {
            key: '2',
            icon: <UnorderedListOutlined />,
            label: <NavLink to="/scheduled-posts">작업 관리</NavLink>,
          },
          {
            key: '3',
            icon: <SettingOutlined />,
            label: <NavLink to="/settings">설정</NavLink>,
          },
        ]}
      />
      <UpdateSection>
        <VersionInfo>
          <VersionLabel>현재 버전</VersionLabel>
          <VersionBadge>v{appVersion}</VersionBadge>
        </VersionInfo>
        <UpdateButtonWrapper>
          <UpdateManager autoCheck={true} />
        </UpdateButtonWrapper>
      </UpdateSection>
    </Sider>
  )
}

export default AppSidebar
