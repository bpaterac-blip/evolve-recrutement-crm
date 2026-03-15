import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { supabase } from '../lib/supabase'
import { useCRM } from '../context/CRMContext'
import {
  STAGES,
  MATURITIES,
  SOURCES,
  REGIONS,
  STAGE_COLORS,
  MATURITY_COLORS,
  INTEG_OPTS,
  INTEG_ADD_DATE,
  NOTE_TEMPLATES,
  EVENT_TYPES,
} from '../lib/data'
import InlineDropdown from '../components/InlineDropdown'

console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Supabase KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'OK' : 'MANQUANTE')

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
  transition: 'all 0.15s ease',
}

function formatRelative(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - d
  const min = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  if (h < 24) return `il y a ${h} h`
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} jours`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatNoteDate(createdAt) {
  if (!createdAt) return ''
  const d = new Date(createdAt)
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
  return `${date} à ${time}`
}

function formatActivityDateTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${date} à ${time.replace(':', 'h')}`
}

function notePreview(content, maxLines = 3) {
  if (!content) return { lines: [], hasMore: false }
  const lines = content.split('\n')
  const preview = lines.slice(0, maxLines)
  return { lines: preview, hasMore: lines.length > maxLines }
}

function capFirst(str) {
  if (!str || typeof str !== 'string') return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function initials(fn, ln) {
  return ((fn?.[0] || '') + (ln?.[0] || '')).toUpperCase() || '?'
}

export default function ProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    profiles,
    updateProfile,
    updateProfileField,
    changeStage,
    changeMaturity,
    changeInteg,
    changeSource,
    changeRegion,
    saveNote,
    updateNote,
    deleteNote,
    deleteProfile,
    addEvent,
    fetchNotes,
    loadProfileDetail,
    profileActivities,
    deleteActivity,
    deleteEvent,
    today,
    useSupabase,
  } = useCRM()

  const profileIndex = profiles.findIndex((p) => String(p.id) === String(id))
  const profile = profileIndex >= 0 ? profiles[profileIndex] : null
  const totalProfiles = profiles.length
  const currentNum = profileIndex >= 0 ? profileIndex + 1 : 0

  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [notesList, setNotesList] = useState([])
  const [noteContent, setNoteContent] = useState('')
  const [noteTemplate, setNoteTemplate] = useState('Note libre')
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [evType, setEvType] = useState('RDV planifié')
  const [evDate, setEvDate] = useState('')
  const [evDetail, setEvDetail] = useState('')
  const [evNotes, setEvNotes] = useState('')
  const [showEventForm, setShowEventForm] = useState(false)
  const [ddIntegCustom, setDdIntegCustom] = useState(false)
  const [integCustomVal, setIntegCustomVal] = useState('')
  const [activeTab, setActiveTab] = useState('activity')
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [localActivities, setLocalActivities] = useState([])
  const [localEvents, setLocalEvents] = useState([])
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingNoteContent, setEditingNoteContent] = useState('')
  const [expandedNoteIds, setExpandedNoteIds] = useState(new Set())

  const mapActivityRow = (a) => {
    // Schéma réel activities : profile_id, type, note, date (text), icon, source, created_at
    const tsSource = a.created_at || a.date
    const ts = tsSource ? new Date(tsSource).getTime() : undefined
    const mainText = a.note || ''
    const formatted = ts ? formatActivityDateTime(ts) : ''
    return {
      id: a.id,
      _source: 'activity',
      d: formatted,        // unique date string
      t: mainText,         // description lisible
      n: undefined,        // pas de seconde ligne de date
      ico: a.icon || '•',
      type: a.type || 'std',
      ts,
    }
  }

  const mapEventRow = (e) => {
    // Schéma réel events : profile_id, content, date (text), created_at
    const tsSource = e.created_at || e.date
    const ts = tsSource ? new Date(tsSource).getTime() : undefined
    const mainText = e.content || ''
    const formatted = ts ? formatActivityDateTime(ts) : ''
    return {
      id: e.id,
      _source: 'event',
      d: formatted,        // unique date string
      t: mainText,         // description (content)
      n: undefined,
      ico: '📌',
      type: 'event',
      ts,
    }
  }

  const loadActivitiesAndEvents = useCallback(async () => {
    if (!id || !useSupabase) return
    const { data: acts } = await supabase.from('activities').select('*').eq('profile_id', id).order('created_at', { ascending: false })
    const { data: evts } = await supabase.from('events').select('*').eq('profile_id', id).order('created_at', { ascending: false })
    setLocalActivities(acts || [])
    setLocalEvents(evts || [])
  }, [id, useSupabase])

  useEffect(() => {
    if (!id) return
    setLoadingDetail(true)
    if (!useSupabase) {
      setLocalActivities([])
      setLocalEvents([])
      setLoadingDetail(false)
      return
    }
    loadActivitiesAndEvents().finally(() => setLoadingDetail(false))
  }, [id, useSupabase, loadActivitiesAndEvents])

  useEffect(() => {
    if (!profile?.id || !useSupabase) return
    fetchNotes(profile.id).then((data) => setNotesList(data || []))
  }, [profile?.id, useSupabase, fetchNotes])

  useEffect(() => {
    setNoteContent(NOTE_TEMPLATES[noteTemplate] ?? '')
  }, [noteTemplate])

  const goPrev = () => {
    if (profileIndex > 0) navigate(`/profiles/${profiles[profileIndex - 1].id}`)
  }
  const goNext = () => {
    if (profileIndex >= 0 && profileIndex < totalProfiles - 1) navigate(`/profiles/${profiles[profileIndex + 1].id}`)
  }

  if (!profile && profiles.length > 0) {
    return (
      <div style={{ background: PAGE_STYLE.bg, minHeight: '100%', padding: 22 }}>
        <button type="button" style={{ color: PAGE_STYLE.textSecondary, fontSize: 13 }} onClick={() => navigate('/profiles')}>← Retour aux profils</button>
        <div style={{ color: PAGE_STYLE.textSecondary, marginTop: 16 }}>Profil introuvable.</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div style={{ background: PAGE_STYLE.bg, minHeight: '100%', padding: 22 }}>
        <button type="button" style={{ color: PAGE_STYLE.textSecondary }} onClick={() => navigate('/profiles')}>← Retour aux profils</button>
        <div style={{ color: PAGE_STYLE.textSecondary, marginTop: 16 }}>Chargement…</div>
      </div>
    )
  }

  const stag = (s) => STAGE_COLORS[s] ? { backgroundColor: STAGE_COLORS[s].bg, color: STAGE_COLORS[s].text } : {}
  const matStyle = (m) => MATURITY_COLORS[m] ? { backgroundColor: MATURITY_COLORS[m].bg, color: MATURITY_COLORS[m].text } : { color: PAGE_STYLE.textSecondary }

  const handleDeleteActivity = async (a) => {
    if (!a.id || !a._source) return
    if (!window.confirm('Supprimer cette entrée d’activité ?')) return
    if (a._source === 'activity') await deleteActivity(profile.id, a.id)
    else if (a._source === 'event') await deleteEvent(profile.id, a.id)
    if (useSupabase) await loadActivitiesAndEvents()
  }

  const startEdit = (field, currentVal) => {
    setEditingField(field)
    setEditValue(currentVal ?? '')
  }
  const saveEdit = async (field) => {
    if (editingField !== field) return
    const profileId = profile?.id || id
    const oldVal = profile?.[field] ?? ''
    updateProfileField(profile.id, field, editValue.trim())
    setEditingField(null)
    setEditValue('')
    refreshActivities()
    if (!useSupabase || !profileId) return
    await supabase.from('activities').insert({
      profile_id: profileId,
      type: 'field_edit',
      note: `${field}: ${oldVal} → ${editValue.trim()}`,
      date: new Date().toISOString().split('T')[0],
      icon: '✏️',
      source: 'manual',
    })
    await loadActivitiesAndEvents()
  }

  const handleSaveNote = async () => {
    const profileId = profile?.id || id
    await saveNote(profile.id, noteContent)
    setNoteContent(NOTE_TEMPLATES[noteTemplate] ?? '')
    setShowNoteForm(false)
    const list = await fetchNotes(profile.id)
    setNotesList(list || [])
    if (!useSupabase || !profileId) {
      await loadActivitiesAndEvents()
      return
    }
    await supabase.from('activities').insert({
      profile_id: profileId,
      type: 'note_added',
      note: noteContent,
      date: new Date().toISOString().split('T')[0],
      icon: '📝',
      source: 'manual',
    })
    await loadActivitiesAndEvents()
  }

  const handleAddEvent = async () => {
    const eventForm = { type: evType, date: evDate || today(), detail: evDetail, notes: evNotes }
    const profileId = profile?.id || id
    console.log('handleAddEvent appelé', eventForm)
    if (!useSupabase || !profileId) {
      await addEvent(profileId, { type: evType, date: evDate || today(), note: evDetail })
      setEvDate('')
      setEvDetail('')
      setEvNotes('')
      setShowEventForm(false)
      await loadActivitiesAndEvents()
      return
    }
    const eventDate = eventForm.date || today()
    const { data, error } = await supabase.from('events').insert({
      profile_id: profileId,
      content: eventForm.type + (eventForm.detail ? ' — ' + eventForm.detail : ''),
      date: eventDate,
      notes: eventForm.notes || null,
    })
    console.log('Insert event result:', data, error)
    await supabase.from('activities').insert({
      profile_id: profileId,
      type: 'event_added',
      note: eventForm.type + (eventForm.detail ? ' — ' + eventForm.detail : ''),
      date: new Date().toISOString().split('T')[0],
      icon: '📌',
      source: 'manual',
    })
    setEvDate('')
    setEvDetail('')
    setEvNotes('')
    setShowEventForm(false)
    await loadActivitiesAndEvents()
  }

  const handleDeleteProfile = async () => {
    if (!window.confirm('Supprimer ce profil ?')) return
    await deleteProfile(profile.id)
    navigate('/profiles')
  }

  const handleExportPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const margin = 18
    let y = margin
    const lineH = 6
    const push = (text, opts = {}) => {
      doc.setFontSize(opts.size || 10)
      doc.text(String(text || '—'), margin, y)
      y += lineH + (opts.extra || 0)
    }
    doc.setFontSize(16)
    doc.text(`Fiche profil : ${capFirst(profile.fn)} ${capFirst(profile.ln)}`, margin, y)
    y += lineH + 4
    doc.setFontSize(10)
    push(`Employeur : ${profile.co}`)
    push(`Intitulé : ${profile.ti}`)
    push(`Ville : ${profile.city}`)
    push(`Région : ${profile.region || '—'}`)
    push(`Score : ${profile.sc}`)
    push(`Maturité : ${profile.mat}`)
    push(`Stade : ${profile.stg}`)
    push(`Source : ${profile.src}`)
    push(`Intégration potentielle : ${profile.integ || '—'}`)
    push(`Email : ${profile.mail}`)
    push(`LinkedIn : ${profile.li}`)
    y += 4
    doc.setFontSize(12)
    doc.text('Notes', margin, y)
    y += lineH
    doc.setFontSize(10)
    if (notesList.length === 0) {
      push('Aucune note.')
    } else {
      notesList.forEach((n, i) => {
        push(`Note ${i + 1} (${formatNoteDate(n.created_at)})`)
        const lines = doc.splitTextToSize((n.content || '').slice(0, 800), 170)
        lines.forEach((l) => { doc.text(l, margin, y); y += lineH })
        y += 2
      })
    }
    y += 4
    doc.setFontSize(12)
    doc.text('Historique des activités', margin, y)
    y += lineH
    doc.setFontSize(10)
    if (mergedActs.length === 0) {
      push('Aucune activité.')
    } else {
      mergedActs.slice(0, 50).forEach((a) => {
        const line = `${a.ts ? formatActivityDateTime(a.ts) : a.d} — ${a.t}${a.n ? ` : ${a.n}` : ''}`
        const lines = doc.splitTextToSize(line, 170)
        lines.forEach((l) => { doc.text(l, margin, y); y += lineH })
        if (y > 270) { doc.addPage(); y = margin }
      })
    }
    const safe = (s) => (s || '').replace(/\s+/g, '-').replace(/[^\w\-]/g, '') || 'profil'
    doc.save(`profil-${safe(profile.ln)}-${safe(profile.fn)}.pdf`)
  }

  const mergedActs = [...localActivities.map(mapActivityRow), ...localEvents.map(mapEventRow)].sort((a, b) => (b.ts || 0) - (a.ts || 0))
  const eventsMapped = localEvents.map(mapEventRow)

  const refreshActivities = () => { if (useSupabase) setTimeout(() => loadActivitiesAndEvents(), 400) }

  const handleChangeStage = async (newStage) => {
    const profileId = profile?.id || id
    const oldStage = profile?.stg ?? ''
    console.log('handleChangeStage appelé', id, newStage)
    if (!useSupabase || !profileId) {
      changeStage(profileId, newStage)
      refreshActivities()
      return
    }
    await supabase.from('profiles').update({ stage: newStage }).eq('id', profileId)
    updateProfile(profileId, { stg: newStage })
    const { error: actError } = await supabase.from('activities').insert({
      profile_id: profileId,
      type: 'stage_change',
      note: `${oldStage} → ${newStage}`,
      date: new Date().toISOString().split('T')[0],
      icon: '🔄',
      source: 'manual',
    })
    console.log('Insert activité result:', actError)
    await loadActivitiesAndEvents()
  }

  const handleChangeMaturity = async (newMat) => {
    const profileId = profile?.id || id
    const oldMat = profile?.mat ?? ''
    changeMaturity(profileId, newMat)
    refreshActivities()
    if (!useSupabase || !profileId) return
    await supabase.from('activities').insert({
      profile_id: profileId,
      type: 'maturity_change',
      note: `${oldMat} → ${newMat}`,
      date: new Date().toISOString().split('T')[0],
      icon: '🌡',
      source: 'manual',
    })
    await loadActivitiesAndEvents()
  }

  const handleChangeSource = async (newSrc) => {
    const profileId = profile?.id || id
    const oldSrc = profile?.src ?? ''
    changeSource(profileId, newSrc)
    refreshActivities()
    if (!useSupabase || !profileId) return
    await supabase.from('activities').insert({
      profile_id: profileId,
      type: 'source_change',
      note: `${oldSrc} → ${newSrc}`,
      date: new Date().toISOString().split('T')[0],
      icon: '📋',
      source: 'manual',
    })
    await loadActivitiesAndEvents()
  }

  const handleChangeRegion = async (newRegion) => {
    const profileId = profile?.id || id
    const oldRegion = profile?.region ?? ''
    changeRegion(profileId, newRegion)
    refreshActivities()
    if (!useSupabase || !profileId) return
    await supabase.from('activities').insert({
      profile_id: profileId,
      type: 'region_change',
      note: `${oldRegion || '—'} → ${newRegion || '—'}`,
      date: new Date().toISOString().split('T')[0],
      icon: '📍',
      source: 'manual',
    })
    await loadActivitiesAndEvents()
  }

  const handleChangeInteg = async (newInteg) => {
    const profileId = profile?.id || id
    const oldInteg = profile?.integ ?? ''
    changeInteg(profileId, newInteg)
    refreshActivities()
    if (!useSupabase || !profileId || oldInteg === newInteg) return
    await supabase.from('activities').insert({
      profile_id: profileId,
      type: 'integration_change',
      note: `${oldInteg || '—'} → ${newInteg || '—'}`,
      date: new Date().toISOString().split('T')[0],
      icon: '📅',
      source: 'manual',
    })
    await loadActivitiesAndEvents()
  }

  const linkUrl = (v) => (v && (v.startsWith('http') ? v : `https://${v}`))
  const FieldRow = ({ field, value, label, icon, placeholder, isLink }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${PAGE_STYLE.border}` }}>
      <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 24 }}>{icon}</span>
      <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 100, flexShrink: 0 }}>{label}</span>
      {editingField === field ? (
        <div style={{ display: 'flex', gap: 8, flex: 1 }}>
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveEdit(field)}
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: 13,
              border: `2px solid ${PAGE_STYLE.accent}`,
              borderRadius: 6,
              outline: 'none',
            }}
            autoFocus
          />
          <button type="button" onClick={() => saveEdit(field)} style={{ padding: '6px 12px', background: PAGE_STYLE.accent, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>✓</button>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, minWidth: 0 }}>
            {isLink && value && linkUrl(value) ? (
              <a href={linkUrl(value)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 13, color: PAGE_STYLE.accent, textDecoration: 'underline' }}>{(value || '').trim() || placeholder}</a>
            ) : (
              <span style={{ fontSize: 13, color: value ? PAGE_STYLE.text : PAGE_STYLE.textSecondary }}>{(value || placeholder || '—').toString().trim() || '—'}</span>
            )}
          </div>
          <button type="button" onClick={() => startEdit(field, value)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: PAGE_STYLE.textSecondary, fontSize: 12 }} title="Modifier">✎</button>
        </>
      )}
    </div>
  )

  const tabStyle = (active) => ({
    padding: '12px 0',
    marginRight: 24,
    fontSize: 14,
    fontWeight: 500,
    color: active ? PAGE_STYLE.accent : PAGE_STYLE.textSecondary,
    borderBottom: active ? `2px solid ${PAGE_STYLE.accent}` : '2px solid transparent',
    cursor: 'pointer',
    transition: PAGE_STYLE.transition,
  })

  const handleSaveNoteEdit = async () => {
    if (!editingNoteId) return
    await updateNote(profile.id, editingNoteId, editingNoteContent, notesList.find((n) => n.id === editingNoteId)?.content)
    setEditingNoteId(null)
    setEditingNoteContent('')
    const list = await fetchNotes(profile.id)
    setNotesList(list || [])
  }

  return (
    <div style={{ background: PAGE_STYLE.bg, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, padding: '22px 28px 0' }}>
        <button type="button" style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, marginBottom: 20 }} onClick={() => navigate('/profiles')}>← Retour aux profils</button>

        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: PAGE_STYLE.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, flexShrink: 0 }}>
            {initials(profile.fn, profile.ln)}
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: PAGE_STYLE.text, margin: 0 }}>
              {capFirst(profile.fn)} {capFirst(profile.ln)}
            </h1>
            <p style={{ fontSize: 14, color: PAGE_STYLE.textSecondary, marginTop: 4 }}>{profile.co} · {profile.ti}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, ...stag(profile.stg) }}>{profile.stg}</span>
          <span style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, ...matStyle(profile.mat), background: 'rgba(0,0,0,0.06)' }}>{profile.mat}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={goPrev} disabled={currentNum <= 1} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${PAGE_STYLE.border}`, background: PAGE_STYLE.cardBg, cursor: currentNum <= 1 ? 'not-allowed' : 'pointer', opacity: currentNum <= 1 ? 0.5 : 1 }}>←</button>
          <span style={{ fontSize: 13, color: PAGE_STYLE.textSecondary }}>{currentNum} / {totalProfiles}</span>
          <button type="button" onClick={goNext} disabled={currentNum >= totalProfiles} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${PAGE_STYLE.border}`, background: PAGE_STYLE.cardBg, cursor: currentNum >= totalProfiles ? 'not-allowed' : 'pointer', opacity: currentNum >= totalProfiles ? 0.5 : 1 }}>→</button>
        </div>
      </header>
      </div>

      <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '40% 1fr', gap: 24, flex: 1, minHeight: 0, padding: '0 28px 22px', overflow: 'hidden' }}>
        <div style={{ overflowY: 'auto', minHeight: 0 }}>
          <div style={{ background: PAGE_STYLE.cardBg, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: PAGE_STYLE.radius, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: PAGE_STYLE.textSecondary, marginBottom: 16 }}>Informations</div>
            <FieldRow field="fn" value={profile.fn} label="Prénom" icon="👤" />
            <FieldRow field="ln" value={profile.ln} label="Nom" icon="👤" />
            <FieldRow field="mail" value={profile.mail} label="Email" icon="✉" placeholder="email@…" />
            <FieldRow field="li" value={profile.li} label="LinkedIn" icon="🔗" placeholder="linkedin.com/in/…" isLink />
            <FieldRow field="co" value={profile.co} label="Employeur" icon="🏢" />
            <FieldRow field="ti" value={profile.ti} label="Intitulé" icon="💼" />
            <FieldRow field="city" value={profile.city} label="Ville" icon="📍" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${PAGE_STYLE.border}` }}>
              <span style={{ width: 24 }}>🗺</span>
              <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 100 }}>Région</span>
              <select value={profile.region || ''} onChange={(e) => handleChangeRegion(e.target.value)} style={{ flex: 1, padding: '6px 10px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6 }}>
                <option value="">—</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${PAGE_STYLE.border}` }}>
              <span style={{ width: 24 }}>📌</span>
              <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 100 }}>Source</span>
              <div style={{ flex: 1 }}>
                <InlineDropdown options={SOURCES} value={profile.src} onChange={handleChangeSource} buttonStyle={() => ({ border: `1px solid ${PAGE_STYLE.border}`, background: PAGE_STYLE.cardBg, color: PAGE_STYLE.text })} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${PAGE_STYLE.border}` }}>
              <span style={{ width: 24 }}>🌡</span>
              <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 100 }}>Maturité</span>
              <div style={{ flex: 1 }}>
                <InlineDropdown options={MATURITIES} value={profile.mat} onChange={handleChangeMaturity} buttonStyle={matStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${PAGE_STYLE.border}` }}>
              <span style={{ width: 24 }}>↗</span>
              <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 100 }}>Stade</span>
              <div style={{ flex: 1 }}>
                <InlineDropdown options={STAGES} value={profile.stg} onChange={handleChangeStage} buttonStyle={stag} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
              <span style={{ width: 24 }}>📅</span>
              <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 100 }}>Intégration potentielle</span>
              {!ddIntegCustom ? (
                <select value={profile.integ || '—'} onChange={(e) => { const v = e.target.value; if (v === INTEG_ADD_DATE) setDdIntegCustom(true); else handleChangeInteg(v); }} style={{ flex: 1, padding: '6px 10px', fontSize: 13, borderRadius: 6, border: 'none', background: '#D4EDE1', color: '#1A7A4A', cursor: 'pointer' }}>
                  {INTEG_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                  {profile.integ && !INTEG_OPTS.includes(profile.integ) && <option value={profile.integ}>{profile.integ}</option>}
                  <option value={INTEG_ADD_DATE}>{INTEG_ADD_DATE}</option>
                </select>
              ) : (
                <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                  <input type="text" placeholder="ex: Mars 2027" value={integCustomVal} onChange={(e) => setIntegCustomVal(e.target.value)} style={{ flex: 1, padding: '6px 10px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6 }} />
                  <button type="button" onClick={() => { if (integCustomVal.trim()) { handleChangeInteg(integCustomVal.trim()); setDdIntegCustom(false); setIntegCustomVal(''); } }} style={{ padding: '6px 12px', background: PAGE_STYLE.green, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>✓</button>
                  <button type="button" onClick={() => { setDdIntegCustom(false); setIntegCustomVal(''); }} style={{ padding: '6px 12px', background: 'none', border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 24, background: PAGE_STYLE.cardBg, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: PAGE_STYLE.radius, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: PAGE_STYLE.textSecondary, marginBottom: 16 }}>Actions rapides</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="button" style={{ padding: '10px 14px', textAlign: 'left', borderRadius: 8, border: `1px solid ${PAGE_STYLE.border}`, background: 'none', cursor: 'pointer', fontSize: 13, transition: PAGE_STYLE.transition }}>📅 Planifier un RDV Google Meet</button>
              <button type="button" onClick={handleExportPDF} style={{ padding: '10px 14px', textAlign: 'left', borderRadius: 8, border: `1px solid ${PAGE_STYLE.border}`, background: 'none', cursor: 'pointer', fontSize: 13, transition: PAGE_STYLE.transition }}>📤 Exporter la fiche</button>
              <button type="button" onClick={handleDeleteProfile} style={{ padding: '10px 14px', textAlign: 'left', borderRadius: 8, border: '1px solid #e5c0c0', background: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 13 }}>🗑 Supprimer le profil</button>
            </div>
          </div>
        </div>

        <div style={{ background: PAGE_STYLE.cardBg, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: PAGE_STYLE.radius, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflowY: 'auto', minHeight: 0 }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${PAGE_STYLE.border}`, marginBottom: 20 }}>
            <button type="button" style={tabStyle(activeTab === 'activity')} onClick={() => setActiveTab('activity')}>Activité</button>
            <button type="button" style={tabStyle(activeTab === 'notes')} onClick={() => setActiveTab('notes')}>Notes</button>
            <button type="button" style={tabStyle(activeTab === 'events')} onClick={() => setActiveTab('events')}>Événements</button>
          </div>

          {activeTab === 'activity' && (
            <div style={{ position: 'relative', paddingLeft: 24 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: PAGE_STYLE.accent, borderRadius: 1 }} />
              {loadingDetail && mergedActs.length === 0 && localActivities.length === 0 && localEvents.length === 0 ? (
                <div style={{ color: PAGE_STYLE.textSecondary, fontSize: 13 }}>Chargement…</div>
              ) : mergedActs.length === 0 ? (
                <div style={{ color: PAGE_STYLE.textSecondary, fontSize: 13 }}>Aucune activité</div>
              ) : (
                mergedActs.map((a, i) => (
                  <div key={a.id ? `${a._source}-${a.id}` : `act-${i}`} style={{ position: 'relative', paddingBottom: 20 }} className="activity-row">
                    <div style={{ position: 'absolute', left: -28, top: 2, width: 10, height: 10, borderRadius: '50%', background: PAGE_STYLE.cardBg, border: `2px solid ${PAGE_STYLE.accent}` }} />
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <span style={{ fontSize: 16 }}>{a.ico || '•'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: PAGE_STYLE.text }}>{a.t}</div>
                        <div style={{ fontSize: 11, color: PAGE_STYLE.textSecondary, marginTop: 4 }}>{a.d}</div>
                      </div>
                      {a.id && a._source && (
                        <button type="button" onClick={() => handleDeleteActivity(a)} title="Supprimer" style={{ opacity: 0.5, padding: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: PAGE_STYLE.textSecondary, flexShrink: 0 }} className="activity-delete-btn">✕</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button type="button" onClick={() => setShowNoteForm(!showNoteForm)} style={{ padding: '8px 16px', background: PAGE_STYLE.gold, color: PAGE_STYLE.accent, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Nouvelle note</button>
              </div>
              {showNoteForm && (
                <div style={{ marginBottom: 24, padding: 20, background: '#F9F8F6', borderRadius: PAGE_STYLE.radius, border: `1px solid ${PAGE_STYLE.border}` }}>
                  <select value={noteTemplate} onChange={(e) => setNoteTemplate(e.target.value)} style={{ marginBottom: 12, padding: '8px 12px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6 }}>
                    {Object.keys(NOTE_TEMPLATES).map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Saisir une note…" rows={5} style={{ width: '100%', padding: 12, fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, resize: 'vertical', marginBottom: 12 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={handleSaveNote} style={{ padding: '8px 16px', background: PAGE_STYLE.green, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Enregistrer</button>
                    <button type="button" onClick={() => { setShowNoteForm(false); setNoteContent(NOTE_TEMPLATES[noteTemplate] ?? ''); }} style={{ padding: '8px 16px', background: 'none', border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                  </div>
                </div>
              )}
              {notesList.map((n) => (
                <div key={n.id} style={{ position: 'relative', marginBottom: 16, padding: 16, background: PAGE_STYLE.cardBg, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: PAGE_STYLE.radius, transition: PAGE_STYLE.transition }} className="note-card">
                  <div style={{ fontSize: 11, color: PAGE_STYLE.textSecondary, marginBottom: 8, textAlign: 'left' }}>
                    {formatNoteDate(n.created_at)}
                    {n.updated_at && new Date(n.updated_at).getTime() !== new Date(n.created_at).getTime() && (
                      <div style={{ marginTop: 4 }}>Modifiée le {formatNoteDate(n.updated_at)}</div>
                    )}
                  </div>
                  {editingNoteId === n.id ? (
                    <div>
                      <textarea value={editingNoteContent} onChange={(e) => setEditingNoteContent(e.target.value)} rows={6} style={{ width: '100%', padding: 12, fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, resize: 'vertical', marginBottom: 10 }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={handleSaveNoteEdit} style={{ padding: '8px 16px', background: PAGE_STYLE.green, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Enregistrer les modifications</button>
                        <button type="button" onClick={() => { setEditingNoteId(null); setEditingNoteContent(''); }} style={{ padding: '8px 16px', background: 'none', border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setEditingNoteId(n.id); setEditingNoteContent(n.content || ''); }} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, whiteSpace: 'pre-wrap', color: PAGE_STYLE.text }}>
                        {(() => { const { lines, hasMore } = notePreview(n.content); const expanded = expandedNoteIds.has(n.id); return expanded ? (n.content || '') : (lines.join('\n') + (hasMore ? '\n…' : '')); })()}
                      </button>
                      {notePreview(n.content).hasMore && !expandedNoteIds.has(n.id) && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedNoteIds((s) => new Set([...s, n.id])); }} style={{ marginTop: 6, fontSize: 12, color: PAGE_STYLE.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Voir plus...</button>
                      )}
                      {expandedNoteIds.has(n.id) && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedNoteIds((s) => { const next = new Set(s); next.delete(n.id); return next; }); }} style={{ marginTop: 6, fontSize: 12, color: PAGE_STYLE.textSecondary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Voir moins</button>
                      )}
                      <button type="button" onClick={async (e) => { e.stopPropagation(); if (!window.confirm('Supprimer cette note ?')) return; await deleteNote(profile.id, n.id, n.content); const list = await fetchNotes(profile.id); setNotesList(list || []); }} style={{ position: 'absolute', top: 12, right: 12, padding: 4, background: 'none', border: 'none', cursor: 'pointer', opacity: 0, fontSize: 14 }} title="Supprimer" className="note-delete-btn">✕</button>
                    </>
                  )}
                </div>
              ))}
              {notesList.length === 0 && !showNoteForm && <div style={{ color: PAGE_STYLE.textSecondary, fontSize: 13 }}>Aucune note</div>}
            </>
          )}

          {activeTab === 'events' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button type="button" onClick={() => setShowEventForm(!showEventForm)} style={{ padding: '8px 16px', background: PAGE_STYLE.gold, color: PAGE_STYLE.accent, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Ajouter un événement</button>
              </div>
              {showEventForm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, padding: 20, background: '#F9F8F6', borderRadius: PAGE_STYLE.radius, border: `1px solid ${PAGE_STYLE.border}` }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    <select value={evType} onChange={(e) => setEvType(e.target.value)} style={{ padding: '8px 12px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, minWidth: 160 }}>
                      {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} style={{ padding: '8px 12px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6 }} />
                    <input type="text" value={evDetail} onChange={(e) => setEvDetail(e.target.value)} placeholder="Détail optionnel" style={{ flex: 1, minWidth: 120, padding: '8px 12px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6 }} />
                  </div>
                  <textarea
                    value={evNotes}
                    onChange={(e) => setEvNotes(e.target.value)}
                    placeholder="Notes (optionnel)…"
                    rows={3}
                    style={{ width: '100%', padding: 10, fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={handleAddEvent} style={{ padding: '8px 16px', background: PAGE_STYLE.green, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Ajouter</button>
                  </div>
                </div>
              )}
              {eventsMapped.map((a, i) => (
                <div
                  key={a.id || i}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: 14, background: PAGE_STYLE.cardBg, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: PAGE_STYLE.radius, cursor: 'pointer' }}
                  onClick={() => a.id && navigate(`/events/${a.id}`)}
                >
                  <span style={{ fontSize: 18 }}>{a.ico || '📌'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.t}</div>
                    <div style={{ fontSize: 12, color: PAGE_STYLE.textSecondary }}>{a.d}</div>
                  </div>
                </div>
              ))}
              {eventsMapped.length === 0 && !showEventForm && <div style={{ color: PAGE_STYLE.textSecondary, fontSize: 13 }}>Aucun événement</div>}
            </>
          )}
        </div>
      </div>

      <style>{`
        .note-card:hover .note-delete-btn { opacity: 1; }
        .activity-row:hover .activity-delete-btn { opacity: 1; }
        @media (max-width: 900px) {
          .profile-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
