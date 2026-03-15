import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCRM } from '../context/CRMContext'

const PAGE_STYLE = {
  bg: '#F5F3EF',
  cardBg: '#ffffff',
  border: '#E5E0D8',
  text: '#1A1A1A',
  textSecondary: '#6B6B6B',
  accent: '#173731',
  gold: '#D2AB76',
  green: '#1A7A4A',
  radius: 12,
}

function formatDateTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
  return `${date} à ${time}`
}

export default function EventPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { profiles } = useCRM()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState('')
  const [notes, setNotes] = useState('')
  const [savingDetail, setSavingDetail] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [lastNotesUpdate, setLastNotesUpdate] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single()
      if (error) {
        console.error('Erreur chargement événement', error)
        setLoading(false)
        return
      }
      setEvent(data)
      setDetail(data.content || '')
      setNotes(data.notes || '')
      setLastNotesUpdate(data.updated_at || data.created_at || null)
      setLoading(false)
    }
    if (eventId) load()
  }, [eventId])

  if (loading) {
    return (
      <div style={{ background: PAGE_STYLE.bg, minHeight: '100%', padding: 22 }}>
        <div style={{ color: PAGE_STYLE.textSecondary }}>Chargement de l&apos;événement…</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div style={{ background: PAGE_STYLE.bg, minHeight: '100%', padding: 22 }}>
        <button type="button" style={{ color: PAGE_STYLE.textSecondary, fontSize: 13 }} onClick={() => navigate(-1)}>← Retour</button>
        <div style={{ color: PAGE_STYLE.textSecondary, marginTop: 16 }}>Événement introuvable.</div>
      </div>
    )
  }

  const profile = profiles.find((p) => String(p.id) === String(event.profile_id))
  const headerTitle = (event.content || '').split('—')[0].trim() || (event.content || 'Événement')
  const eventDate = event.date || event.created_at

  const handleSaveDetail = async () => {
    setSavingDetail(true)
    const { error } = await supabase.from('events').update({ content: detail }).eq('id', eventId)
    if (error) console.error('Erreur save detail', error)
    setSavingDetail(false)
  }

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    const { error } = await supabase.from('events').update({ notes }).eq('id', eventId)
    if (error) {
      console.error('Erreur save notes', error)
    } else {
      setLastNotesUpdate(new Date().toISOString())
    }
    setSavingNotes(false)
  }

  return (
    <div style={{ background: PAGE_STYLE.bg, minHeight: '100%', padding: 22 }}>
      <button
        type="button"
        style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, marginBottom: 16 }}
        onClick={() => navigate(profile ? `/profiles/${profile.id}` : -1)}
      >
        ← Retour au profil
      </button>

      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ background: PAGE_STYLE.cardBg, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 12, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: PAGE_STYLE.text, marginBottom: 6 }}>{headerTitle}</div>
              <div style={{ fontSize: 13, color: PAGE_STYLE.textSecondary }}>
                {eventDate ? formatDateTime(eventDate) : 'Date inconnue'}
              </div>
            </div>
            {profile && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: PAGE_STYLE.textSecondary, marginBottom: 4 }}>Profil associé</div>
                <Link
                  to={`/profiles/${profile.id}`}
                  style={{ fontSize: 14, fontWeight: 600, color: PAGE_STYLE.accent, textDecoration: 'none' }}
                >
                  {profile.fn} {profile.ln}
                </Link>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ background: PAGE_STYLE.cardBg, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: PAGE_STYLE.textSecondary, marginBottom: 10 }}>
              Détail
            </div>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={5}
              style={{
                width: '100%',
                padding: 12,
                fontSize: 13,
                border: `1px solid ${PAGE_STYLE.border}`,
                borderRadius: 8,
                resize: 'vertical',
                color: PAGE_STYLE.text,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="button"
                onClick={handleSaveDetail}
                disabled={savingDetail}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: PAGE_STYLE.gold,
                  color: PAGE_STYLE.accent,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: savingDetail ? 'default' : 'pointer',
                  opacity: savingDetail ? 0.7 : 1,
                }}
              >
                {savingDetail ? 'Enregistrement…' : 'Enregistrer le détail'}
              </button>
            </div>
          </div>

          <div style={{ background: PAGE_STYLE.cardBg, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: PAGE_STYLE.textSecondary, marginBottom: 10 }}>
              Notes de l&apos;événement
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              placeholder="Prendre des notes pendant ou après l'événement…"
              style={{
                width: '100%',
                padding: 12,
                fontSize: 13,
                border: `1px solid ${PAGE_STYLE.border}`,
                borderRadius: 8,
                resize: 'vertical',
                color: PAGE_STYLE.text,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <div style={{ fontSize: 11, color: PAGE_STYLE.textSecondary }}>
                {lastNotesUpdate && `Dernière modification le ${formatDateTime(lastNotesUpdate)}`}
              </div>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: PAGE_STYLE.gold,
                  color: PAGE_STYLE.accent,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: savingNotes ? 'default' : 'pointer',
                  opacity: savingNotes ? 0.7 : 1,
                }}
              >
                {savingNotes ? 'Enregistrement…' : 'Enregistrer les notes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

