import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { supabase } from '../lib/supabase'
import { useCRM } from '../context/CRMContext'
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
import PasInteresseModal from '../components/PasInteresseModal'
import GrilleNotationTab from '../components/GrilleNotationTab'
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
  const [pasInteresseModalProfile, setPasInteresseModalProfile] = useState(null)

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
      setPasInteresseModalProfile(profile)
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

      <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '40% 1fr', gap: 24, flex: 1, minHeight: 0, padding: '0 28px 22px', overflow: 'hidden' }}>
        <div style={{ overflowY: 'auto', minHeight: 0 }}>
          <div style={{ background: PAGE_STYLE.cardBg, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: PAGE_STYLE.radius, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: PAGE_STYLE.textSecondary, marginBottom: 16 }}>Informations</div>
            <FieldRow field="fn" value={profile.fn} label="Prénom" icon={<IconUser />} />
            <FieldRow field="ln" value={profile.ln} label="Nom" icon={<IconUser />} />
            <FieldRow field="mail" value={profile.mail} label="Email" icon={<IconEnvelope />} placeholder="email@…" />
            <FieldRow field="li" value={profile.li} label="LinkedIn" icon={<IconLink />} placeholder="linkedin.com/in/…" isLink />
            <FieldRow field="city" value={profile.city} label="Ville" icon={<IconMapPin />} />
            {(profile.owner_full_name?.trim() || profile.owner_email?.trim()) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${PAGE_STYLE.border}` }}>
                <span style={iconStyle}><IconUser /></span>
                <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 100, flexShrink: 0 }}>Ajouté par</span>
                <span style={{ flex: 1, fontSize: 12, color: PAGE_STYLE.textSecondary }}>
                  {(profile.owner_full_name?.trim() || profile.owner_email || '').trim()} · {profile.created_at ? `le ${new Date(profile.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}` : '—'}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${PAGE_STYLE.border}` }}>
              <span style={{ ...iconStyle, width: 24, display: 'flex', alignItems: 'center' }}><IconMap /></span>
              <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 100 }}>Région</span>
              <select value={profile.region || ''} onChange={(e) => handleChangeRegion(e.target.value)} style={{ flex: 1, padding: '6px 10px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6 }}>
                <option value="">—</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <FieldRow field="co" value={profile.co} label="Employeur" icon={<IconBuilding />} />
            <FieldRow field="ti" value={profile.ti} label="Intitulé" icon={<IconTag />} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${PAGE_STYLE.border}` }}>
              <span style={iconStyle}><IconTag /></span>
              <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 100 }}>Source</span>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <InlineDropdown options={SOURCES} value={profile.src} onChange={handleChangeSource} buttonStyle={() => ({ border: `1px solid ${PAGE_STYLE.border}`, background: PAGE_STYLE.cardBg, color: PAGE_STYLE.text })} />
                {profile.sequence_lemlist && (
                  <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: '#FFF7ED', color: '#F97316', fontWeight: 500 }}>Lemlist : {profile.sequence_lemlist}</span>
                )}
              </div>
            </div>
            <div style={{ padding: '10px 0', borderBottom: `1px solid ${PAGE_STYLE.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={iconStyle}><IconStar /></span>
                <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 100 }}>Score</span>
                <div className="score-row" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{profile.sc ?? '—'}</span>
                  <button
                    type="button"
                    onClick={() => setScoreCorrectionOpen(true)}
                    className="score-inexact-btn"
                    style={{ fontSize: 12, color: '#F97316', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s' }}
                    title="Signaler un score inexact"
                  >
                    ⚠ Score inexact
                  </button>
                </div>
              </div>
              <div style={{ height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#173731', width: `${Math.min(100, (profile.sc ?? 0))}%`, borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${PAGE_STYLE.border}` }}>
              <span style={iconStyle}><IconTag /></span>
              <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 100 }}>Maturité</span>
              <div style={{ flex: 1 }}>
                <InlineDropdown options={MATURITIES} value={profile.mat} onChange={handleChangeMaturity} buttonStyle={matStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${PAGE_STYLE.border}` }}>
              <span style={iconStyle}><IconStar /></span>
              <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 100 }}>Stade</span>
              <div style={{ flex: 1 }}>
                <InlineDropdown options={STAGES} value={profile.stg} onChange={handleChangeStage} buttonStyle={stag} placeholder="—" />
              </div>
            </div>
            {showSessionCible && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${PAGE_STYLE.border}` }}>
                <span style={iconStyle}><IconCalendar /></span>
                <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 100 }}>Session cible</span>
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
                  style={{ flex: 1, padding: '6px 10px', fontSize: 13, borderRadius: 6, border: `1px solid ${PAGE_STYLE.border}`, background: PAGE_STYLE.cardBg, cursor: 'pointer' }}
                >
                  <option value="">—</option>
                  {sessionsCibles.map((s) => (
                    <option key={s.id} value={s.id}>{[s.periode, s.annee].filter(Boolean).join(' ') || s.date_session || '—'}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${PAGE_STYLE.border}` }}>
              <span style={iconStyle}><IconCalendar /></span>
              <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 100 }}>Prochain événement</span>
              <input
                type="date"
                value={profile.next_event_date || ''}
                onChange={(e) => updateProfileField(profile.id, 'next_event_date', e.target.value || null)}
                style={{ flex: 1, padding: '6px 10px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${PAGE_STYLE.border}` }}>
              <span style={iconStyle}><IconTag /></span>
              <span style={{ color: PAGE_STYLE.textSecondary, fontSize: 13, width: 100 }}>Type d'événement</span>
              <select
                value={profile.next_event_label || ''}
                onChange={(e) => updateProfileField(profile.id, 'next_event_label', e.target.value || null)}
                style={{ flex: 1, padding: '6px 10px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 6 }}
              >
                <option value="">—</option>
                {['Téléphone', 'Google Meet', 'Présentiel', 'Visioconférence', 'Autre'].map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 24, background: PAGE_STYLE.cardBg, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: PAGE_STYLE.radius, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: PAGE_STYLE.textSecondary, marginBottom: 16 }}>Actions rapides</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(profile.cv_url_path || profile.cv_url) && (
                <button type="button" onClick={openCV} style={{ padding: '10px 14px', textAlign: 'left', borderRadius: 8, border: `1px solid ${PAGE_STYLE.border}`, background: 'none', cursor: 'pointer', fontSize: 13, transition: PAGE_STYLE.transition, display: 'flex', alignItems: 'center', gap: 8 }}><IconDocument /> Voir le CV</button>
              )}
              <button type="button" onClick={handleExportPDF} style={{ padding: '10px 14px', textAlign: 'left', borderRadius: 8, border: `1px solid ${PAGE_STYLE.border}`, background: 'none', cursor: 'pointer', fontSize: 13, transition: PAGE_STYLE.transition, display: 'flex', alignItems: 'center', gap: 8 }}><IconUpload /> Exporter la fiche</button>
              <button type="button" onClick={handleDeleteProfile} style={{ padding: '10px 14px', textAlign: 'left', borderRadius: 8, border: '1px solid #e5c0c0', background: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><IconTrash /> Supprimer le profil</button>
            </div>
          </div>

          {Array.isArray(profile.experiences) && profile.experiences.length > 0 && (
            <div style={{ marginTop: 24, background: PAGE_STYLE.cardBg, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: PAGE_STYLE.radius, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: PAGE_STYLE.textSecondary, marginBottom: 16 }}>Parcours professionnel</div>
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: PAGE_STYLE.accent, borderRadius: 1 }} />
                {profile.experiences.map((exp, i) => {
                  const badge = getExperienceBadge(exp)
                  return (
                    <div key={i} style={{ position: 'relative', paddingBottom: 20 }}>
                      <div style={{ position: 'absolute', left: -24, top: 4, width: 10, height: 10, borderRadius: '50%', background: PAGE_STYLE.cardBg, border: `2px solid ${PAGE_STYLE.accent}` }} />
                      <div style={{ fontWeight: 600, fontSize: 13, color: PAGE_STYLE.text }}>{exp.company || '—'}</div>
                      <div style={{ fontSize: 12, color: PAGE_STYLE.textSecondary, marginTop: 2 }}>{exp.title || '—'}</div>
                      <div style={{ fontSize: 12, color: PAGE_STYLE.textSecondary, marginTop: 4 }}>{formatExperiencePeriod(exp)}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        {badge === 'cabinet' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#D4EDE1', color: '#1A7A4A', fontWeight: 500 }}>Cabinet CGP</span>}
                        {badge === 'banque' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#EFF6FF', color: '#1D4ED8', fontWeight: 500 }}>Banque</span>}
                        {badge === 'assurance' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#ECFDF5', color: '#065F46', fontWeight: 500 }}>Assurance</span>}
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
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
      {pasInteresseModalProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPasInteresseModalProfile(null)}>
          <PasInteresseModal
            profile={pasInteresseModalProfile}
            onClose={() => setPasInteresseModalProfile(null)}
            onSaved={async (raison, detail) => {
              const oldMat = pasInteresseModalProfile.mat ?? '—'
              await supabase.from('profiles').update({
                maturity: 'Pas intéressé',
                chute_stade: pasInteresseModalProfile.stg || 'Avant pipeline',
                chute_type: raison,
                chute_detail: detail || null,
                chute_date: new Date().toISOString(),
              }).eq('id', pasInteresseModalProfile.id)
              changeMaturity(pasInteresseModalProfile.id, 'Pas intéressé')
              await supabase.from('activities').insert({
                profile_id: pasInteresseModalProfile.id,
                type: 'maturity_change',
                note: `${oldMat} → Pas intéressé`,
                date: new Date().toISOString().split('T')[0],
                icon: 'refresh',
                source: 'manual',
              })
              setPasInteresseModalProfile(null)
              fetchProfiles?.()
              await loadActivitiesAndEvents()
            }}
          />
        </div>
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
