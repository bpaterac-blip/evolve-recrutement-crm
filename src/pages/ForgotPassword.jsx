import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const fieldClass = 'w-full py-3 px-4 rounded-lg bg-white border border-white/20 text-[var(--text)] font-[inherit] text-[15px] outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20 transition-all placeholder:text-[var(--t3)]'

export default function ForgotPassword() {
  const { resetPasswordForEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setSubmitting(true)
    const { error: err } = await resetPasswordForEmail(email.trim())
    setSubmitting(false)
    if (err) {
      setError(err.message || 'Erreur lors de l\'envoi')
      return
    }
    setSent(true)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#173731' }}>
      <div className="w-full max-w-[360px]">
        <div className="flex justify-center mb-10">
          <img src="/logo-evolve.svg" alt="Evolve Recruiter" className="w-[180px] h-auto" />
        </div>

        {sent ? (
          <div className="bg-white/10 rounded-xl py-8 px-6 text-center">
            <div className="text-[48px] mb-3">✉</div>
            <p className="text-white text-[15px] leading-relaxed">
              Un lien de réinitialisation a été envoyé à <strong className="text-white">{email}</strong>.
            </p>
            <p className="text-white/70 text-[13px] mt-2">
              Cliquez sur le lien dans l'email pour définir un nouveau mot de passe.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-block text-white/80 text-[13px] hover:text-white transition-colors"
            >
              ← Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={fieldClass}
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-lg font-medium text-[15px] font-[inherit] cursor-pointer transition-all disabled:opacity-60 text-[#173731]"
              style={{ background: '#D2AB76' }}
            >
              {submitting ? 'Envoi en cours…' : 'Recevoir un lien de réinitialisation'}
            </button>
            <Link
              to="/login"
              className="text-white/80 text-[13px] text-center hover:text-white transition-colors"
            >
              ← Retour à la connexion
            </Link>
            {error && (
              <p className="text-red-300 text-[13px] text-center">{error}</p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
