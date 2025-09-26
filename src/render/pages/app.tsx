import React from 'react'
import { Route, Routes } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import ScheduledPostsPage from './ScheduledPosts'
import CommentPage from './CommentPage'
import SettingsPage from './Settings'
import LicensePage from '@render/pages/License'

const App: React.FC = () => {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<ScheduledPostsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/comment-management" element={<CommentPage />} />
        <Route path="/license" element={<LicensePage />} />
      </Routes>
    </AppLayout>
  )
}

export default App
