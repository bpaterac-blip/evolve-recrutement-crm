import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ViewModeProvider } from './context/ViewModeContext'
import { CRMProvider } from './context/CRMContext'
import Layout from './components/Layout'
import NewProfileModal from './components/NewProfileModal'
import ProfilePage from './pages/ProfilePage'
import Notification from './components/Notification'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Pipeline from './pages/Pipeline'
import Profiles from './pages/Profiles'
import EventPage from './pages/EventPage'
import Analytics from './pages/Analytics'
import Import from './pages/Import'
import ChatIA from './pages/ChatIA'
import Tickets from './pages/Tickets'
import AdminConsole from './pages/AdminConsole'
import AdminTickets from './pages/AdminTickets'
import AdminScoringLearning from './pages/AdminScoringLearning'
import CompleteProfile from './pages/CompleteProfile'

function ProtectedRoute({ children }) {
  const { user, userProfile, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-[var(--t3)]">Chargement…</div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!userProfile || !userProfile.first_name) return <Navigate to="/complete-profile" replace />
  return children
}

function AdminProtectedRoute({ children }) {
  const { user, role, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-[var(--t3)]">Chargement…</div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (role !== 'admin') return <Navigate to="/" replace />;
  return children
}

function AppContent() {
  const [newProfileOpen, setNewProfileOpen] = useState(false)

  useEffect(() => {
    const onOpenNew = () => setNewProfileOpen(true)
    window.addEventListener('open-new-profile', onOpenNew)
    return () => window.removeEventListener('open-new-profile', onOpenNew)
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
          <Route path="profiles/:id" element={<ProfilePage />} />
          <Route path="events/:eventId" element={<EventPage />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="import" element={<Import />} />
          <Route path="chat" element={<ChatIA />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="admin/console" element={<AdminProtectedRoute><AdminConsole /></AdminProtectedRoute>} />
          <Route path="admin/tickets" element={<AdminProtectedRoute><AdminTickets /></AdminProtectedRoute>} />
          <Route path="admin/scoring-learning" element={<AdminProtectedRoute><AdminScoringLearning /></AdminProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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

function CompleteProfileRoute() {
  const { user, userProfile, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#173731' }}>
        <div className="text-white/70">Chargement…</div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (userProfile?.first_name) return <Navigate to="/" replace />
  return <CompleteProfile />
}

function App() {
  return (
    <AuthProvider>
      <ViewModeProvider>
        <CRMProvider>
          <AppContent />
        </CRMProvider>
      </ViewModeProvider>
    </AuthProvider>
  )
}

export default App
