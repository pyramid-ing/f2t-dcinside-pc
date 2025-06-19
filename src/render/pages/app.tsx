import { HomeOutlined, SettingOutlined } from '@ant-design/icons'
import { Layout, Menu, Tabs } from 'antd'
import React, { useEffect } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import styled from 'styled-components'
import UploadDcinsideExcelForm from '../components/UploadDcinsideExcelForm'
import ScheduledPostsPage from './ScheduledPosts'
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
  background: #f5f5f5;
  min-height: 100vh;
  height: 100vh;
  overflow: auto;
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
        <Logo>DC 봇</Logo>
        <Menu
          theme="dark"
          defaultSelectedKeys={['1']}
          mode="inline"
          items={[
            {
              key: '1',
              icon: <HomeOutlined />,
              label: <NavLink to="/">대시보드</NavLink>,
            },
            {
              key: '2',
              icon: <HomeOutlined />,
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
      <Layout>
        <StyledContent>
          <Routes>
            <Route
              path="/"
              element={(
                <div style={{
                  padding: '24px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '100vh',
                }}
                >
                  <div style={{
                    background: '#fff',
                    borderRadius: '8px',
                    padding: '32px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    width: '100%',
                    maxWidth: '600px',
                  }}
                  >
                    <Tabs
                      defaultActiveKey="dcinside-excel-upload"
                      size="large"
                      items={[
                        {
                          key: 'dcinside-excel-upload',
                          label: '디씨 엑셀 업로드',
                          children: <UploadDcinsideExcelForm />,
                        },
                      ]}
                    />
                  </div>
                </div>
              )}
            />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/scheduled-posts" element={<ScheduledPostsPage />} />
          </Routes>
        </StyledContent>
      </Layout>
    </StyledLayout>
  )
}

export default App
