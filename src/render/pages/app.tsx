import React from 'react'
import { Route, Routes } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import Dashboard from './Dashboard'
import ScheduledPostsPage from './ScheduledPosts'
import SettingsPage from './Settings'

const App: React.FC = () => {
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
