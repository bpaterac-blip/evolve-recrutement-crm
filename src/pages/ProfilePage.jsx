import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { supabase } from '../lib/supabase'
import { useCRM } from '../context/CRMContext'
import { useAuth } from '../context/AuthContext'
import { getExperienceBadge } from '../lib/scoring'
import {
  STAGES,
  MATURITIES,
  SOURCES,
  REGIONS,
  STAGE_COLORS,
  MATURITY_COLORS,
  NOTE_TEMPLATES,
  EVENT_TYPES,
  EVENT_FORM_TYPES,
} from '../lib/data'

const SESSION_CIBLE_STAGES = ['Point Business Plan', "Point d'étape téléphonique", "Point d'étape", 'Démission reconversion', 'R2 Amaury', 'Point juridique', 'Intégration', 'Recruté']
import InlineDropdown from '../components/InlineDropdown'
import ScoreCorrectionModal from '../components/ScoreCorrectionModal'
import ChuteModal from '../components/ChuteModal'
import GrilleNotationTab from '../components/GrilleNotationTab'
import AISummaryModal from '../components/AISummaryModal'
import { ActivityIcon, IconMap, IconCalendar, IconUpload, IconTrash, IconPencil, IconClose, IconDocument } from '../components/Icons'

const ICON_S = 14
const IconEnvelope = () => <svg width={ICON_S} height={ICON_S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
const IconLink = () => <svg width={ICON_S} height={ICON_S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
const IconBuilding = () => <svg width={ICON_S} height={ICON_S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h2" /><path d="M14 6h2" /><path d="M8 10h2" /><path d="M14 10h2" /><path d="M8 14h2" /><path d="M14 14h2" /></svg>
const IconTag = () => <svg width={ICON_S} height={ICON_S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
const IconMapPin = () => <svg width={ICON_S} height={ICON_S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
const IconStar = () => <svg width={ICON_S} height={ICON_S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
const IconUser = () => <svg width={ICON_S} height={ICON_S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
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

function formatEventDateTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const date = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const dateCap = date.charAt(0).toUpperCase() + date.slice(1)
  return time ? `${dateCap} à ${time.replace(':', 'h')}` : dateCap
}

function capFirst(str) {
  if (!str || typeof str !== 'string') return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function initials(fn, ln) {
  return ((fn?.[0] || '') + (ln?.[0] || '')).toUpperCase() || '?'
}

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']
function formatExperiencePeriod(exp) {
  const sy = exp.startYear
  const sm = exp.startMonth
  const ey = exp.endYear
  const em = exp.endMonth
  const startStr = sm ? `${MOIS[Math.min(sm - 1, 11)]} ${sy}` : String(sy || '')
  if (exp.isCurrent || !ey) {
    const years = sy ? new Date().getFullYear() - sy : 0
    return `Depuis ${startStr} (${years} an${years > 1 ? 's' : ''})`
  }
  const endStr = em ? `${MOIS[Math.min(em - 1, 11)]} ${ey}` : String(ey || '')
  const years = sy && ey ? ey - sy : 0
  return `${startStr} - ${endStr} (${years} an${years > 1 ? 's' : ''})`
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
    changeSource,
    changeRegion,
    saveNote,
    updateNote,
    deleteNote,
    deleteProfile,
    addEvent,
    fetchNotes,
    fetchProfiles,
    loadProfileDetail,
    profileActivities,
    deleteActivity,
    deleteEvent,
    today,
    useSupabase,
    showNotif,
  } = useCRM()

  const { user, userProfile } = useAuth()

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
  const [evType, setEvType] = useState('R1')
  const [evDate, setEvDate] = useState('')
  const [evNotes, setEvNotes] = useState('')
  const [showEventForm, setShowEventForm] = useState(false)
  const [sessionsCibles, setSessionsCibles] = useState([])
  const [activeTab, setActiveTab] = useState('notes')
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [localActivities, setLocalActivities] = useState([])
  const [localEvents, setLocalEvents] = useState([])
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingNoteContent, setEditingNoteContent] = useState('')
  const [editingEventId, setEditingEventId] = useState(null)
  const [editingEventType, setEditingEventType] = useState('R1')
  const [editingEventDate, setEditingEventDate] = useState('')
  const [editingEventDetail, setEditingEventDetail] = useState('')
  const [confirmDeleteNote, setConfirmDeleteNote] = useState(null)
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(null)
  const [expandedNoteId, setExpandedNoteId] = useState(null)
  const [expandedEventId, setExpandedEventId] = useState(null)
  const [scoreCorrectionOpen, setScoreCorrectionOpen] = useState(false)
  const [chuteModalProfile, setChuteModalProfile] = useState(null)
  const [showAIModal, setShowAIModal] = useState(false)

  const mapActivityRow = (a) => {
    const tsSource = a.created_at || a.date
    const ts = tsSource ? new Date(tsSource).getTime() : undefined
    const formatted = ts ? formatActivityDateTime(ts) : ''
    let mainText = a.note || ''
    let ico = a.icon || 'dot'
    if (a.activity_type === 'score_corrected' && a.new_value) {
      mainText = a.new_value
      ico = 'score_warning'
    } else if (a.activity_type && !a.note) {
      mainText = a.new_value || a.activity_type
    }
    return {
      id: a.id,
      _source: 'activity',
      d: formatted,
      t: mainText,
      n: undefined,
      ico,
      type: a.activity_type === 'score_corrected' ? 'score_warning' : (a.type || 'std'),
      ts,
      author: a.author,
    }
  }

  const mapEventRow = (e) => {
    const eventDate = e.event_date || e.date || e.created_at
    const ts = eventDate ? new Date(eventDate).getTime() : undefined
    const eventType = e.event_type || (e.content || '').split(' — ')[0] || 'Événement'
    const description = e.description || (e.content || '').split(' — ').slice(1).join(' — ').trim() || ''
    const formatted = eventDate ? formatEventDateTime(eventDate) : ''
    return {
      id: e.id,
      _source: 'event',
      d: formatted,
      t: eventType,
      n: description,
      ico: 'pin',
      type: 'event',
      ts,
      eventType,
      eventDate: e.event_date || e.date,
      description,
      author: e.author,
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

  const showSessionCible = profile && SESSION_CIBLE_STAGES.includes(profile.stg)
  useEffect(() => {
    if (!showSessionCible || !useSupabase) return
    supabase.from('sessions_formation').select('id, periode, annee, date_session, statut').order('date_session', { ascending: true }).then(({ data }) => setSessionsCibles(data || []))
  }, [showSessionCible, useSupabase])

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

  const matColor = (m) => MATURITY_COLORS[m] || { bg: '#F3F4F6', text: '#6B7280' }
  const stageColor = (s) => STAGE_COLORS[s] || { bg: '#F3F4F6', text: '#6B7280' }
  const stag = (s) => ({ background: stageColor(s).bg, color: stageColor(s).text })
  const matStyle = (m) => ({ background: matColor(m).bg, color: matColor(m).text })

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
      icon: 'pencil',
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
      icon: 'document',
      source: 'manual',
    })
    await loadActivitiesAndEvents()
  }

  const startEditEvent = (evt) => {
    const type = evt.event_type || (evt.content || '').split(' — ')[0] || 'R1'
    setEditingEventId(evt.id)
    setEditingEventType(EVENT_FORM_TYPES.includes(type) ? type : 'Autre')
    const dateVal = evt.event_date || evt.date || today()
    setEditingEventDate(typeof dateVal === 'string' && dateVal.includes('T') ? dateVal.slice(0, 16) : dateVal ? new Date(dateVal).toISOString().slice(0, 16) : '')
    setEditingEventDetail(evt.description || (evt.content || '').split(' — ').slice(1).join(' — ').trim() || '')
  }

  const handleSaveEventEdit = async () => {
    if (!editingEventId || !profile?.id) return
    const eventDateVal = editingEventDate ? (editingEventDate.includes('T') ? editingEventDate : editingEventDate + 'T12:00:00') : null
    await supabase.from('events').update({
      event_type: editingEventType,
      event_date: eventDateVal,
      description: editingEventDetail || null,
    }).eq('id', editingEventId)
    setEditingEventId(null)
    setEditingEventType('R1')
    setEditingEventDate('')
    setEditingEventDetail('')
    await loadActivitiesAndEvents()
  }

  const handleAddEvent = async () => {
    const profileId = profile?.id || id
    const eventDateVal = evDate ? (evDate.includes('T') ? evDate : evDate + 'T12:00:00') : new Date().toISOString().slice(0, 16)
    if (!useSupabase || !profileId) {
      await addEvent(profileId, { type: evType, date: eventDateVal, note: evNotes })
      setEvDate('')
      setEvNotes('')
      setShowEventForm(false)
      await loadActivitiesAndEvents()
      return
    }
    await supabase.from('events').insert({
      profile_id: profileId,
      event_type: evType,
      event_date: eventDateVal,
      description: evNotes || null,
    })
    await supabase.from('activities').insert({
      profile_id: profileId,
      type: 'event_added',
      note: evType + (evNotes ? ` — ${evNotes}` : ''),
      date: new Date().toISOString().split('T')[0],
      icon: 'pin',
      source: 'manual',
    })
    setEvDate('')
    setEvNotes('')
    setShowEventForm(false)
    await loadActivitiesAndEvents()
  }

  const handleDeleteProfile = async () => {
    if (!window.confirm('Supprimer ce profil ?')) return
    await deleteProfile(profile.id)
    navigate('/profiles')
  }

  const openCV = async () => {
    const path = profile.cv_url_path || profile.cv_url
    const { data, error } = await supabase.storage
      .from('cvs')
      .createSignedUrl(path, 3600)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
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
    push(`Session cible : ${profile.integration_periode && profile.integration_annee ? `${profile.integration_periode} ${profile.integration_annee}` : '—'}`)
    push(`Email : ${profile.mail}`)
    push(`Téléphone : ${profile.phone || '—'}`)
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
  const activityTypeLabel = (a) => {
    if (a._source === 'event') return 'Événement'
    const m = { stage_change: 'Stade', note_added: 'Note', maturity_change: 'Maturité', source_change: 'Source', region_change: 'Région', field_edit: 'Modification', score_corrected: 'Score' }
    return m[a.type] || 'Activité'
  }
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
      icon: 'refresh',
      source: 'manual',
    })
    console.log('Insert activité result:', actError)
    await loadActivitiesAndEvents()
  }

  const handleChangeMaturity = async (newMat) => {
    if (newMat === 'Chute') {
      setChuteModalProfile(profile)
      return
    }
    if (newMat === 'Pas intéressé') {
      const oldMatPI = profile?.mat ?? '—'
      const profileId = profile?.id || id
      await supabase.from('profiles').update({
        maturity: 'Pas intéressé',
        chute_stade: profile?.stg || 'Avant pipeline',
        chute_date: new Date().toISOString(),
      }).eq('id', profileId)
      changeMaturity(profileId, 'Pas intéressé')
      await supabase.from('activities').insert({
        profile_id: profileId,
        type: 'maturity_change',
        note: `${oldMatPI} → Pas intéressé`,
        date: new Date().toISOString().split('T')[0],
        icon: 'refresh',
        source: 'manual',
      })
      fetchProfiles?.()
      await loadActivitiesAndEvents()
      return
    }
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
      icon: 'thermometer',
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
      icon: 'document',
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
      icon: 'mappin',
      source: 'manual',
    })
    await loadActivitiesAndEvents()
  }

  const linkUrl = (v) => (v && (v.startsWith('http') ? v : `https://${v}`))
  const iconStyle = { color: '#6B6B6B', width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
  const FieldRow = ({ field, value, label, icon, placeholder, isLink }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${PAGE_STYLE.border}` }}>
      <span style={iconStyle}>{icon}</span>
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
          <button type="button" onClick={() => startEdit(field, value)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: PAGE_STYLE.textSecondary, fontSize: 12, display: 'inline-flex' }} title="Modifier"><IconPencil /></button>
        </>
      )}
    </div>
  )

  const tabStyle = (active) => ({
    padding: '12px 0',
    marginRight: 24,
    fontSize: 14,
    fontWeight: 500,
    color: active ? '#173731' : PAGE_STYLE.textSecondary,
    borderBottom: active ? '2px solid #173731' : '2px solid transparent',
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
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#173731', color: '#E7E0D0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, flexShrink: 0 }}>
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
          <span style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, ...matStyle(profile.mat) }}>{profile.mat}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={goPrev} disabled={currentNum <= 1} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${PAGE_STYLE.border}`, background: PAGE_STYLE.cardBg, cursor: currentNum <= 1 ? 'not-allowed' : 'pointer', opacity: currentNum <= 1 ? 0.5 : 1 }}>←</button>
          <span style={{ fontSize: 13, color: PAGE_STYLE.textSecondary }}>{currentNum} / {totalProfiles}</span>
          <button type="button" onClick={goNext} disabled={currentNum >= totalProfiles} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${PAGE_STYLE.border}`, background: PAGE_STYLE.cardBg, cursor: currentNum >= totalProfiles ? 'not-allowed' : 'pointer', opacity: currentNum >= totalProfiles ? 0.5 : 1 }}>→</button>
        </div>
      </header>
      </div>

      <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* ── COLONNE GAUCHE REDESIGNÉE ── */}
        <div style={{ overflowY: 'auto', minHeight: 0, background: '#F5F0E8', borderRight: '0.5px solid rgba(180,150,100,0.2)', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Avatar + nom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#173731', color: '#E7E0D0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, flexShrink: 0, boxShadow: '0 2px 8px rgba(23,55,49,0.18)' }}>
              {initials(profile.fn, profile.ln)}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#173731', lineHeight: 1.3 }}>{capFirst(profile.fn)} {capFirst(profile.ln)}</div>
              <div style={{ fontSize: 11, color: '#8B7355', marginTop: 2 }}>{profile.co || '—'}</div>
              <div style={{ fontSize: 11, color: '#A0866A' }}>{profile.ti || '—'} · {profile.city || '—'}</div>
            </div>
          </div>

          {/* Score ring */}
          {(() => {
            const sc = profile.sc ?? 0
            const r = 26
            const circ = 2 * Math.PI * r
            const dash = (sc / 100) * circ
            const scoreColor = sc >= 70 ? '#15803d' : sc >= 50 ? '#d97706' : '#94a3b8'
            const priorityLabel = sc >= 70 ? 'Prioritaire' : sc >= 50 ? 'À travailler' : 'À écarter'
            return (
              <div style={{ background: 'rgba(255,255,255,0.65)', borderRadius: 11, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 14, border: '0.5px solid rgba(180,150,100,0.2)' }}>
                <svg width="66" height="66" viewBox="0 0 66 66" style={{ flexShrink: 0 }}>
                  <circle cx={33} cy={33} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={5} />
                  <circle cx={33} cy={33} r={r} fill="none" stroke={scoreColor} strokeWidth={5}
                    strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 33 33)"
                    style={{ transition: 'stroke-dasharray 0.4s ease' }} />
                  <text x={33} y={37} textAnchor="middle" fontSize={14} fontWeight={700} fill="#173731" fontFamily="inherit">{sc}</text>
                </svg>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#A0866A', marginBottom: 3 }}>Score IA</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: scoreColor, marginBottom: 5 }}>{priorityLabel}</div>
                  <button type="button" onClick={() => setScoreCorrectionOpen(true)} style={{ fontSize: 10, color: '#ea580c', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                    Corriger
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Sélecteurs Pipeline */}
          <div style={{ background: 'rgba(255,255,255,0.65)', borderRadius: 11, padding: '11px 13px', border: '0.5px solid rgba(180,150,100,0.2)', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#A0866A', fontWeight: 600, marginBottom: 2 }}>Pipeline</div>
            {/* Maturité */}
            {(() => {
              const mat = profile.mat || ''
              const mc = MATURITY_COLORS[mat] || { bg: '#F3F4F6', text: '#6B7280' }
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 10, color: '#A0866A', width: 54, flexShrink: 0 }}>Maturité</div>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <select
                      value={mat}
                      onChange={(e) => handleChangeMaturity(e.target.value)}
                      style={{ appearance: 'none', WebkitAppearance: 'none', width: '100%', padding: '5px 22px 5px 9px', fontSize: 12, fontWeight: 600, borderRadius: 20, border: `1.5px solid ${mc.text}22`, background: mc.bg, color: mc.text, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {MATURITIES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <div style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 8, color: mc.text }}>▾</div>
                  </div>
                </div>
              )
            })()}
            {/* Stade */}
            {(() => {
              const stg = profile.stg || ''
              const sc2 = STAGE_COLORS[stg] || { bg: '#F8FAFC', text: '#475569' }
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 10, color: '#A0866A', width: 54, flexShrink: 0 }}>Stade</div>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <select
                      value={stg}
                      onChange={(e) => handleChangeStage(e.target.value)}
                      style={{ appearance: 'none', WebkitAppearance: 'none', width: '100%', padding: '5px 22px 5px 9px', fontSize: 12, fontWeight: 600, borderRadius: 20, border: `1.5px solid ${sc2.text}22`, background: sc2.bg, color: sc2.text, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 8, color: sc2.text }}>▾</div>
                  </div>
                </div>
              )
            })()}
            {/* Source */}
            {(() => {
              const src = profile.src || ''
              const SOURCE_PILL_COLORS = {
                'Chasse LinkedIn': { bg: '#eff6ff', text: '#1d4ed8' },
                'Recommandation': { bg: '#fefce8', text: '#a16207' },
                'Chasse Mail': { bg: '#f0fdf4', text: '#15803d' },
                'Chasse externe': { bg: '#fff7ed', text: '#c2410c' },
                'Inbound Marketing': { bg: '#faf5ff', text: '#7e22ce' },
                'Ads': { bg: '#fff1f2', text: '#e11d48' },
                'Autre': { bg: '#f8fafc', text: '#94a3b8' },
                'Inbound': { bg: '#faf5ff', text: '#7e22ce' },
              }
              const spc = SOURCE_PILL_COLORS[src] || { bg: '#f8fafc', text: '#94a3b8' }
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 10, color: '#A0866A', width: 54, flexShrink: 0 }}>Source</div>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <select
                      value={src}
                      onChange={(e) => handleChangeSource(e.target.value)}
                      style={{ appearance: 'none', WebkitAppearance: 'none', width: '100%', padding: '5px 22px 5px 9px', fontSize: 12, fontWeight: 600, borderRadius: 20, border: `1.5px solid ${spc.text}22`, background: spc.bg, color: spc.text, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 8, color: spc.text }}>▾</div>
                  </div>
                </div>
              )
            })()}
            {/* Session cible (conditionnelle) */}
            {showSessionCible && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 10, color: '#A0866A', width: 54, flexShrink: 0 }}>Session</div>
                <select
                  value={profile.session_formation_id || ''}
                  onChange={async (e) => {
                    const sessionId = e.target.value
                    if (!sessionId || !profile?.id || !useSupabase) return
                    const session = sessionsCibles.find((s) => s.id === sessionId)
                    await supabase.from('profiles').update({
                      session_formation_id: sessionId,
                      integration_periode: session?.periode ?? null,
                      integration_annee: session?.annee ?? null,
                      integration_confirmed: false,
                    }).eq('id', profile.id)
                    updateProfile(profile.id, { session_formation_id: sessionId, integration_periode: session?.periode, integration_annee: session?.annee, integration_confirmed: false })
                    fetchProfiles?.()
                  }}
                  style={{ flex: 1, padding: '5px 9px', fontSize: 12, borderRadius: 20, border: '1.5px solid rgba(23,55,49,0.15)', background: '#f0fdf4', color: '#065F46', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <option value="">—</option>
                  {sessionsCibles.map((s) => (
                    <option key={s.id} value={s.id}>{[s.periode, s.annee].filter(Boolean).join(' ') || s.date_session || '—'}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Informations */}
          <div style={{ background: 'rgba(255,255,255,0.65)', borderRadius: 11, padding: '11px 13px', border: '0.5px solid rgba(180,150,100,0.2)' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#A0866A', fontWeight: 600, marginBottom: 8 }}>Informations</div>
            {/* Employeur */}
            {(['co', 'ti', 'city'] ).map((field) => {
              const labels = { co: 'Employeur', ti: 'Intitulé', city: 'Ville' }
              const val = profile[field]
              return (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid rgba(180,150,100,0.15)' }}>
                  <div style={{ fontSize: 10, color: '#A0866A', width: 60, flexShrink: 0 }}>{labels[field]}</div>
                  {editingField === field ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(field)}
                        autoFocus
                        style={{ flex: 1, padding: '3px 8px', fontSize: 12, border: '1.5px solid #173731', borderRadius: 6, outline: 'none', fontFamily: 'inherit' }}
                      />
                      <button type="button" onClick={() => saveEdit(field)} style={{ padding: '3px 8px', background: '#173731', color: '#E7E0D0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>✓</button>
                      <button type="button" onClick={() => setEditingField(null)} style={{ padding: '3px 6px', background: 'none', border: '0.5px solid #C4A882', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#8B7355' }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 500, color: val ? '#1A1A1A' : '#A0866A', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{val || '—'}</div>
                      <button type="button" onClick={() => startEdit(field, val)} style={{ padding: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#C4A882', display: 'inline-flex', flexShrink: 0 }} title="Modifier">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    </>
                  )}
                </div>
              )
            })}
            {/* Région */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid rgba(180,150,100,0.15)' }}>
              <div style={{ fontSize: 10, color: '#A0866A', width: 60, flexShrink: 0 }}>Région</div>
              <select
                value={profile.region || ''}
                onChange={(e) => handleChangeRegion(e.target.value)}
                style={{ flex: 1, padding: '4px 8px', fontSize: 12, border: '0.5px solid rgba(180,150,100,0.3)', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: '#1A1A1A' }}
              >
                <option value="">—</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {/* Paternité */}
            {(() => {
              const knownUsers = [...new Map(
                profiles
                  .filter(p => p.owner_id)
                  .map(p => [p.owner_id, { id: p.owner_id, email: p.owner_email || '', name: p.owner_full_name?.trim() || (p.owner_email || '').split('@')[0] || 'Inconnu' }])
              ).values()]
              if (user?.id && !knownUsers.find(u => u.id === user.id)) {
                knownUsers.push({ id: user.id, email: user.email || '', name: userProfile?.full_name?.trim() || (user.email || '').split('@')[0] || 'Moi' })
              }
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                  <div style={{ fontSize: 10, color: '#A0866A', width: 60, flexShrink: 0 }}>Paternité</div>
                  <select
                    value={profile.owner_id || ''}
                    onChange={async (e) => {
                      const selectedId = e.target.value
                      const selectedUser = knownUsers.find(u => u.id === selectedId)
                      if (!selectedUser) return
                      await supabase.from('profiles').update({
                        owner_id: selectedUser.id,
                        owner_email: selectedUser.email,
                        owner_full_name: selectedUser.name,
                      }).eq('id', profile.id)
                      updateProfile(profile.id, { owner_id: selectedUser.id, owner_email: selectedUser.email, owner_full_name: selectedUser.name })
                      await fetchProfiles()
                      showNotif(`Paternité → ${selectedUser.name}`)
                    }}
                    style={{ flex: 1, padding: '4px 8px', fontSize: 12, border: '0.5px solid rgba(180,150,100,0.3)', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: '#1A1A1A' }}
                  >
                    {!profile.owner_id && <option value="">— Non assigné —</option>}
                    {knownUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.id === user?.id ? `${u.name} (vous)` : u.name}</option>
                    ))}
                  </select>
                </div>
              )
            })()}
          </div>

          {/* Contact */}
          <div style={{ background: 'rgba(255,255,255,0.65)', borderRadius: 11, padding: '11px 13px', border: '0.5px solid rgba(180,150,100,0.2)' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#A0866A', fontWeight: 600, marginBottom: 8 }}>Contact</div>
            {[
              { field: 'mail', label: 'Email', placeholder: 'email@…', isLink: false },
              { field: 'phone', label: 'Tél.', placeholder: '+33 6 …', isLink: false },
              { field: 'li', label: 'LinkedIn', placeholder: 'linkedin.com/in/…', isLink: true },
            ].map(({ field, label, placeholder, isLink }) => {
              const val = profile[field]
              const linkUrl = val && (val.startsWith('http') ? val : `https://${val}`)
              return (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid rgba(180,150,100,0.15)' }}>
                  <div style={{ fontSize: 10, color: '#A0866A', width: 42, flexShrink: 0 }}>{label}</div>
                  {editingField === field ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(field)}
                        autoFocus
                        style={{ flex: 1, padding: '3px 8px', fontSize: 12, border: '1.5px solid #173731', borderRadius: 6, outline: 'none', fontFamily: 'inherit' }}
                      />
                      <button type="button" onClick={() => saveEdit(field)} style={{ padding: '3px 8px', background: '#173731', color: '#E7E0D0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>✓</button>
                      <button type="button" onClick={() => setEditingField(null)} style={{ padding: '3px 6px', background: 'none', border: '0.5px solid #C4A882', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#8B7355' }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: val ? (isLink ? '#0a66c2' : '#1A1A1A') : '#A0866A', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: val ? 500 : 400 }}>
                        {isLink && val ? <a href={linkUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0a66c2', textDecoration: 'none' }}>{val}</a> : (val || placeholder)}
                      </div>
                      <button type="button" onClick={() => startEdit(field, val)} style={{ padding: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#C4A882', display: 'inline-flex', flexShrink: 0 }} title="Modifier">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    </>
                  )}
                </div>
              )
            })}
            {/* Prochain RDV */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid rgba(180,150,100,0.15)' }}>
              <div style={{ fontSize: 10, color: '#A0866A', width: 42, flexShrink: 0 }}>RDV</div>
              <input
                type="date"
                value={profile.next_event_date ? profile.next_event_date.split('T')[0] : ''}
                onChange={(e) => updateProfileField(profile.id, 'next_event_date', e.target.value || null)}
                style={{ flex: 1, padding: '3px 8px', fontSize: 12, border: '0.5px solid rgba(180,150,100,0.3)', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: '#1A1A1A' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
              <div style={{ fontSize: 10, color: '#A0866A', width: 42, flexShrink: 0 }}>Type</div>
              <select
                value={profile.next_event_label || ''}
                onChange={(e) => updateProfileField(profile.id, 'next_event_label', e.target.value || null)}
                style={{ flex: 1, padding: '4px 8px', fontSize: 12, border: '0.5px solid rgba(180,150,100,0.3)', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: '#1A1A1A' }}
              >
                <option value="">—</option>
                {['Téléphone', 'Google Meet', 'Présentiel', 'Visioconférence', 'Autre'].map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lemlist badge si applicable */}
          {profile.sequence_lemlist && (
            <div style={{ background: '#FFF7ED', border: '0.5px solid #FED7AA', borderRadius: 8, padding: '7px 12px', fontSize: 11, color: '#c2410c', fontWeight: 500 }}>
              Séquence Lemlist : {profile.sequence_lemlist}
            </div>
          )}

          {/* Prénom / Nom (rarement modifiés — en bas) */}
          <div style={{ background: 'rgba(255,255,255,0.65)', borderRadius: 11, padding: '11px 13px', border: '0.5px solid rgba(180,150,100,0.2)' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#A0866A', fontWeight: 600, marginBottom: 8 }}>Identité</div>
            {[{ field: 'fn', label: 'Prénom' }, { field: 'ln', label: 'Nom' }].map(({ field, label }) => {
              const val = profile[field]
              return (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: field === 'fn' ? '0.5px solid rgba(180,150,100,0.15)' : 'none' }}>
                  <div style={{ fontSize: 10, color: '#A0866A', width: 42, flexShrink: 0 }}>{label}</div>
                  {editingField === field ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                      <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEdit(field)} autoFocus
                        style={{ flex: 1, padding: '3px 8px', fontSize: 12, border: '1.5px solid #173731', borderRadius: 6, outline: 'none', fontFamily: 'inherit' }} />
                      <button type="button" onClick={() => saveEdit(field)} style={{ padding: '3px 8px', background: '#173731', color: '#E7E0D0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>✓</button>
                      <button type="button" onClick={() => setEditingField(null)} style={{ padding: '3px 6px', background: 'none', border: '0.5px solid #C4A882', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#8B7355' }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', flex: 1 }}>{val || '—'}</div>
                      <button type="button" onClick={() => startEdit(field, val)} style={{ padding: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#C4A882', display: 'inline-flex', flexShrink: 0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Actions rapides */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {(profile.cv_url_path || profile.cv_url) && (
              <button type="button" onClick={openCV} style={{ padding: '8px 12px', textAlign: 'left', borderRadius: 8, border: '0.5px solid rgba(180,150,100,0.3)', background: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12, color: '#173731', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}><IconDocument /> Voir le CV</button>
            )}
            <button type="button" onClick={handleExportPDF} style={{ padding: '8px 12px', textAlign: 'left', borderRadius: 8, border: '0.5px solid rgba(180,150,100,0.3)', background: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12, color: '#173731', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}><IconUpload /> Exporter la fiche</button>
            <button type="button" onClick={handleDeleteProfile} style={{ padding: '8px 12px', textAlign: 'left', borderRadius: 8, border: '0.5px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}><IconTrash /> Supprimer le profil</button>
          </div>

          {Array.isArray(profile.experiences) && profile.experiences.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.65)', borderRadius: 11, padding: '11px 13px', border: '0.5px solid rgba(180,150,100,0.2)' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#A0866A', fontWeight: 600, marginBottom: 10 }}>Parcours professionnel</div>
              <div style={{ position: 'relative', paddingLeft: 16 }}>
                <div style={{ position: 'absolute', left: 3, top: 0, bottom: 0, width: 1.5, background: 'rgba(23,55,49,0.2)', borderRadius: 1 }} />
                {profile.experiences.map((exp, i) => {
                  const badge = getExperienceBadge(exp)
                  const isCurrent = exp.isCurrent
                  return (
                    <div key={i} style={{ position: 'relative', paddingBottom: 14 }}>
                      <div style={{ position: 'absolute', left: -17, top: 4, width: 8, height: 8, borderRadius: '50%', background: isCurrent ? '#173731' : 'rgba(255,255,255,0.8)', border: `1.5px solid ${isCurrent ? '#173731' : 'rgba(23,55,49,0.3)'}` }} />
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{exp.company || '—'}</div>
                      <div style={{ fontSize: 11, color: '#8B7355', marginTop: 1 }}>{exp.title || '—'}</div>
                      <div style={{ fontSize: 10, color: '#A0866A', marginTop: 2 }}>{formatExperiencePeriod(exp)}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        {badge === 'cabinet' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#D4EDE1', color: '#1A7A4A', fontWeight: 500 }}>Cabinet CGP</span>}
                        {badge === 'banque' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#EFF6FF', color: '#1D4ED8', fontWeight: 500 }}>Banque</span>}
                        {badge === 'assurance' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#ECFDF5', color: '#065F46', fontWeight: 500 }}>Assurance</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ background: PAGE_STYLE.cardBg, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: PAGE_STYLE.radius, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflowY: 'auto', minHeight: 0 }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${PAGE_STYLE.border}`, marginBottom: 20 }}>
            <button type="button" style={tabStyle(activeTab === 'notes')} onClick={() => setActiveTab('notes')}>Notes</button>
            <button type="button" style={tabStyle(activeTab === 'events')} onClick={() => setActiveTab('events')}>Événements</button>
            <button type="button" style={tabStyle(activeTab === 'activity')} onClick={() => setActiveTab('activity')}>Activité</button>
            <button type="button" style={tabStyle(activeTab === 'grille')} onClick={() => setActiveTab('grille')}>Grille de notation</button>
          </div>

          {activeTab === 'activity' && (
            <div style={{ position: 'relative', paddingLeft: 28 }}>
              <div style={{ position: 'absolute', left: 6, top: 0, bottom: 0, width: 1, background: '#E5E0D8' }} />
              {loadingDetail && mergedActs.length === 0 && localActivities.length === 0 && localEvents.length === 0 ? (
                <div style={{ color: PAGE_STYLE.textSecondary, fontSize: 13 }}>Chargement…</div>
              ) : mergedActs.length === 0 ? (
                <div style={{ color: PAGE_STYLE.textSecondary, fontSize: 13 }}>Aucune activité</div>
              ) : (
                <>
                  {mergedActs.map((item, i) => (
                    <div key={item.id ? `${item._source}-${item.id}` : `act-${i}`} style={{ position: 'relative', marginBottom: 16 }} className="activity-row">
                      <div style={{ position: 'absolute', left: -22, top: 4, width: 10, height: 10, borderRadius: '50%', background: '#173731', border: '2px solid #fff' }} />
                      <div style={{ background: '#F9F7F4', borderRadius: 8, border: '0.5px solid #E5E0D8', padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#EEF4FB', color: '#185FA5', border: '0.5px solid #B5D4F4', fontWeight: 500 }}>
                              {activityTypeLabel(item)}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#0D1117' }}>{item.t}{item.n ? ` — ${item.n}` : ''}</span>
                          </div>
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>{item.d}</span>
                        </div>
                        <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                          Modifié par <span style={{ fontWeight: 500, color: '#0D1117' }}>{item.author || 'Baptiste PATERAC'}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 8 }}>Début de l'historique</p>
                </>
              )}
            </div>
          )}

          {activeTab === 'grille' && (
            <GrilleNotationTab profile={profile} updateProfile={updateProfile} useSupabase={useSupabase} />
          )}

          {activeTab === 'notes' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
                <button type="button" onClick={() => setShowAIModal(true)} style={{ padding: '8px 16px', background: 'white', color: '#173731', border: '1px solid #D2AB76', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>✨ Récap IA</button>
                <button type="button" onClick={() => setShowNoteForm(!showNoteForm)} style={{ padding: '8px 16px', background: '#173731', color: '#E7E0D0', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Nouvelle note</button>
              </div>
              {showNoteForm && (
                <div style={{ marginBottom: 24, padding: 20, background: '#F9F8F6', borderRadius: PAGE_STYLE.radius, border: `1px solid ${PAGE_STYLE.border}` }}>
                  <select value={noteTemplate} onChange={(e) => setNoteTemplate(e.target.value)} style={{ marginBottom: 12, padding: '8px 12px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6 }}>
                    {Object.keys(NOTE_TEMPLATES).map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Saisir une note…" style={{ width: '100%', minHeight: 400, padding: 12, fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, resize: 'vertical', marginBottom: 12 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={handleSaveNote} style={{ padding: '8px 16px', background: PAGE_STYLE.green, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Enregistrer</button>
                    <button type="button" onClick={() => { setShowNoteForm(false); setNoteContent(NOTE_TEMPLATES[noteTemplate] ?? ''); }} style={{ padding: '8px 16px', background: 'none', border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                  </div>
                </div>
              )}
              {notesList.map((n) => (
                <div key={n.id} style={{ position: 'relative', marginBottom: 16, padding: 16, background: PAGE_STYLE.cardBg, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: PAGE_STYLE.radius, transition: PAGE_STYLE.transition, cursor: 'pointer' }} className="note-card">
                  {editingNoteId === n.id ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <textarea value={editingNoteContent} onChange={(e) => setEditingNoteContent(e.target.value)} style={{ width: '100%', minHeight: 400, padding: 12, fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, resize: 'vertical', marginBottom: 10 }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={handleSaveNoteEdit} style={{ padding: '8px 16px', background: PAGE_STYLE.green, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Enregistrer les modifications</button>
                        <button type="button" onClick={() => { setEditingNoteId(null); setEditingNoteContent(''); setExpandedNoteId(null); }} style={{ padding: '8px 16px', background: 'none', border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }} onClick={() => setExpandedNoteId((prev) => (prev === n.id ? null : n.id))}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: PAGE_STYLE.text }}>{n.template || 'Note libre'}</div>
                          <div style={{ color: '#6B6B6B', fontSize: 12, marginTop: 4 }}>{formatNoteDate(n.created_at)}</div>
                          {expandedNoteId === n.id && (
                            <div style={{ marginTop: 12, padding: 12, background: '#F8F5F1', borderRadius: 8, fontSize: 13, color: PAGE_STYLE.text, whiteSpace: 'pre-wrap' }} onClick={(e) => e.stopPropagation()}>
                              {n.content || '—'}
                            </div>
                          )}
                        </div>
                        <span style={{ flexShrink: 0, fontSize: 12, color: '#6B6B6B', transition: 'transform 0.2s', transform: expandedNoteId === n.id ? 'rotate(180deg)' : 'none' }}>▾</span>
                      </div>
                      {expandedNoteId === n.id && (
                        <div className="note-actions" style={{ display: 'flex', gap: 6, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => { setEditingNoteId(n.id); setEditingNoteContent(n.content || ''); }} style={{ padding: '3px 10px', fontSize: 12, color: '#173731', background: 'transparent', border: '1px solid #E5E0D8', borderRadius: 6, cursor: 'pointer' }} title="Éditer">Éditer</button>
                          <button type="button" onClick={() => setConfirmDeleteNote({ id: n.id, content: n.content })} style={{ padding: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', display: 'inline-flex' }} title="Supprimer"><IconTrash /></button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              {notesList.length === 0 && !showNoteForm && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 }}>
                  <span style={{ width: 48, height: 48, display: 'flex', color: '#bbb' }}><IconDocument /></span>
                  <div style={{ fontSize: 12, color: '#bbb' }}>Cliquez sur + Nouvelle note pour commencer</div>
                </div>
              )}
            </>
          )}

          {activeTab === 'events' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button type="button" onClick={() => setShowEventForm(!showEventForm)} style={{ padding: '8px 16px', background: '#173731', color: '#E7E0D0', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Nouvel événement</button>
              </div>
              {showEventForm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24, padding: 20, background: '#F9F8F6', borderRadius: PAGE_STYLE.radius, border: `1px solid ${PAGE_STYLE.border}` }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: PAGE_STYLE.textSecondary }}>Date de l'événement</label>
                    <input type="datetime-local" value={evDate} onChange={(e) => setEvDate(e.target.value)} style={{ padding: '8px 12px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6 }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: PAGE_STYLE.textSecondary }}>Type</label>
                    <select value={evType} onChange={(e) => setEvType(e.target.value)} style={{ padding: '8px 12px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6 }}>
                      {EVENT_FORM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: PAGE_STYLE.textSecondary }}>Notes</label>
                    <textarea
                      value={evNotes}
                      onChange={(e) => setEvNotes(e.target.value)}
                      placeholder="Description, points clés…"
                      rows={3}
                      style={{ width: '100%', padding: 10, fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={handleAddEvent} style={{ padding: '8px 16px', background: PAGE_STYLE.green, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Ajouter</button>
                  </div>
                </div>
              )}
              {eventsMapped.map((a, i) => {
                const raw = localEvents.find((ev) => ev.id === a.id)
                return (
                  <div
                    key={a.id || i}
                    className="event-card"
                    style={{ display: 'flex', flexDirection: 'column', marginBottom: 12, padding: 14, background: PAGE_STYLE.cardBg, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: PAGE_STYLE.radius, cursor: 'pointer', position: 'relative' }}
                  >
                    {editingEventId === a.id && raw ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: PAGE_STYLE.textSecondary, display: 'block', marginBottom: 4 }}>Type</label>
                        <select value={editingEventType} onChange={(e) => setEditingEventType(e.target.value)} style={{ padding: '8px 12px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, minWidth: 160, marginBottom: 10, display: 'block', width: '100%' }}>
                          {EVENT_FORM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <label style={{ fontSize: 12, fontWeight: 500, color: PAGE_STYLE.textSecondary, display: 'block', marginBottom: 4 }}>Date de l'événement</label>
                        <input type="datetime-local" value={editingEventDate} onChange={(e) => setEditingEventDate(e.target.value)} style={{ padding: '8px 12px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, marginBottom: 10, display: 'block', width: '100%' }} />
                        <label style={{ fontSize: 12, fontWeight: 500, color: PAGE_STYLE.textSecondary, display: 'block', marginBottom: 4 }}>Notes</label>
                        <textarea value={editingEventDetail} onChange={(e) => setEditingEventDetail(e.target.value)} placeholder="Description, points clés…" rows={4} style={{ width: '100%', padding: 10, fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, resize: 'vertical', marginBottom: 10 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" onClick={handleSaveEventEdit} style={{ padding: '8px 16px', background: PAGE_STYLE.green, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Enregistrer</button>
                          <button type="button" onClick={() => { setEditingEventId(null); setEditingEventType('R1'); setEditingEventDate(''); setEditingEventDetail(''); setExpandedEventId(null); }} style={{ padding: '8px 16px', background: 'none', border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }} onClick={() => setExpandedEventId((prev) => (prev === a.id ? null : a.id))}>
                          <span style={{ fontSize: 18, display: 'inline-flex', flexShrink: 0 }}><ActivityIcon ico={a.ico || 'pin'} size={18} /></span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: PAGE_STYLE.text }}>{a.t || a.eventType || 'Événement'}</div>
                            <div style={{ fontSize: 12, color: PAGE_STYLE.textSecondary, marginTop: 4 }}>{a.d}</div>
                            {a.n && <div style={{ fontSize: 12, color: PAGE_STYLE.textSecondary, marginTop: 6 }}>{a.n}</div>}
                            {expandedEventId === a.id && raw && (raw.description || raw.notes || raw.next_step) && (
                              <div style={{ marginTop: 12, padding: 12, background: '#F8F5F1', borderRadius: 8, fontSize: 13, color: PAGE_STYLE.text, whiteSpace: 'pre-wrap' }} onClick={(e) => e.stopPropagation()}>
                                {[raw.description, raw.notes && `\n\nNotes : ${raw.notes}`, raw.next_step && `\n\nProchaine étape : ${raw.next_step}${raw.next_step_date ? ` (${raw.next_step_date})` : ''}`].filter(Boolean).join('') || '—'}
                              </div>
                            )}
                          </div>
                          <span style={{ flexShrink: 0, fontSize: 12, color: '#6B6B6B', transition: 'transform 0.2s', transform: expandedEventId === a.id ? 'rotate(180deg)' : 'none' }}>▾</span>
                        </div>
                        {expandedEventId === a.id && raw && (
                          <div className="event-actions" style={{ display: 'flex', gap: 6, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => startEditEvent(raw)} style={{ padding: '3px 10px', fontSize: 12, color: '#173731', background: 'transparent', border: '1px solid #E5E0D8', borderRadius: 6, cursor: 'pointer' }}>Éditer</button>
                            <button type="button" onClick={() => setConfirmDeleteEvent({ id: raw.id, content: raw.event_type || raw.content })} style={{ padding: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', display: 'inline-flex' }} title="Supprimer"><IconTrash /></button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
              {eventsMapped.length === 0 && !showEventForm && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 }}>
                  <span style={{ width: 48, height: 48, display: 'flex', color: '#bbb' }}><IconDocument /></span>
                  <div style={{ fontSize: 12, color: '#bbb' }}>Cliquez sur + Nouvel événement pour commencer</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modales de confirmation suppression */}
      {confirmDeleteNote && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setConfirmDeleteNote(null)}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: 320 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>Supprimer cette note ?</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConfirmDeleteNote(null)} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#6B6B6B' }}>Annuler</button>
              <button type="button" onClick={async () => { await deleteNote(profile.id, confirmDeleteNote.id, confirmDeleteNote.content); const list = await fetchNotes(profile.id); setNotesList(list || []); setConfirmDeleteNote(null); }} style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: '#DC2626', color: 'white', cursor: 'pointer' }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
      {scoreCorrectionOpen && (
        <ScoreCorrectionModal
          profile={profile}
          onClose={() => setScoreCorrectionOpen(false)}
          onSaved={async ({ correctedScore }) => {
            updateProfile(profile.id, { sc: correctedScore })
            showNotif('Score corrigé ✓')
            await loadActivitiesAndEvents()
          }}
          useSupabase={useSupabase}
        />
      )}

      {confirmDeleteEvent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setConfirmDeleteEvent(null)}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: 320 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>Supprimer cet événement ?</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConfirmDeleteEvent(null)} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#6B6B6B' }}>Annuler</button>
              <button type="button" onClick={async () => { await deleteEvent(profile.id, confirmDeleteEvent.id, confirmDeleteEvent.content); await loadActivitiesAndEvents(); setConfirmDeleteEvent(null); }} style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: '#DC2626', color: 'white', cursor: 'pointer' }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {chuteModalProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setChuteModalProfile(null)}>
          <ChuteModal
            profile={chuteModalProfile}
            onClose={() => setChuteModalProfile(null)}
            onSaved={async (chuteType, chuteDetail) => {
              const oldMat = chuteModalProfile.mat ?? '—'
              await supabase.from('profiles').update({
                maturity: 'Chute',
                chute_stade: chuteModalProfile.stg ?? null,
                chute_type: chuteType,
                chute_detail: chuteDetail || null,
                chute_date: new Date().toISOString(),
              }).eq('id', chuteModalProfile.id)
              changeMaturity(chuteModalProfile.id, 'Chute')
              await supabase.from('activities').insert({
                profile_id: chuteModalProfile.id,
                type: 'maturity_change',
                note: `${oldMat} → Chute`,
                date: new Date().toISOString().split('T')[0],
                icon: 'refresh',
                source: 'manual',
              })
              setChuteModalProfile(null)
              fetchProfiles?.()
              await loadActivitiesAndEvents()
            }}
          />
        </div>
      )}

      {showAIModal && (
        <AISummaryModal
          profile={profile}
          onClose={() => setShowAIModal(false)}
          onSave={async (noteContent) => {
            await saveNote(profile.id, noteContent)
            const list = await fetchNotes(profile.id)
            setNotesList(list || [])
            showNotif('✨ Récap IA sauvegardé')
          }}
        />
      )}

      <style>{`
        .activity-row:hover .activity-delete-btn { opacity: 1; }
        .score-inexact-btn { padding: 0 4px; }
        .score-row:hover .score-inexact-btn { opacity: 1 !important; }
        @media (max-width: 900px) {
          .profile-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
