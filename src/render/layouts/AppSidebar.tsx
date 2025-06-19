import { HomeOutlined, SettingOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { Layout, Menu } from 'antd'
import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import styled from 'styled-components'

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

const AppSidebar: React.FC = () => {
  const location = useLocation()

  const getSelectedKey = () => {
    if (location.pathname === '/') return '1'
    if (location.pathname === '/scheduled-posts') return '2'
    if (location.pathname === '/settings') return '3'
    return '1'
  }

  return (
    <Sider width={200}>
      <Logo>DC 봇</Logo>
      <Menu
        theme="dark"
        selectedKeys={[getSelectedKey()]}
        mode="inline"
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
    </Sider>
  )
}

export default AppSidebar
