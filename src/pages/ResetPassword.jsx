import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const fieldClass = 'w-full py-3 px-4 rounded-lg bg-white border border-white/20 text-[var(--text)] font-[inherit] text-[15px] outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20 transition-all placeholder:text-[var(--t3)]'

const PASSWORD_RULES = {
  minLength: /^.{8,}$/,
  uppercase: /[A-Z]/,
  number: /\d/,
}

function validatePassword(pwd) {
  const errors = []
  if (!PASSWORD_RULES.minLength.test(pwd)) errors.push('8 caractères minimum')
  if (!PASSWORD_RULES.uppercase.test(pwd)) errors.push('une majuscule')
  if (!PASSWORD_RULES.number.test(pwd)) errors.push('un chiffre')
  return errors
}

export default function ResetPassword() {
  const { user, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true })
    }
  }, [user, loading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setValidationErrors([])

    const errors = validatePassword(password)
    if (errors.length) {
      setValidationErrors(errors)
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setSubmitting(true)
    const { error: err } = await updatePassword(password)
    setSubmitting(false)
    if (err) {
      setError(err.message || 'Erreur lors de la mise à jour')
      return
    }
    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#173731' }}>
        <div className="text-white/70">Chargement…</div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#173731' }}>
      <div className="w-full max-w-[360px]">
        <div className="flex justify-center mb-10">
          <img src="/logo-evolve.svg" alt="Evolve Recruiter" className="w-[180px] h-auto" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="Nouveau mot de passe"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setValidationErrors([]); }}
            required
            className={fieldClass}
          />
          <input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className={fieldClass}
          />
          {validationErrors.length > 0 && (
            <p className="text-amber-300 text-[12px]">
              Le mot de passe doit contenir : {validationErrors.join(', ')}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-lg font-medium text-[15px] font-[inherit] cursor-pointer transition-all disabled:opacity-60 text-[#173731]"
            style={{ background: '#D2AB76' }}
          >
            {submitting ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
          </button>
          {error && (
            <p className="text-red-300 text-[13px] text-center">{error}</p>
          )}
        </form>
      </div>
    </div>
  )
}
