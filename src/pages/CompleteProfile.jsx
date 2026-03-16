import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const ACCENT = '#173731'
const GOLD = '#D2AB76'

const fieldClass = 'w-full py-3 px-4 rounded-lg bg-white/10 border border-white/20 text-white font-[inherit] text-[15px] outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20 transition-all placeholder:text-white/50'

export default function CompleteProfile() {
  const { user, refreshUserProfile } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const fn = firstName.trim()
    const ln = lastName.trim()
    if (!fn || !ln) {
      setError('Prénom et nom sont requis')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const { error: err } = await supabase.from('user_profiles').upsert({
        id: user.id,
        email: user.email || null,
        first_name: fn,
        last_name: ln,
      }, { onConflict: 'id' })
      if (err) throw err
      await refreshUserProfile()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err?.message || 'Erreur lors de l\'enregistrement')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: ACCENT }}>
      <div className="w-full max-w-[400px]">
        <div className="flex justify-center mb-10">
          <img src="/logo-evolve.svg" alt="Evolve Recruiter" className="w-[180px] h-auto" />
        </div>

        <h1 className="text-xl font-serif text-white text-center mb-2">Bienvenue ! Complétez votre profil</h1>
        <p className="text-white/70 text-[14px] text-center mb-8">Ces informations seront visibles par l&apos;équipe Evolve</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Prénom"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className={fieldClass}
          />
          <input
            type="text"
            placeholder="Nom"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className={fieldClass}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-lg font-medium text-[15px] font-[inherit] cursor-pointer transition-all disabled:opacity-60 text-[#173731] flex items-center justify-center gap-2"
            style={{ background: GOLD }}
          >
            {submitting ? 'Enregistrement…' : (
              <>
                Accéder à Evolve Recruiter
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
          {error && (
            <p className="text-red-300 text-[13px] text-center">{error}</p>
          )}
        </form>
      </div>
    </div>
  )
}
