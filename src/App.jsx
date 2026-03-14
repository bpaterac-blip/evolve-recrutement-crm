import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CRMProvider } from './context/CRMContext'
import Layout from './components/Layout'
import ProfileModal from './components/ProfileModal'
import NewProfileModal from './components/NewProfileModal'
import Notification from './components/Notification'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Pipeline from './pages/Pipeline'
import Profiles from './pages/Profiles'
import Analytics from './pages/Analytics'
import Import from './pages/Import'
import ChatIA from './pages/ChatIA'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-[var(--t3)]">Chargement…</div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

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
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/forgot-password" element={<AuthGuestRoute><ForgotPassword /></AuthGuestRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="profiles" element={<Profiles />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="import" element={<Import />} />
          <Route path="chat" element={<ChatIA />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {profileModal && <ProfileModal profile={profileModal} onClose={() => setProfileModal(null)} />}
      {newProfileOpen && <NewProfileModal onClose={() => setNewProfileOpen(false)} />}
      <Notification />
    </>
  )
}

function AuthGuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#173731' }}>
        <div className="text-white/70">Chargement…</div>
      </div>
    )
  }
  if (user) return <Navigate to="/" replace />
  return children
}

function LoginRoute() {
  return (
    <AuthGuestRoute>
      <Login />
    </AuthGuestRoute>
  )
}

function App() {
  return (
    <AuthProvider>
      <CRMProvider>
        <AppContent />
      </CRMProvider>
    </AuthProvider>
  )
}

export default App
