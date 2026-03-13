import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { CRMProvider } from './context/CRMContext'
import Layout from './components/Layout'
import ProfileModal from './components/ProfileModal'
import NewProfileModal from './components/NewProfileModal'
import Notification from './components/Notification'
import Dashboard from './pages/Dashboard'
import Pipeline from './pages/Pipeline'
import Profiles from './pages/Profiles'
import Analytics from './pages/Analytics'
import Import from './pages/Import'
import ChatIA from './pages/ChatIA'

function AppContent() {
  const [profileModal, setProfileModal] = useState(null)
  const [newProfileOpen, setNewProfileOpen] = useState(false)

  useEffect(() => {
    const onOpen = (e) => setProfileModal(e.detail)
    const onOpenNew = () => setNewProfileOpen(true)
    window.addEventListener('open-profile', onOpen)
    window.addEventListener('open-new-profile', onOpenNew)
    return () => {
      window.removeEventListener('open-profile', onOpen)
      window.removeEventListener('open-new-profile', onOpenNew)
    }
  }, [])

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="profiles" element={<Profiles />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="import" element={<Import />} />
          <Route path="chat" element={<ChatIA />} />
        </Route>
      </Routes>
      {profileModal && <ProfileModal profile={profileModal} onClose={() => setProfileModal(null)} />}
      {newProfileOpen && <NewProfileModal onClose={() => setNewProfileOpen(false)} />}
      <Notification />
    </>
  )
}

function App() {
  return (
    <CRMProvider>
      <AppContent />
    </CRMProvider>
  )
}

export default App
