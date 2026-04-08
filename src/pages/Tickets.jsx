import { useState, useEffect, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import { getMyTickets, createTicket, uploadTicketScreenshot, notifyAdminsOnNewTicket, updateTicketWithUserResponse, notifyAdminsOnUserResponse } from '../lib/tickets'

const ACCENT = '#173731'
const GOLD = '#D2AB76'

const STATUT_STYLE = {
  Ouvert: { backgroundColor: 'rgba(234,88,12,0.2)', color: '#c2410c', border: '1px solid rgba(234,88,12,0.4)' },
  'En cours': { backgroundColor: 'rgba(59,130,246,0.15)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.4)' },
  Résolu: { backgroundColor: 'rgba(34,197,94,0.15)', color: '#15803d', border: '1px solid rgba(34,197,94,0.4)' },
}

const PRIORITE_STYLE = {
  Urgente: { backgroundColor: 'rgba(234,88,12,0.2)', color: '#c2410c', border: '1px solid rgba(234,88,12,0.4)' },
  Normale: { backgroundColor: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--border)' },
}

export default function Tickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [priorite, setPriorite] = useState('Normale')
  const [submitting, setSubmitting] = useState(false)
  const [emailFeedback, setEmailFeedback] = useState(null)
  const [screenshotFile, setScreenshotFile] = useState(null)
  const [screenshotUrl, setScreenshotUrl] = useState(null)
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)
  const [userReponseByTicket, setUserReponseByTicket] = useState({})
  const [sendingReponseId, setSendingReponseId] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMyTickets()
      setTickets(data)
    } catch (e) {
      setError(e?.message || 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleScreenshotChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/^image\/(png|jpeg|jpg)$/i.test(file.type)) {
      setError('Format accepté : PNG ou JPG')
      return
    }
    setError(null)
    setUploadingScreenshot(true)
    try {
      const url = await uploadTicketScreenshot(file)
      setScreenshotUrl(url)
      setScreenshotFile(file.name)
    } catch (err) {
      setError(err?.message || 'Erreur lors de l\'upload')
    } finally {
      setUploadingScreenshot(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!titre?.trim()) return
    setSubmitting(true)
    setError(null)
    setEmailFeedback(null)
    try {
      const ticket = await createTicket({ titre: titre.trim(), description: description.trim(), priorite, screenshot_url: screenshotUrl || null })
      setTickets((prev) => [ticket, ...prev])
      setModalOpen(false)
      setTitre('')
      setDescription('')
      setPriorite('Normale')
      setScreenshotFile(null)
      setScreenshotUrl(null)
      const { data: { user } } = await supabase.auth.getUser()
      notifyAdminsOnNewTicket(ticket, user?.email).catch(() => {})
      setEmailFeedback({ type: 'success', message: 'Ticket créé avec succès' })
    } catch (e) {
      setError(e?.message || 'Erreur lors de l\'envoi')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendUserReponse = async (ticket) => {
    const text = userReponseByTicket[ticket.id]?.trim()
    if (!text) return
    setSendingReponseId(ticket.id)
    setError(null)
    try {
      await updateTicketWithUserResponse(ticket.id, text)
      const { data: { user } } = await supabase.auth.getUser()
      await notifyAdminsOnUserResponse(ticket, user?.email)
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, user_response: text, user_response_date: new Date().toISOString(), statut: t.statut === 'Résolu' ? 'En cours' : t.statut } : t)))
      setUserReponseByTicket((prev) => ({ ...prev, [ticket.id]: '' }))
    } catch (e) {
      setError(e?.message || 'Erreur lors de l\'envoi')
    } finally {
      setSendingReponseId(null)
    }
  }

  const fmt = (s) => {
    if (!s) return '—'
    const d = new Date(s)
    const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return `${date} · ${time}`
  }

  const totalCount = tickets.length
  const ouvertsCount = tickets.filter((t) => t.statut === 'Ouvert').length
  const enCoursCount = tickets.filter((t) => t.statut === 'En cours').length
  const resolusCount = tickets.filter((t) => t.statut === 'Résolu').length

  return (
    <div className="page h-full overflow-y-auto p-[22px]" style={{ color: 'var(--text)' }}>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="font-serif text-[22px] mb-1" style={{ color: ACCENT }}>Tickets</h1>
          <p className="text-[13px] text-[var(--t3)]">Signalez un problème ou suivez vos demandes</p>
        </div>
        <button
          type="button"
          onClick={() => { setModalOpen(true); setError(null); setEmailFeedback(null); }}
          className="py-2 px-4 rounded-lg text-[13px] font-medium cursor-pointer"
          style={{ backgroundColor: '#173731', color: '#E7E0D0', border: 'none' }}
        >
          Signaler un problème
        </button>
      </div>

      {error && (
        <div className="mb-4 py-3 px-4 rounded-lg text-sm" style={{ backgroundColor: 'rgba(220,38,38,0.1)', color: '#b91c1c' }}>
          {error}
        </div>
      )}
      {emailFeedback?.type === 'success' && (
        <div className="mb-4 py-3 px-4 rounded-lg text-sm" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#15803d' }}>
          {emailFeedback.message}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !submitting && setModalOpen(false)}>
          <div
            className="w-full max-w-[480px] rounded-[10px] border shadow-lg p-5"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-lg mb-4" style={{ color: ACCENT }}>Signaler un problème</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--t3)] mb-1.5">Titre du problème</label>
                <input
                  type="text"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  placeholder="Résumé du problème"
                  required
                  className="w-full py-2.5 px-3 rounded-lg border text-[13px]"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--t3)] mb-1.5">Description détaillée</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez le problème en détail..."
                  rows={4}
                  className="w-full py-2.5 px-3 rounded-lg border text-[13px] resize-y"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--t3)] mb-1.5">Ajouter une capture d'écran</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleScreenshotChange}
                    disabled={submitting}
                    className="text-[13px]"
                  />
                  {screenshotFile && <span className="text-[12px] text-[var(--t3)]">{screenshotFile}</span>}
                  {uploadingScreenshot && <span className="text-[12px] text-[var(--t3)]">Upload…</span>}
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--t3)] mb-1.5">Priorité</label>
                <select
                  value={priorite}
                  onChange={(e) => setPriorite(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-lg border text-[13px]"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
                >
                  <option value="Normale">Normale</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => !submitting && setModalOpen(false)}
                  className="py-2 px-4 rounded-lg text-[13px] font-medium border cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--t2)' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting || !titre?.trim()}
                  className="py-2 px-4 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: GOLD }}
                >
                  {submitting ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="rounded-[10px] border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] mb-1">Total</div>
          <div className="text-[22px] font-semibold" style={{ color: 'var(--text)' }}>{totalCount}</div>
        </div>
        <div className="rounded-[10px] border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] mb-1">Ouverts</div>
          <div className="text-[22px] font-semibold" style={{ color: '#c2410c' }}>{ouvertsCount}</div>
        </div>
        <div className="rounded-[10px] border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] mb-1">En cours</div>
          <div className="text-[22px] font-semibold" style={{ color: '#1d4ed8' }}>{enCoursCount}</div>
        </div>
        <div className="rounded-[10px] border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] mb-1">Résolus</div>
          <div className="text-[22px] font-semibold" style={{ color: '#15803d' }}>{resolusCount}</div>
        </div>
      </div>

      <div className="rounded-[10px] border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="py-3 px-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="font-semibold text-sm">Mes tickets</span>
          <span className="ml-2 text-xs py-0.5 px-2 rounded-full font-medium" style={{ backgroundColor: 'var(--s2)', color: 'var(--t2)' }}>{tickets.length}</span>
        </div>
        {loading ? (
          <div className="py-8 text-center text-[var(--t3)]">Chargement…</div>
        ) : tickets.length === 0 ? (
          <div className="py-8 text-center text-[var(--t3)]">Aucun ticket. Cliquez sur « Signaler un problème » pour en créer un.</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: 'var(--s2)' }}>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Titre</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Priorité</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Statut</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <Fragment key={t.id}>
                  <tr className="border-b last:border-b-0 hover:bg-[#F8F5F1]" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2.5 px-4">
                      <div>
                        <div className="text-[13.5px] font-medium">{t.titre}</div>
                        {t.description && <div className="text-[11px] text-[var(--t3)] mt-0.5 truncate max-w-[280px]">{t.description}</div>}
                      </div>
                    </td>
                  <td className="py-2.5 px-4">
                    <span className="text-xs py-0.5 px-2.5 font-medium" style={{ borderRadius: 20, ...(PRIORITE_STYLE[t.priorite] || PRIORITE_STYLE.Normale) }}>
                      {t.priorite}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs py-0.5 px-2.5 font-medium" style={{ borderRadius: 20, ...(STATUT_STYLE[t.statut] || STATUT_STYLE.Ouvert) }}>
                        {t.statut}
                      </span>
                      {t.statut === 'Résolu' && (
                        <span className="text-xs py-0.5 px-2.5 font-medium rounded-full" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#15803d', border: '1px solid rgba(34,197,94,0.4)' }}>Résolu</span>
                      )}
                      {(t.admin_response || t.admin_reponse) && t.statut !== 'Résolu' && (
                        <span className="text-xs py-0.5 px-2.5 font-medium rounded-full" style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.4)' }}>Répondu</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-[13px]" style={{ color: 'var(--t2)' }}>{fmt(t.created_at)}</td>
                </tr>
                {(t.admin_response || t.admin_reponse) && (
                  <tr key={`${t.id}-reponse`} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                    <td colSpan={4} className="p-0">
                      <div className="px-4 py-3 mx-4 mb-3 rounded-lg" style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
                        <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#15803d' }}>Réponse de l'équipe Evolve</div>
                        <div className="text-[13px] whitespace-pre-wrap mb-4" style={{ color: 'var(--text)' }}>{t.admin_response || t.admin_reponse}</div>
                        <div>
                          <label className="block text-[12px] font-medium text-[var(--t3)] mb-1.5">Votre réponse</label>
                          <textarea
                            value={userReponseByTicket[t.id] || ''}
                            onChange={(e) => setUserReponseByTicket((prev) => ({ ...prev, [t.id]: e.target.value }))}
                            placeholder="Répondre à l'équipe..."
                            rows={3}
                            className="w-full py-2 px-3 rounded-lg text-[13px] border resize-y mb-2"
                            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSendUserReponse(t)}
                            disabled={sendingReponseId === t.id || !(userReponseByTicket[t.id] || '').trim()}
                            className="py-1.5 px-3 rounded-lg text-[13px] font-medium disabled:opacity-50 cursor-pointer"
                            style={{ backgroundColor: ACCENT, color: '#E7E0D0', border: 'none' }}
                          >
                            {sendingReponseId === t.id ? 'Envoi…' : 'Envoyer'}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
