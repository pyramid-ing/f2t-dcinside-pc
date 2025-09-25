import React from 'react'
import { Route, Routes } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import Dashboard from './Dashboard'
import ScheduledPostsPage from './ScheduledPosts'
import CommentManagement from './CommentManagement'
import SettingsPage from './Settings'
import LicensePage from '@render/pages/License'

const App: React.FC = () => {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/scheduled-posts" element={<ScheduledPostsPage />} />
        <Route path="/comment-management" element={<CommentManagement />} />
        <Route path="/license" element={<LicensePage />} />
      </Routes>
    </AppLayout>
  )
}

export default App
