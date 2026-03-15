import { useState, useEffect } from 'react'
import { listAllTickets, updateTicketStatus } from '../lib/authAdmin'

const ACCENT = '#173731'
const GOLD = '#D2AB76'

const STATUT_OPTIONS = ['Ouvert', 'En cours', 'Résolu']
const STATUT_STYLE = {
  Ouvert: { backgroundColor: 'rgba(220,38,38,0.15)', color: '#b91c1c' },
  'En cours': { backgroundColor: 'rgba(234,88,12,0.2)', color: '#c2410c' },
  Résolu: { backgroundColor: 'rgba(34,197,94,0.15)', color: '#15803d' },
}

export default function AdminTickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAllTickets()
      setTickets(data)
    } catch (e) {
      setError(e?.message || 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleChangeStatus = async (ticketId, newStatut) => {
    setUpdatingId(ticketId)
    setError(null)
    try {
      await updateTicketStatus(ticketId, newStatut)
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, statut: newStatut, updated_at: new Date().toISOString() } : t)))
    } catch (e) {
      setError(e?.message || 'Erreur lors de la mise à jour')
    } finally {
      setUpdatingId(null)
    }
  }

  const fmt = (s) => {
    if (!s) return '—'
    return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const sorted = [...tickets].sort((a, b) => {
    const prio = { Urgente: 2, Normale: 1 }
    const p = (prio[b.priorite] ?? 1) - (prio[a.priorite] ?? 1)
    if (p !== 0) return p
    return new Date(b.created_at) - new Date(a.created_at)
  })

  return (
    <div className="page h-full overflow-y-auto p-[22px]" style={{ color: 'var(--text)' }}>
      <div className="mb-5">
        <h1 className="font-serif text-[22px] mb-1" style={{ color: ACCENT }}>Tickets (Admin)</h1>
        <p className="text-[13px] text-[var(--t3)]">Tous les tickets, triés par priorité et date</p>
      </div>

      {error && (
        <div className="mb-4 py-3 px-4 rounded-lg text-sm" style={{ backgroundColor: 'rgba(220,38,38,0.1)', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      <div className="rounded-[10px] border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="py-3 px-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
          <span className="font-semibold text-sm">Tous les tickets</span>
          <span className="text-xs py-0.5 px-2 rounded-full font-medium" style={{ backgroundColor: 'var(--s2)', color: 'var(--t2)' }}>{tickets.length}</span>
        </div>
        {loading ? (
          <div className="py-8 text-center text-[var(--t3)]">Chargement…</div>
        ) : tickets.length === 0 ? (
          <div className="py-8 text-center text-[var(--t3)]">Aucun ticket.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr style={{ backgroundColor: 'var(--s2)' }}>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Titre</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Email</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Priorité</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Statut</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Date</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr key={t.id} className="border-b last:border-b-0 hover:bg-[#F8F5F1]" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2.5 px-4 text-[13.5px] font-medium">{t.titre}</td>
                    <td className="py-2.5 px-4 text-[13px]" style={{ color: 'var(--t2)' }}>{t.user_email || '—'}</td>
                    <td className="py-2.5 px-4">
                      <span className="text-xs py-0.5 px-2 rounded-full font-medium" style={{ backgroundColor: t.priorite === 'Urgente' ? 'rgba(220,38,38,0.15)' : 'var(--s2)', color: t.priorite === 'Urgente' ? '#b91c1c' : 'var(--t2)' }}>
                        {t.priorite}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-xs py-0.5 px-2 rounded-full font-medium" style={STATUT_STYLE[t.statut] || STATUT_STYLE.Ouvert}>
                        {t.statut}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[13px]" style={{ color: 'var(--t2)' }}>{fmt(t.created_at)}</td>
                    <td className="py-2.5 px-4">
                      <select
                        value={t.statut}
                        onChange={(e) => handleChangeStatus(t.id, e.target.value)}
                        disabled={updatingId === t.id}
                        className="py-1.5 px-2 rounded-lg text-xs font-medium border cursor-pointer"
                        style={{ borderColor: GOLD, color: ACCENT }}
                      >
                        {STATUT_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
