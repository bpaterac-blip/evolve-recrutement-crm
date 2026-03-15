import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

async function fetchUserRoleAndStatus(userId) {
  if (!userId) return { role: 'user', status: null }
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, status')
    .eq('user_id', userId)
    .single()
  if (error) console.warn('AuthContext fetchUserRoleAndStatus:', { userId, error: error.message })
  const role = data?.role ?? 'user'
  const status = data?.status ?? 'active'
  console.log('Role chargé:', role, '(user_id:', userId, ', data:', data, ')')
  return { role, status }
}

const SAFETY_TIMEOUT_MS = 2000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const safetyTimeoutId = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, SAFETY_TIMEOUT_MS)

    const applySession = (session) => {
      if (!session?.user) {
        setUser(null)
        setRole('user')
        setLoading(false)
        return
      }
      fetchUserRoleAndStatus(session.user.id).then(({ role: r, status }) => {
        if (cancelled) return
        console.log('Role chargé (applySession):', r)
        if (status === 'suspended') {
          supabase.auth.signOut()
          setUser(null)
          setRole('user')
        } else {
          setUser(session.user)
          setRole(r ?? 'user')
        }
      }).catch((err) => {
        console.warn('AuthContext applySession fetch role failed:', err)
        if (!cancelled) {
          setUser(session.user)
          setRole('user')
        }
      }).finally(() => {
        if (!cancelled) setLoading(false)
      })
    }

    const sessionPromise = supabase.auth.getSession()
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), SAFETY_TIMEOUT_MS))
    Promise.race([sessionPromise, timeoutPromise]).then((result) => {
      if (cancelled) return
      clearTimeout(safetyTimeoutId)
      if (result?.timeout) {
        setLoading(false)
        sessionPromise.then((sessionResult) => {
          if (!cancelled && sessionResult?.data?.session) applySession(sessionResult.data.session)
        })
        return
      }
      const session = result?.data?.session
      applySession(session ?? null)
    }).catch(() => {
      if (!cancelled) {
        clearTimeout(safetyTimeoutId)
        setLoading(false)
        setUser(null)
        setRole('user')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      clearTimeout(safetyTimeoutId)
      try {
        if (event === 'PASSWORD_RECOVERY') {
          const target = `${window.location.origin}/reset-password${window.location.hash || ''}`
          if (!window.location.pathname.startsWith('/reset-password')) {
            window.location.replace(target)
          }
          setLoading(false)
          return
        }
        if (!session?.user) {
          setUser(null)
          setRole('user')
          setLoading(false)
          return
        }
        fetchUserRoleAndStatus(session.user.id).then(({ role: r, status }) => {
          if (cancelled) return
          console.log('Role chargé (onAuthStateChange):', r)
          if (status === 'suspended') {
            supabase.auth.signOut()
            setUser(null)
            setRole('user')
          } else {
            setUser(session.user)
            setRole(r ?? 'user')
          }
        }).catch((err) => {
          console.warn('AuthContext onAuthStateChange fetch role failed:', err)
          if (!cancelled) {
            setUser(session.user)
            setRole('user')
          }
        }).finally(() => {
          if (!cancelled) setLoading(false)
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => {
      cancelled = true
      clearTimeout(safetyTimeoutId)
      subscription.unsubscribe()
    }
  }, [])

  const signInWithPassword = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const resetPasswordForEmail = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const roleValue = role ?? 'user'
  return (
    <AuthContext.Provider
      value={{
        user,
        role: roleValue,
        loading,
        signInWithPassword,
        resetPasswordForEmail,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
