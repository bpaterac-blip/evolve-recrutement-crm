import { useState, useEffect } from 'react'
import {
  getUsersWithRoles,
  inviteUser,
  updateUserRole,
  revokeAccess,
  unbanUser,
  setUserStatus,
  deleteUser,
} from '../lib/authAdmin'

const ACCENT = '#173731'
const GOLD = '#D2AB76'

function statusLabel(status, lastSignIn) {
  if (status === 'suspended') return 'Suspendu'
  if (status === 'invited') return 'Invité'
  if (!!lastSignIn === false) return 'Invité'
  return 'Actif'
}

function statusBadgeStyle(status, banned) {
  if (banned) return { backgroundColor: 'rgba(220,38,38,0.15)', color: '#b91c1c' }
  if (status === 'suspended') return { backgroundColor: 'rgba(234,179,8,0.2)', color: '#a16207' }
  if (status === 'invited') return { backgroundColor: 'rgba(147,197,253,0.3)', color: '#1d4ed8' }
  return { backgroundColor: 'rgba(34,197,94,0.15)', color: '#15803d' }
}

export default function AdminConsole() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState({})
  const [statuses, setStatuses] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('user')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { users: u, roles: r, statuses: s } = await getUsersWithRoles()
      setUsers(u)
      setRoles(r)
      setStatuses(s)
    } catch (e) {
      setError(e?.message || 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail?.trim()) return
    setInviting(true)
    setError(null)
    setInviteSuccess(null)
    try {
      await inviteUser(inviteEmail.trim(), { role: inviteRole })
      setInviteSuccess(`Invitation envoyée à ${inviteEmail}`)
      setInviteEmail('')
      setInviteRole('user')
      setInviteModalOpen(false)
      load()
    } catch (e) {
      setError(e?.message || 'Erreur lors de l\'invitation')
    } finally {
      setInviting(false)
    }
  }

  const handleToggleRole = async (userId) => {
    const current = roles[userId] || 'user'
    const next = current === 'admin' ? 'user' : 'admin'
    try {
      await updateUserRole(userId, next)
      setRoles((r) => ({ ...r, [userId]: next }))
    } catch (e) {
      setError(e?.message || 'Erreur lors du changement de rôle')
    }
  }

  const handleSuspend = async (userId) => {
    try {
      await setUserStatus(userId, 'suspended')
      setStatuses((s) => ({ ...s, [userId]: 'suspended' }))
    } catch (e) {
      setError(e?.message || 'Erreur lors de la suspension')
    }
  }

  const handleUnsuspend = async (userId) => {
    try {
      await setUserStatus(userId, 'active')
      setStatuses((s) => ({ ...s, [userId]: 'active' }))
    } catch (e) {
      setError(e?.message || 'Erreur lors de la réactivation')
    }
  }

  const handleRevoke = async (userId, email) => {
    if (!confirm(`Révoquer l'accès de ${email} ? L'utilisateur ne pourra plus se connecter.`)) return
    try {
      await revokeAccess(userId)
      load()
    } catch (e) {
      setError(e?.message || 'Erreur lors de la révocation')
    }
  }

  const handleUnban = async (userId) => {
    try {
      await unbanUser(userId)
      load()
    } catch (e) {
      setError(e?.message || 'Erreur lors du déban')
    }
  }

  const handleDelete = async (userId, email) => {
    if (!confirm(`Supprimer définitivement ${email} ? Cette action est irréversible.`)) return
    try {
      await deleteUser(userId)
      load()
    } catch (e) {
      setError(e?.message || 'Erreur lors de la suppression')
    }
  }

  const fmt = (s) => {
    if (!s) return '—'
    const d = new Date(s)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="page h-full overflow-y-auto p-[22px]" style={{ color: 'var(--text)' }}>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="font-serif text-[22px] mb-1" style={{ color: ACCENT }}>Console Administrateur</h1>
          <p className="text-[13px] text-[var(--t3)]">Gestion des utilisateurs et des rôles</p>
        </div>
        <button
          type="button"
          onClick={() => { setInviteModalOpen(true); setError(null); setInviteSuccess(null); }}
          className="py-2 px-4 rounded-lg text-[13px] font-medium text-white cursor-pointer"
          style={{ backgroundColor: GOLD }}
        >
          Inviter un utilisateur
        </button>
      </div>

      {error && (
        <div className="mb-4 py-3 px-4 rounded-lg text-sm" style={{ backgroundColor: 'rgba(220,38,38,0.1)', color: '#b91c1c' }}>
          {error}
        </div>
      )}
      {inviteSuccess && (
        <div className="mb-4 py-3 px-4 rounded-lg text-sm" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#15803d' }}>
          {inviteSuccess}
        </div>
      )}

      {/* Modal Inviter */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !inviting && setInviteModalOpen(false)}>
          <div
            className="w-full max-w-[400px] rounded-[10px] border shadow-lg p-5"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-lg mb-4" style={{ color: ACCENT }}>Inviter un utilisateur</h2>
            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@exemple.com"
                required
                className="w-full py-2.5 px-3 rounded-lg border text-[13px]"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
              />
              <div>
                <label className="block text-[12px] font-medium text-[var(--t3)] mb-1.5">Rôle</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-lg border text-[13px]"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => !inviting && setInviteModalOpen(false)}
                  className="py-2 px-4 rounded-lg text-[13px] font-medium border cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--t2)' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail?.trim()}
                  className="py-2 px-4 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: GOLD }}
                >
                  {inviting ? 'Envoi…' : 'Envoyer l\'invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="rounded-[10px] border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="py-3 px-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
          <span className="font-semibold text-sm">Utilisateurs</span>
          <span className="text-xs py-0.5 px-2 rounded-full font-medium" style={{ backgroundColor: 'var(--s2)', color: 'var(--t2)' }}>{users.length} utilisateurs</span>
        </div>
        {loading ? (
          <div className="py-8 text-center text-[var(--t3)]">Chargement…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr style={{ backgroundColor: 'var(--s2)' }}>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Email</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Rôle</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Statut</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Date création</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const role = roles[u.id] || 'user'
                  const status = statuses[u.id] ?? 'active'
                  const banned = !!u.banned_until
                  const statutLabel = banned ? 'Révoqué' : statusLabel(status, u.last_sign_in_at)
                  return (
                    <tr key={u.id} className="border-b last:border-b-0 hover:bg-[#F8F5F1]" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2.5 px-4 text-[13.5px]">
                        <span className={banned ? 'opacity-60' : ''}>{u.email}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-xs py-0.5 px-2 rounded-full font-medium" style={{ backgroundColor: role === 'admin' ? 'rgba(210,171,118,0.2)' : 'var(--s2)', color: role === 'admin' ? GOLD : 'var(--t2)' }}>
                          {role}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-xs py-0.5 px-2 rounded-full font-medium" style={statusBadgeStyle(status, banned)}>
                          {statutLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[13px]" style={{ color: 'var(--t2)' }}>{fmt(u.created_at)}</td>
                      <td className="py-2.5 px-4 flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleToggleRole(u.id)}
                          className="py-1.5 px-2.5 rounded-lg text-xs font-medium cursor-pointer border"
                          style={{ borderColor: GOLD, color: GOLD, backgroundColor: 'transparent' }}
                        >
                          Changer le rôle
                        </button>
                        {status === 'suspended' ? (
                          <button type="button" onClick={() => handleUnsuspend(u.id)} className="py-1.5 px-2.5 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: 'var(--green)', color: 'white' }}>
                            Réactiver
                          </button>
                        ) : (
                          !banned && (
                            <button type="button" onClick={() => handleSuspend(u.id)} className="py-1.5 px-2.5 rounded-lg text-xs font-medium cursor-pointer border" style={{ borderColor: '#a16207', color: '#a16207' }}>
                              Suspendre
                            </button>
                          )
                        )}
                        {banned ? (
                          <button type="button" onClick={() => handleUnban(u.id)} className="py-1.5 px-2.5 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: 'var(--green)', color: 'white' }}>
                            Réactiver
                          </button>
                        ) : (
                          <button type="button" onClick={() => handleRevoke(u.id, u.email)} className="py-1.5 px-2.5 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: 'rgba(220,38,38,0.15)', color: '#b91c1c' }}>
                            Révoquer
                          </button>
                        )}
                        <button type="button" onClick={() => handleDelete(u.id, u.email)} className="py-1.5 px-2.5 rounded-lg text-xs font-medium cursor-pointer border" style={{ borderColor: '#b91c1c', color: '#b91c1c' }}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
