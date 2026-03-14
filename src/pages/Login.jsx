import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const fieldClass = 'w-full py-3 px-4 rounded-lg bg-white border border-white/20 text-[var(--text)] font-[inherit] text-[15px] outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20 transition-all placeholder:text-[var(--t3)]'

export default function Login() {
  const { signInWithPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setError('')
    setSubmitting(true)
    const { error: err } = await signInWithPassword(email.trim(), password)
    setSubmitting(false)
    if (err) {
      setError(err.message || 'Erreur de connexion')
      return
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#173731' }}>
      <div className="w-full max-w-[360px]">
        <div className="flex justify-center mb-10">
          <img src="/logo-evolve.svg" alt="Evolve Recruiter" className="w-[180px] h-auto" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={fieldClass}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={fieldClass}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-lg font-medium text-[15px] font-[inherit] cursor-pointer transition-all disabled:opacity-60 text-[#173731]"
            style={{ background: '#D2AB76' }}
          >
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
          <Link
            to="/forgot-password"
            className="text-white/80 text-[13px] text-center hover:text-white transition-colors"
          >
            Mot de passe oublié ?
          </Link>
          {error && (
            <p className="text-red-300 text-[13px] text-center">{error}</p>
          )}
        </form>
      </div>
    </div>
  )
}
