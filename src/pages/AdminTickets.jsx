import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  listAllTicketsForAdmin,
  updateTicketStatusForAdmin,
  updateTicketForAdmin,
  insertTicketResolvedNotificationForAdmin,
  deleteTicketForAdmin,
} from '../lib/tickets'
import { IconTrash } from '../components/Icons'

const ACCENT = '#173731'
const GOLD = '#D2AB76'

const STATUT_OPTIONS = ['Ouvert', 'En cours', 'Résolu']
const STATUT_STYLE = {
  Ouvert: { backgroundColor: 'rgba(220,38,38,0.15)', color: '#b91c1c' },
  'En cours': { backgroundColor: 'rgba(234,88,12,0.2)', color: '#c2410c' },
  Résolu: { backgroundColor: 'rgba(34,197,94,0.15)', color: '#15803d' },
}

export default function AdminTickets() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [modalStatut, setModalStatut] = useState('')
  const [modalReponse, setModalReponse] = useState('')
  const [modalSaving, setModalSaving] = useState(false)
  const [ticketToDelete, setTicketToDelete] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAllTicketsForAdmin()
      setTickets(data)
    } catch (e) {
      setError(e?.message || 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .in('type', ['nouveau_ticket', 'ticket_reponse_user'])
    })()
  }, [user?.id])

  const openTicketModal = (t) => {
    setSelectedTicket(t)
    setModalStatut(t?.statut || 'Ouvert')
    setModalReponse(t?.admin_response || t?.admin_reponse || '')
  }

  const handleModalSave = async () => {
    if (!selectedTicket?.id) return
    setModalSaving(true)
    setError(null)
    try {
      await updateTicketForAdmin(selectedTicket.id, { statut: modalStatut, admin_response: modalReponse || null })
      const newStatut = modalStatut
      const adminResponse = modalReponse || ''
      const ticket = selectedTicket
      if (ticket.user_id && (newStatut === 'Résolu' || adminResponse.trim())) {
        const notifType = newStatut === 'Résolu' ? 'ticket_resolu' : 'ticket_reponse'
        const notifMessage = newStatut === 'Résolu'
          ? `Votre ticket "${ticket.titre}" a été résolu.`
          : `Réponse à votre ticket "${ticket.titre}" : ${adminResponse.substring(0, 80)}...`
        await supabase.from('notifications').insert({
          user_id: ticket.user_id,
          type: notifType,
          message: notifMessage,
          ticket_id: ticket.id,
        })
      }
      setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? { ...t, statut: modalStatut, admin_response: modalReponse || null, updated_at: new Date().toISOString() } : t)))
      setSelectedTicket(null)
    } catch (e) {
      setError(e?.message || 'Erreur lors de l\'enregistrement')
    } finally {
      setModalSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!ticketToDelete?.id) return
    setDeletingId(ticketToDelete.id)
    setError(null)
    try {
      await deleteTicketForAdmin(ticketToDelete.id)
      setTickets((prev) => prev.filter((t) => t.id !== ticketToDelete.id))
      setTicketToDelete(null)
      if (selectedTicket?.id === ticketToDelete.id) setSelectedTicket(null)
    } catch (e) {
      setError(e?.message || 'Erreur lors de la suppression')
    } finally {
      setDeletingId(null)
    }
  }

  const handleChangeStatus = async (ticketId, newStatut) => {
    setUpdatingId(ticketId)
    setError(null)
    try {
      await updateTicketStatusForAdmin(ticketId, newStatut)
      const ticket = tickets.find((t) => t.id === ticketId)
      if (newStatut === 'Résolu' && ticket) {
        await insertTicketResolvedNotificationForAdmin(ticket)
      }
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
                  <tr
                    key={t.id}
                    className="border-b last:border-b-0 hover:bg-[#F8F5F1] cursor-pointer group"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() => openTicketModal(t)}
                  >
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
                    <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
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
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setTicketToDelete(t); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded transition-opacity"
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#dc2626' }}
                          title="Supprimer"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ticketToDelete && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => !deletingId && setTicketToDelete(null)}
        >
          <div
            className="w-full max-w-[400px] rounded-[12px] border shadow-xl p-6"
            style={{ borderColor: 'var(--border)', backgroundColor: '#fff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-semibold text-base mb-3" style={{ color: 'var(--text)' }}>Supprimer ce ticket ?</div>
            <p className="text-[13px] mb-6" style={{ color: 'var(--t2)' }}>Cette action est irréversible.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTicketToDelete(null)}
                disabled={deletingId}
                className="py-2 px-4 rounded-lg text-[13px] font-medium border"
                style={{ borderColor: 'var(--border)', color: 'var(--t2)' }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId}
                className="py-2 px-4 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: '#dc2626' }}
              >
                {deletingId ? 'Suppression…' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTicket && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => !modalSaving && setSelectedTicket(null)}
        >
          <div
            className="w-full max-w-[560px] rounded-[12px] border shadow-xl overflow-hidden"
            style={{ borderColor: 'var(--border)', backgroundColor: '#fff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4" style={{ backgroundColor: ACCENT, color: '#fff' }}>
              <h2 className="font-semibold text-lg">Détail du ticket</h2>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] mb-1">Titre</div>
                <div className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>{selectedTicket.titre}</div>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] mb-1">Description</div>
                <div className="text-[13px] whitespace-pre-wrap" style={{ color: 'var(--t2)' }}>{selectedTicket.description || '—'}</div>
              </div>
              <div className="flex flex-wrap gap-3">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--t3)]">Priorité</span>
                  <span className="ml-2 text-xs py-0.5 px-2 rounded-full font-medium" style={{ backgroundColor: selectedTicket.priorite === 'Urgente' ? 'rgba(220,38,38,0.15)' : 'var(--s2)', color: selectedTicket.priorite === 'Urgente' ? '#b91c1c' : 'var(--t2)' }}>{selectedTicket.priorite}</span>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--t3)]">Statut</span>
                  <span className="ml-2 text-xs py-0.5 px-2 rounded-full font-medium" style={STATUT_STYLE[selectedTicket.statut] || STATUT_STYLE.Ouvert}>{selectedTicket.statut}</span>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] mb-1">Date de création</div>
                <div className="text-[13px]" style={{ color: 'var(--t2)' }}>{fmt(selectedTicket.created_at)}</div>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] mb-1">Créé par</div>
                <div className="text-[13px]" style={{ color: 'var(--t2)' }}>{selectedTicket.user_email || '—'}</div>
              </div>
              {selectedTicket.screenshot_url && (
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] mb-2">Capture d'écran</div>
                  <a href={selectedTicket.screenshot_url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)', maxWidth: 400 }}>
                    <img src={selectedTicket.screenshot_url} alt="Screenshot" className="w-full h-auto object-contain max-h-[200px]" />
                  </a>
                </div>
              )}
              <div>
                <label className="block text-[12px] font-medium text-[var(--t3)] mb-1.5">Statut</label>
                <select
                  value={modalStatut}
                  onChange={(e) => setModalStatut(e.target.value)}
                  className="w-full py-2 px-3 rounded-lg text-[13px] border"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {STATUT_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--t3)] mb-1.5">Réponse admin</label>
                <textarea
                  value={modalReponse}
                  onChange={(e) => setModalReponse(e.target.value)}
                  placeholder="Réponse à transmettre à l'utilisateur (génère une notification)..."
                  rows={4}
                  className="w-full py-2 px-3 rounded-lg text-[13px] border resize-y"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>
              {selectedTicket.user_response && (
                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: '#F8F5F1', borderLeft: '3px solid #D2AB76' }}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#173731' }}>Réponse de l'utilisateur</div>
                  <div className="text-[13px] whitespace-pre-wrap mb-2" style={{ color: 'var(--text)' }}>{selectedTicket.user_response}</div>
                  {selectedTicket.user_response_date && (
                    <div className="text-[11px]" style={{ color: 'var(--t3)' }}>{fmt(selectedTicket.user_response_date)}</div>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--s2)' }}>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="py-2 px-4 rounded-lg text-[13px] font-medium border"
                style={{ borderColor: ACCENT, color: ACCENT }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleModalSave}
                disabled={modalSaving}
                className="py-2 px-4 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {modalSaving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
