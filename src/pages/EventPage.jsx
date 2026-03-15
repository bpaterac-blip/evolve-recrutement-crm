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

const EVENT_TYPE_STYLES = {
  'RDV planifié': { bg: '#DBE8F5', text: '#1E5FA0', border: '#1E5FA0' },
  'Point d\'étape': { bg: '#FDEBC8', text: '#B86B0F', border: '#B86B0F' },
  'Démission reconversion': { bg: '#FDDEDE', text: '#C0392B', border: '#C0392B' },
  'Relance': { bg: '#E0F2F7', text: '#0E7490', border: '#0E7490' },
}

function formatDateTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
  return `${date} à ${time}`
}

export default function EventPage() {
  // 1. TOUS les hooks ici
  const { profiles } = useCRM()
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState('')
  const [notes, setNotes] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [nextStepDate, setNextStepDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [lastNotesUpdate, setLastNotesUpdate] = useState(null)

  // 2. TOUS les useEffect ici
  // Chargement de l'événement
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
      setNextStep(data.next_step || '')
      setNextStepDate(data.next_step_date || '')
      setLastNotesUpdate(data.updated_at || data.created_at || null)
      setLoading(false)
    }
    if (eventId) load()
  }, [eventId])

  // Autosave global pour détail, notes et prochaine étape
  useEffect(() => {
    if (!eventId || !event) return
    const timeout = setTimeout(async () => {
      setSaving(true)
      const { error } = await supabase
        .from('events')
        .update({
          content: detail,
          notes,
          next_step: nextStep,
          next_step_date: nextStepDate,
        })
        .eq('id', eventId)
      if (error) {
        console.error('Erreur autosave event', error)
      } else {
        const nowIso = new Date().toISOString()
        setLastNotesUpdate(nowIso)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
      setSaving(false)
    }, 2000)
    return () => clearTimeout(timeout)
  }, [event, eventId, detail, notes, nextStep, nextStepDate])

  // 3. Fonctions helpers (pas de hooks)
  if (loading) {
    // 4. Return conditionnel EN DERNIER (mais avant le JSX principal)
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
  const eventDate = event.created_at || event.date
  const baseType = headerTitle
  const typeStyle = EVENT_TYPE_STYLES[baseType] || { bg: '#F3F1EE', text: '#173731', border: '#173731' }

  const isUpcoming = (() => {
    const refDate = event.date || event.created_at
    if (!refDate) return false
    const d = new Date(refDate)
    const now = new Date()
    return d.getTime() > now.getTime()
  })()

  const savedLabel = saving ? 'Enregistrement…' : saved ? 'Enregistré ✓' : ''

  // 4. JSX principal
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
        <div
          style={{
            background: PAGE_STYLE.cardBg,
            border: `1px solid ${PAGE_STYLE.border}`,
            borderRadius: 12,
            padding: 22,
            boxShadow: '0 6px 14px rgba(0,0,0,0.05)',
            borderLeft: `4px solid ${typeStyle.border}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: typeStyle.bg,
                  color: typeStyle.text,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 8,
                }}
              >
                {baseType}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: PAGE_STYLE.text, marginBottom: 4 }}>{headerTitle}</div>
              <div style={{ fontSize: 13, color: PAGE_STYLE.textSecondary }}>
                {eventDate ? formatDateTime(eventDate) : 'Date inconnue'}
                {' · '}
                <span style={{ fontWeight: 600, color: isUpcoming ? PAGE_STYLE.green : PAGE_STYLE.textSecondary }}>
                  {isUpcoming ? 'À venir' : 'Passé'}
                </span>
              </div>
            </div>
            {profile && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: PAGE_STYLE.textSecondary, marginBottom: 4 }}>Profil associé</div>
                <Link
                  to={`/profiles/${profile.id}`}
                  style={{ fontSize: 14, fontWeight: 600, color: PAGE_STYLE.accent, textDecoration: 'none' }}
                >
                  {profile.fn} {profile.ln} →
                </Link>
              </div>
            )}
          </div>
          {savedLabel && (
            <div style={{ marginTop: 8, fontSize: 11, color: PAGE_STYLE.green }}>{savedLabel}</div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              background: PAGE_STYLE.cardBg,
              border: `1px solid ${PAGE_STYLE.border}`,
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 4px 10px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: PAGE_STYLE.textSecondary, marginBottom: 10 }}>
              Résumé de l&apos;échange
            </div>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={5}
              placeholder="Décrivez le déroulé de l'échange..."
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
          </div>

          <div
            style={{
              background: PAGE_STYLE.cardBg,
              border: `1px solid ${PAGE_STYLE.border}`,
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 4px 10px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: PAGE_STYLE.textSecondary, marginBottom: 10 }}>
              Notes privées
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              placeholder="Vos observations, points clés, prochaines étapes..."
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
              <div style={{ fontSize: 11, color: PAGE_STYLE.textSecondary }}>
                {notes.length} caractères
              </div>
            </div>
          </div>

          <div
            style={{
              background: PAGE_STYLE.cardBg,
              border: `1px solid ${PAGE_STYLE.border}`,
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 4px 10px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: PAGE_STYLE.textSecondary, marginBottom: 10 }}>
              Prochaine étape
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                placeholder="Quelle est la prochaine étape ?"
                style={{
                  flex: 1,
                  minWidth: 180,
                  padding: '8px 12px',
                  fontSize: 13,
                  border: `1px solid ${PAGE_STYLE.border}`,
                  borderRadius: 6,
                }}
              />
              <input
                type="date"
                value={nextStepDate}
                onChange={(e) => setNextStepDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  border: `1px solid ${PAGE_STYLE.border}`,
                  borderRadius: 6,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

