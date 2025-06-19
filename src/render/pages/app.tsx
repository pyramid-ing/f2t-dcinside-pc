import React, { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import Dashboard from './Dashboard'
import ScheduledPostsPage from './ScheduledPosts'
import SettingsPage from './Settings'

const App: React.FC = () => {
  useEffect(() => {
    // 백엔드 포트 확인
    window.electronAPI
      .getBackendPort()
      .then(port => {})
      .catch(error => {
        console.error('백엔드 포트 확인 실패:', error)
      })
  }, [])

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/scheduled-posts" element={<ScheduledPostsPage />} />
      </Routes>
    </AppLayout>
  )
}

export default App
