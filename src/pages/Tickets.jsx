import { useState, useEffect } from 'react'
import { getMyTickets, createTicket, uploadTicketScreenshot } from '../lib/tickets'
import { sendTicketNotificationEmail } from '../lib/ticketEmail'

const ACCENT = '#173731'
const GOLD = '#D2AB76'

const STATUT_STYLE = {
  Ouvert: { backgroundColor: 'rgba(220,38,38,0.15)', color: '#b91c1c' },
  'En cours': { backgroundColor: 'rgba(234,88,12,0.2)', color: '#c2410c' },
  Résolu: { backgroundColor: 'rgba(34,197,94,0.15)', color: '#15803d' },
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
      const emailResult = await sendTicketNotificationEmail(ticket)
      if (emailResult.success) {
        setEmailFeedback({ type: 'success', message: 'Ticket créé. Notification email envoyée.' })
      } else {
        setEmailFeedback({ type: 'error', message: emailResult.error || 'Notification email non envoyée.' })
      }
    } catch (e) {
      setError(e?.message || 'Erreur lors de l\'envoi')
    } finally {
      setSubmitting(false)
    }
  }

  const fmt = (s) => {
    if (!s) return '—'
    return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

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
          className="py-2 px-4 rounded-lg text-[13px] font-medium text-white cursor-pointer"
          style={{ backgroundColor: GOLD }}
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
      {emailFeedback?.type === 'error' && (
        <div className="mb-4 py-3 px-4 rounded-lg text-sm" style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#a16207' }}>
          Ticket créé. Email non envoyé : {emailFeedback.message}
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
                <tr key={t.id} className="border-b last:border-b-0 hover:bg-[#F8F5F1]" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-2.5 px-4 text-[13.5px] font-medium">{t.titre}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
