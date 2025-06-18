import { HomeOutlined, SettingOutlined } from '@ant-design/icons'
import { Layout, Menu, Tabs } from 'antd'
import React, { useEffect } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import styled from 'styled-components'
import ExportPostsXlsx from '../components/ExportPostsXlsx'
import SendDMForm from '../components/SendDMForm'
import SettingsPage from './Settings'

const { Sider, Content } = Layout

const StyledLayout = styled(Layout)`
    width: 100%;
  min-height: 100vh;
  height: 100vh;
`
const StyledContent = styled(Content)`
  margin: 0;
  padding: 0;
  background: #fff;
  min-height: 100vh;
  height: 100vh;
  display: flex;
  align-items: start;
  justify-content: start;
`

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

const App: React.FC = () => {
  useEffect(() => {
    // 백엔드 포트 확인
    window.electronAPI
      .getBackendPort()
      .then((port) => {
      })
      .catch((error) => {
        console.error('백엔드 포트 확인 실패:', error)
      })
  }, [])

  return (
    <StyledLayout>
      <Sider width={200}>
        <Logo>인스타 봇</Logo>
        <Menu
          theme="dark"
          defaultSelectedKeys={['1']}
          mode="inline"
          items={[
            {
              key: '1',
              icon: <HomeOutlined />,
              label: <NavLink to="/">인스타 대시보드</NavLink>,
            },
            {
              key: '2',
              icon: <SettingOutlined />,
              label: <NavLink to="/settings">설정</NavLink>,
            },
          ]}
        />
      </Sider>
      <Layout>
        <StyledContent>
          <Routes>
            <Route
              path="/"
              element={(
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Tabs
                    defaultActiveKey="send-dm"
                    style={{ width: 500, maxWidth: '90vw' }}
                    items={[
                      {
                        key: 'send-dm',
                        label: 'DM 보내기',
                        children: <SendDMForm />,
                      },
                      {
                        key: 'export-posts',
                        label: '게시물 엑셀 내보내기',
                        children: <ExportPostsXlsx />,
                      },
                    ]}
                  />
                </div>
              )}
            />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </StyledContent>
      </Layout>
    </StyledLayout>
  )
}

export default App
