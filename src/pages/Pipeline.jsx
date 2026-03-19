import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCRM } from '../context/CRMContext'
import { EVENTS_TABLE } from '../context/CRMContext'
import { useAuth } from '../context/AuthContext'
import { useViewMode } from '../context/ViewModeContext'
import { getExperienceBadge } from '../lib/scoring'
import {
  STAGES,
  STAGE_COLORS,
  MATURITIES,
  MATURITY_COLORS,
  NOTE_TEMPLATES,
  EVENT_TYPES,
  SOURCES,
  REGIONS,
} from '../lib/data'

const SESSION_CIBLE_STAGES = ['Point Business Plan', "Point d'étape téléphonique", "Point d'étape", 'R2 Amaury', 'Démission reconversion', 'Point juridique', 'Intégration', 'Recruté']
const INTEG_MODAL_STAGES = ["Point d'étape", "Point d'étape téléphonique", 'R2 Amaury', 'Démission reconversion', 'Point juridique', 'Recruté']
const INTEG_DATE_STAGES = ["Point d'étape", "Point d'étape téléphonique", 'R2 Amaury', 'Démission reconversion', 'Point juridique', 'Intégration', 'Recruté']
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const ANNEES = [2025, 2026, 2027]
import InlineDropdown from '../components/InlineDropdown'
import ScoreCorrectionModal from '../components/ScoreCorrectionModal'
import ChuteModal from '../components/ChuteModal'
import PasInteresseModal from '../components/PasInteresseModal'
import GrilleNotationTab from '../components/GrilleNotationTab'
import {
  IconEnvelope,
  IconLink,
  IconCalendar,
  IconMapPin,
  IconMap,
  IconBuilding,
  IconTag,
  IconStar,
  IconRefresh,
  IconDocument,
  IconPin,
  IconPencil,
  IconTrash,
  IconPlus,
  ActivityIcon,
  IconDot,
  IconClose,
  IconActivity,
  IconEvent,
} from '../components/Icons'

function formatActivityDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
}

function formatSessionLabel(s) {
  if (!s) return '—'
  const base = [s.periode, s.annee].filter(Boolean).join(' ') || s.date_session || '—'
  if (!s.date_debut) return base
  const d = new Date(s.date_debut + 'T12:00:00')
  const dayStart = d.getDate()
  const friday = new Date(d)
  friday.setDate(d.getDate() + 4)
  const dayEnd = friday.getDate()
  const month = d.toLocaleDateString('fr-FR', { month: 'long' })
  return `${base} (${dayStart}-${dayEnd} ${month})`
}

function capFirst(str) {
  if (!str || typeof str !== 'string') return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

const ICON_SM = { width: 13, height: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#1A1A1A' }

const STAGE_BORDER_COLORS = {
  R0: '#3b82f6',
  R1: '#10b981',
  "Point d'étape téléphonique": '#f59e0b',
  "Point d'étape": '#f59e0b',
  'R2 Amaury': '#ef4444',
  'Point Business Plan': '#d97706',
  'Point juridique': '#8b5cf6',
  'Démission reconversion': '#f97316',
  Intégration: '#10b981',
  Recruté: '#173731',
  Démission: '#f97316',
}

const MATURITY_BADGE_STYLES = {
  Chaud: { backgroundColor: '#fff1f2', color: '#e11d48' },
  Tiède: { backgroundColor: '#fff7ed', color: '#ea580c' },
  Froid: { backgroundColor: '#f8fafc', color: '#94a3b8' },
  Chute: { backgroundColor: '#fff1f2', color: '#e11d48', fontStyle: 'italic' },
  'Pas intéressé': { backgroundColor: '#f1f5f9', color: '#64748b', fontStyle: 'italic', fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 20 },
  Archivé: { backgroundColor: '#f8fafc', color: '#94a3b8' },
  'Très chaud': { backgroundColor: '#fff1f2', color: '#e11d48' },
}

const SOURCE_STYLES = {
  'Chasse LinkedIn': { backgroundColor: '#eff6ff', color: '#1d4ed8' },
  Recommandation: { backgroundColor: '#fefce8', color: '#a16207' },
  'Chasse Mail': { backgroundColor: '#f0fdf4', color: '#15803d' },
  'Chasse externe': { backgroundColor: '#fff7ed', color: '#c2410c' },
  'Inbound Marketing': { backgroundColor: '#faf5ff', color: '#7e22ce' },
  Ads: { backgroundColor: '#fff1f2', color: '#e11d48' },
  Autre: { backgroundColor: '#f8fafc', color: '#94a3b8' },
  Inbound: { backgroundColor: '#faf5ff', color: '#7e22ce' },
  'Direct contact': { backgroundColor: '#f8fafc', color: '#94a3b8' },
}

function getScoreBadgeStyle(score) {
  if (score == null) return { backgroundColor: '#f8fafc', color: '#94a3b8' }
  if (score >= 70) return { backgroundColor: '#dcfce7', color: '#15803d' }
  if (score >= 50) return { backgroundColor: '#fefce8', color: '#a16207' }
  return { backgroundColor: '#f8fafc', color: '#94a3b8' }
}

function hashToColor(str) {
  if (!str) return { bg: '#E5E7EB', text: '#6B7280' }
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0
  const hues = ['#173731', '#1E5FA0', '#B86B0F', '#7B3FC4', '#0E7490', '#C2410C']
  const idx = Math.abs(h) % hues.length
  return { bg: hues[idx] + '20', text: hues[idx] }
}

function formatShortDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function KanbanCard({ profile, stage, onClick, isSelected, ownerBadge, nextEvent }) {
  const handleClick = () => onClick?.(profile)

  const hasUpcomingEvent = nextEvent && (nextEvent.event_date || nextEvent.date)
  const displayDate = hasUpcomingEvent
    ? formatShortDate(nextEvent.event_date || nextEvent.date)
    : (profile.created_at ? formatShortDate(profile.created_at) : profile.dt || '')
  const dateColor = hasUpcomingEvent ? '#D2AB76' : '#ccc'
  const eventTypeLabel = hasUpcomingEvent && (nextEvent.event_type || (nextEvent.content || '').split(' — ')[0]) ? (nextEvent.event_type || (nextEvent.content || '').split(' — ')[0]) : ''

  const borderColor = STAGE_BORDER_COLORS[stage] || '#94a3b8'
  const matStyle = MATURITY_BADGE_STYLES[profile.mat] || { backgroundColor: '#f8fafc', color: '#94a3b8' }
  const scoreStyle = getScoreBadgeStyle(profile.sc)
  const isChute = profile.mat === 'Chute'
  const isPasInteresse = profile.mat === 'Pas intéressé'
  const sessionLabel = profile.integration_periode && profile.integration_annee
    ? `${profile.integration_periode} ${profile.integration_annee}`
    : profile.session_formation_id
      ? 'Session assignée'
      : null

  return (
    <div
      className={`kanban-card${isSelected ? ' selected' : ''}`}
      draggable={true}
      onDragStart={(e) => e.dataTransfer.setData('profileId', String(profile.id))}
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.boxShadow = ''
          e.currentTarget.style.transform = ''
        }
      }}
      style={{
        background: '#ffffff',
        borderRadius: 12,
        border: `1px solid rgba(0,0,0,0.06)`,
        borderLeft: `3px ${(isChute || isPasInteresse) ? 'dashed' : 'solid'} ${borderColor}`,
        padding: 14,
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        overflow: 'hidden',
        opacity: (isChute || isPasInteresse) ? 0.5 : 1,
        boxShadow: isSelected ? '0 0 0 2px #173731' : 'none',
        width: '100%',
      }}
    >
      {/* Ligne 1 - Avatar + Nom | Score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: '#173731',
              color: '#D2AB76',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {(profile.fn?.[0] || '') + (profile.ln?.[0] || '')}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#173731', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.fn} {profile.ln}</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, flexShrink: 0, ...scoreStyle }}>{profile.sc ?? '—'}</span>
      </div>

      {/* Employeur + Ville · Région (bloc groupé) */}
      <div style={{ background: 'var(--color-background-secondary)', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 1px' }}>
          {profile.co || profile.company || '—'}
        </p>
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0 }}>
          {[profile.city, profile.region].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>

      {/* Badge source (même styles que Profiles.jsx) */}
      {profile.src && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ display: 'inline-block', borderRadius: 20, padding: '3px 7px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...(SOURCE_STYLES[profile.src] || { backgroundColor: '#f8fafc', color: '#94a3b8' }) }}>
            {profile.src}
          </span>
        </div>
      )}

      {/* Ligne 4 - Badge maturité | Date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 10, borderRadius: 20, padding: '2px 7px', fontWeight: 600, ...matStyle }}>
          {profile.mat}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: dateColor }} title={eventTypeLabel || undefined}>
          {stage === 'Recruté' ? 'Intégré ✓' : displayDate}
        </span>
      </div>

      {/* Badge session si session_formation_id ou période renseignée */}
      {sessionLabel && (
        <div style={{ marginTop: 6 }}>
          <span style={{ display: 'inline-block', background: '#f0fdf4', color: '#15803d', fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 20 }}>
            {sessionLabel}
          </span>
        </div>
      )}

      {ownerBadge && (
        <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 600, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: ownerBadge.bg, color: ownerBadge.text }} title={profile.owner_full_name || profile.owner_email || ''}>{ownerBadge.initial}</span>
      )}
    </div>
  )
}

function hexWithOpacity(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${opacity})`
}

function DroppableColumn({ stage, cards, onCardClick, selectedCardId, onDrop, showOwnerBadge, nextEventsByProfileId }) {
  const stageColor = STAGE_BORDER_COLORS[stage] || '#94a3b8'

  return (
    <div
      className="kcol w-[215px] shrink-0 flex flex-col"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const profileId = e.dataTransfer.getData('profileId')
        if (profileId) onDrop(profileId, stage)
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 10,
          borderTop: `3px solid ${stageColor}`,
          padding: '8px 12px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: stageColor }}>
          {stage}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: hexWithOpacity(stageColor, 0.1), color: stageColor }}>
          {cards.length}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 min-h-[80px]">
        {cards.length === 0 ? (
          <div style={{ border: '1.5px dashed rgba(0,0,0,0.08)', borderRadius: 12, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#ddd' }}>
            Aucun profil
          </div>
        ) : (
          cards.map((p) => {
            const ownerBadge = showOwnerBadge && (p.owner_email || p.owner_id) ? {
              initial: (p.owner_full_name?.trim()?.[0] || (p.owner_email || '').split('@')[0]?.[0] || '?').toUpperCase(),
              ...hashToColor(p.owner_email || String(p.owner_id)),
            } : null
            return <KanbanCard key={p.id} profile={p} stage={stage} onClick={onCardClick} isSelected={p.id === selectedCardId} ownerBadge={ownerBadge} nextEvent={nextEventsByProfileId?.[p.id]} />
          })
        )}
      </div>
    </div>
  )
}

const NOTE_TEMPLATE_OPTS = ['Note libre', 'Récapitulatif R0', 'Récapitulatif R1', "Récapitulatif Point d'étape"]

const ACCENT = '#173731'
const GOLD = '#D2AB76'

function formatSessionDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function Pipeline() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const stageFilter = searchParams.get('stage')
  const { user, userProfile, role } = useAuth()
  const { viewMode } = useViewMode()
  const { filteredProfiles, changeStage, changeMaturity, changeSource, changeRegion, updateProfileField, updateProfile, showNotif, useSupabase, fetchProfiles } = useCRM()
  const isGlobalView = role === 'admin' && viewMode === 'global'
  const pipeline = filteredProfiles.filter((p) => p.stg && p.stg !== '' && p.stg !== 'Recruté' && p.mat !== 'Archivé' && p.mat !== 'Chute' && p.mat !== 'Pas intéressé')
  const all = filteredProfiles.filter((p) => p.stg && p.stg !== '' && p.mat !== 'Archivé' && p.mat !== 'Chute' && p.mat !== 'Pas intéressé')
  const [modalProfile, setModalProfile] = useState(null)
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [modalTab, setModalTab] = useState('notes')
  const [notes, setNotes] = useState([])
  const [activities, setActivities] = useState([])
  const [events, setEvents] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteTemplate, setNoteTemplate] = useState('Note libre')
  const [noteContent, setNoteContent] = useState('')
  const [showEventForm, setShowEventForm] = useState(false)
  const [evType, setEvType] = useState('R0')
  const [evDate, setEvDate] = useState('')
  const [evDetail, setEvDetail] = useState('')
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingNoteContent, setEditingNoteContent] = useState('')
  const [editingEventId, setEditingEventId] = useState(null)
  const [editingEventType, setEditingEventType] = useState('R0')
  const [editingEventDate, setEditingEventDate] = useState('')
  const [editingEventDetail, setEditingEventDetail] = useState('')
  const [confirmDeleteNote, setConfirmDeleteNote] = useState(null)
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [availableSessions, setAvailableSessions] = useState([])
  const [expandedNoteId, setExpandedNoteId] = useState(null)
  const [expandedEventId, setExpandedEventId] = useState(null)
  const [enriching, setEnriching] = useState(false)
  const [scoreCorrectionOpen, setScoreCorrectionOpen] = useState(false)
  const [pendingStageChange, setPendingStageChange] = useState(null)
  const [pendingSessions, setPendingSessions] = useState([])
  const [pendingSessionId, setPendingSessionId] = useState('')
  const [stageChangeDate, setStageChangeDate] = useState('')
  const [stageChangeTime, setStageChangeTime] = useState('')
  const [stageChangeRdType, setStageChangeRdType] = useState('Google Meet')
  const [stageChangeNotes, setStageChangeNotes] = useState('')
  const [stageChangeSkipStep, setStageChangeSkipStep] = useState(false)
  const [editingInteg, setEditingInteg] = useState(false)
  const [editIntegPeriode, setEditIntegPeriode] = useState('')
  const [editIntegAnnee, setEditIntegAnnee] = useState('')
  const [editSelectedSessionId, setEditSelectedSessionId] = useState('')
  const [profileToAssign, setProfileToAssign] = useState(null)
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [sessions, setSessions] = useState([])
  const [sessionsWithCount, setSessionsWithCount] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [selectedSession, setSelectedSession] = useState('')
  const [showCreateSession, setShowCreateSession] = useState(false)
  const [newSession, setNewSession] = useState({
    date_session: '',
    lieu: '',
    places_total: 6,
    statut: 'planifiée',
    notes: '',
  })
  const [chuteModalProfile, setChuteModalProfile] = useState(null)
  const [pasInteresseModalProfile, setPasInteresseModalProfile] = useState(null)
  const [showStadeDropdown, setShowStadeDropdown] = useState(false)
  const [showMaturiteDropdown, setShowMaturiteDropdown] = useState(false)
  const [showSourceDropdown, setShowSourceDropdown] = useState(false)
  const [nextEventsByProfileId, setNextEventsByProfileId] = useState({})

  const displayProfile = modalProfile ? (filteredProfiles.find((p) => p.id === modalProfile.id) || modalProfile) : null

  useEffect(() => {
    if (!modalProfile) setEditingInteg(false)
  }, [modalProfile])

  useEffect(() => {
    const loadNextEvents = async () => {
      const ids = all.map((p) => p.id).filter(Boolean)
      if (ids.length === 0) { setNextEventsByProfileId({}); return }
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('events')
        .select('id, profile_id, event_date, event_type, date, content')
        .in('profile_id', ids)
      const eventsList = data || []
      const byProfile = {}
      eventsList.forEach((ev) => {
        const d = ev.event_date || ev.date || ev.created_at
        if (!d) return
        const dateStr = typeof d === 'string' ? d.split('T')[0] : new Date(d).toISOString().split('T')[0]
        if (dateStr < today) return
        const pid = ev.profile_id
        const current = byProfile[pid]
        const currentStr = current ? (typeof (current.event_date || current.date) === 'string' ? (current.event_date || current.date).split('T')[0] : new Date(current.event_date || current.date).toISOString().split('T')[0]) : ''
        if (!current || dateStr < currentStr) byProfile[pid] = ev
      })
      setNextEventsByProfileId(byProfile)
    }
    loadNextEvents()
  }, [all.map((p) => p.id).sort().join(',')])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.stade-dropdown')) setShowStadeDropdown(false)
      if (!e.target.closest('.maturite-dropdown')) setShowMaturiteDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!modalProfile) {
      setShowStadeDropdown(false)
      setShowMaturiteDropdown(false)
    }
  }, [modalProfile])

  const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']
  const formatExperiencePeriod = (exp) => {
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

  useEffect(() => {
    if (!modalProfile?.id) return
    setLoadingDetail(true)
    Promise.all([
      supabase.from('notes').select('*').eq('profile_id', modalProfile.id).order('created_at', { ascending: false }),
      supabase.from('activities').select('*').eq('profile_id', modalProfile.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('events').select('*').eq('profile_id', modalProfile.id).order('created_at', { ascending: false }),
    ]).then(([notesRes, actsRes, evtsRes]) => {
      setNotes(notesRes.data || [])
      setActivities(actsRes.data || [])
      setEvents(evtsRes.data || [])
    }).finally(() => setLoadingDetail(false))
  }, [modalProfile?.id])

  useEffect(() => {
    const loadSessions = async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('sessions_formation')
        .select('id, periode, annee, date_session, date_debut, statut')
        .gte('date_session', today)
        .order('date_session', { ascending: true })
      setAvailableSessions(data || [])
    }
    if (modalProfile) loadSessions()
    else setAvailableSessions([])
  }, [modalProfile])

  const [formationSessionsForRecrute, setFormationSessionsForRecrute] = useState([])
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('sessions_formation')
        .select('id, periode, annee, date_debut')
        .order('date_debut', { ascending: true })
      setFormationSessionsForRecrute(data || [])
    }
    if (modalProfile?.stg === 'Recruté') load()
    else setFormationSessionsForRecrute([])
  }, [modalProfile?.id, modalProfile?.stg])

  useEffect(() => {
    setNoteContent(NOTE_TEMPLATES[noteTemplate] ?? '')
  }, [noteTemplate])

  useEffect(() => {
    if (!showSessionModal || !profileToAssign) return
    const loadSessions = async () => {
      setSessionsLoading(true)
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('sessions_formation')
        .select('*')
        .gte('date_session', today)
        .order('date_session', { ascending: true })
      const list = data || []
      setSessions(list)
      const withCount = await Promise.all(
        list.map(async (s) => {
          const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('session_formation_id', s.id)
          return { ...s, inscrits: count ?? 0 }
        })
      )
      setSessionsWithCount(withCount)
      setSessionsLoading(false)
      if (!list.length) setShowCreateSession(true)
      else setShowCreateSession(false)
      setSelectedSession(profileToAssign.session_formation_id || '')
    }
    loadSessions()
  }, [showSessionModal, profileToAssign?.id, profileToAssign?.session_formation_id])

  useEffect(() => {
    if (!modalProfile) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (editingField) { setEditingField(null); setEditValue('') }
        else { setModalProfile(null); setSelectedCardId(null) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalProfile, editingField])

  useEffect(() => {
    if (pendingStageChange && (pendingStageChange.newStage === "Point d'étape téléphonique" || pendingStageChange.newStage === "Point d'étape" || INTEG_MODAL_STAGES.includes(pendingStageChange.newStage))) {
      supabase
        .from('sessions_formation')
        .select('id, periode, annee, date_debut')
        .order('date_debut', { ascending: true })
        .then(({ data }) => setPendingSessions(data || []))
    } else {
      setPendingSessions([])
      setPendingSessionId('')
    }
  }, [pendingStageChange?.newStage])

  const loadNotes = async () => {
    if (!modalProfile?.id) return
    const { data } = await supabase.from('notes').select('*').eq('profile_id', modalProfile.id).order('created_at', { ascending: false })
    setNotes(data || [])
  }

  const loadActivities = async () => {
    if (!modalProfile?.id) return
    const { data } = await supabase.from('activities').select('*').eq('profile_id', modalProfile.id).order('created_at', { ascending: false }).limit(10)
    setActivities(data || [])
  }

  const loadEvents = async () => {
    if (!modalProfile?.id) return
    const { data } = await supabase.from('events').select('*').eq('profile_id', modalProfile.id).order('created_at', { ascending: false })
    setEvents(data || [])
  }

  const today = () => new Date().toISOString().split('T')[0]

  const handleSaveNote = async () => {
    if (!modalProfile?.id || !noteContent.trim()) return
    await supabase.from('notes').insert({
      profile_id: modalProfile.id,
      content: noteContent.trim(),
      template: noteTemplate,
      author: userProfile?.full_name?.trim() || user?.email || null,
    })
    await supabase.from('activities').insert({
      profile_id: modalProfile.id,
      type: 'note_added',
      note: noteContent.trim().slice(0, 200),
      date: new Date().toISOString().split('T')[0],
      icon: 'document',
      source: 'manual',
    })
    setNoteContent(NOTE_TEMPLATES[noteTemplate] ?? '')
    setShowNoteForm(false)
    await loadNotes()
    await loadActivities()
  }

  const handleUpdateNote = async () => {
    if (!editingNoteId || !modalProfile?.id) return
    await supabase.from('notes').update({ content: editingNoteContent, updated_at: new Date().toISOString() }).eq('id', editingNoteId)
    setEditingNoteId(null)
    setEditingNoteContent('')
    await loadNotes()
    await loadActivities()
  }

  const handleDeleteNote = async (noteId, content) => {
    if (!modalProfile?.id) return
    await supabase.from('notes').delete().eq('id', noteId)
    setNotes((prev) => prev.filter((n) => n.id !== noteId))
    await supabase.from('activities').insert({
      profile_id: modalProfile.id,
      type: 'note_deleted',
      note: (content || '').slice(0, 200),
      date: new Date().toISOString().split('T')[0],
      icon: 'trash',
      source: 'manual',
    })
    await loadActivities()
    setConfirmDeleteNote(null)
  }

  const handleDeleteEvent = async (eventId) => {
    if (!modalProfile?.id) return
    const ev = events.find((e) => e.id === eventId)
    await supabase.from('events').delete().eq('id', eventId)
    setEvents((prev) => prev.filter((e) => e.id !== eventId))
    await supabase.from('activities').insert({
      profile_id: modalProfile.id,
      type: 'event_deleted',
      note: ev?.content || 'Événement supprimé',
      date: new Date().toISOString().split('T')[0],
      icon: 'trash',
      source: 'manual',
    })
    await loadActivities()
    setConfirmDeleteEvent(null)
  }

  const handleAddEvent = async () => {
    if (!modalProfile?.id) return
    const content = evType + (evDetail.trim() ? ' — ' + evDetail.trim() : '')
    const date = evDate || today()
    await supabase.from('events').insert({ profile_id: modalProfile.id, content, date })
    await supabase.from('activities').insert({
      profile_id: modalProfile.id,
      type: 'event_added',
      note: content,
      date,
      icon: 'event',
      source: 'manual',
    })
    setEvDate('')
    setEvDetail('')
    setShowEventForm(false)
    await loadEvents()
    await loadActivities()
  }

  const startEditEvent = (e) => {
    const parts = (e.content || '').split(' — ')
    setEditingEventId(e.id)
    setEditingEventType(EVENT_TYPES.includes(parts[0]) ? parts[0] : 'Autre')
    setEditingEventDate(e.date || today())
    setEditingEventDetail(parts.slice(1).join(' — ').trim())
  }

  const handleSaveEventEdit = async () => {
    if (!editingEventId || !modalProfile?.id) return
    const content = editingEventType + (editingEventDetail ? ' — ' + editingEventDetail : '')
    await supabase.from('events').update({ content, date: editingEventDate }).eq('id', editingEventId)
    setEditingEventId(null)
    setEditingEventType('R0')
    setEditingEventDate('')
    setEditingEventDetail('')
    await loadEvents()
  }

  const handleChangeStage = async (v) => {
    if (!displayProfile?.id || !modalProfile?.id) return
    const oldValue = displayProfile.stg ?? '—'
    if (oldValue === v) return
    changeStage(displayProfile.id, v)
    await supabase.from('activities').insert({
      profile_id: modalProfile.id,
      type: 'stage_change',
      note: `${oldValue} → ${v}`,
      date: new Date().toISOString().split('T')[0],
      icon: 'refresh',
      source: 'manual',
    })
    const { data } = await supabase.from('activities').select('*').eq('profile_id', modalProfile.id).order('created_at', { ascending: false }).limit(10)
    setActivities(data || [])
    if (v === 'Recruté') {
      setModalProfile(null)
      setSelectedCardId(null)
      setProfileToAssign({ ...displayProfile, session_formation_id: displayProfile.session_formation_id, stg: 'Recruté' })
      setShowSessionModal(true)
    }
  }

  const handleChangeMaturity = async (v) => {
    if (!displayProfile?.id || !modalProfile?.id) return
    const oldValue = displayProfile.mat ?? '—'
    if (oldValue === v) return
    if (v === 'Chute') {
      setChuteModalProfile(displayProfile)
      return
    }
    if (v === 'Pas intéressé') {
      setPasInteresseModalProfile(displayProfile)
      return
    }
    changeMaturity(displayProfile.id, v)
    await supabase.from('activities').insert({
      profile_id: modalProfile.id,
      type: 'maturity_change',
      note: `${oldValue} → ${v}`,
      date: new Date().toISOString().split('T')[0],
      icon: 'refresh',
      source: 'manual',
    })
    const { data } = await supabase.from('activities').select('*').eq('profile_id', modalProfile.id).order('created_at', { ascending: false }).limit(10)
    setActivities(data || [])
  }

  const handleDrop = async (profileId, newStage) => {
    const profile = all.find((p) => String(p.id) === String(profileId))
    if (!profile || profile.stg === newStage) return
    if (newStage === 'Recruté') {
      const oldStage = profile.stg ?? '—'
      changeStage(profileId, newStage)
      if (useSupabase) {
        await supabase.from('profiles').update({ stage: 'Recruté' }).eq('id', profile.id)
        await supabase.from('activities').insert({
          profile_id: profile.id,
          type: 'stage_change',
          note: `${oldStage} → Recruté`,
          date: new Date().toISOString().split('T')[0],
          icon: 'refresh',
          source: 'manual',
        })
        fetchProfiles()
      }
      setProfileToAssign({ id: profile.id, fn: profile.fn, ln: profile.ln, session_formation_id: profile.session_formation_id, stg: 'Recruté' })
      setShowSessionModal(true)
      return
    }
    setPendingStageChange({ profileId, profile, newStage })
    setStageChangeDate('')
    setStageChangeTime('')
    setStageChangeRdType('Google Meet')
    setStageChangeNotes('')
    setStageChangeSkipStep(false)
    setPendingSessionId(profile.session_formation_id || '')
  }

  const handleConfirmStageChange = async () => {
    if (!pendingStageChange) return
    const { profileId, profile, newStage } = pendingStageChange
    if (newStage === 'Recruté') {
      const oldStage = profile.stg ?? '—'
      changeStage(profileId, newStage)
      if (useSupabase) {
        await supabase.from('profiles').update({ stage: 'Recruté' }).eq('id', profile.id)
        await supabase.from('activities').insert({
          profile_id: profile.id,
          type: 'stage_change',
          note: `${oldStage} → Recruté`,
          date: new Date().toISOString().split('T')[0],
          icon: 'refresh',
          source: 'manual',
        })
        fetchProfiles()
      }
      setPendingStageChange(null)
      setStageChangeDate('')
      setStageChangeNotes('')
      setProfileToAssign({ id: profile.id, fn: profile.fn, ln: profile.ln, session_formation_id: profile.session_formation_id, stg: 'Recruté' })
      setShowSessionModal(true)
      return
    }
    const oldStage = profile.stg ?? '—'
    changeStage(profileId, newStage)
    if (useSupabase) {
      const updates = { stage: newStage }
      if (stageChangeSkipStep && newStage === 'Point Business Plan') updates.skip_business_plan = true
      if (stageChangeSkipStep && newStage === 'Démission reconversion') updates.skip_demission = true
      await supabase.from('profiles').update(updates).eq('id', profile.id)
      const timeVal = stageChangeTime || '12:00'
      const eventDateVal = stageChangeDate ? (stageChangeDate.includes('T') ? stageChangeDate : `${stageChangeDate}T${timeVal}${timeVal.length === 5 ? ':00' : ''}`) : null
      if (eventDateVal) {
        const eventRow = { profile_id: profile.id, event_type: stageChangeRdType, event_date: eventDateVal, description: stageChangeNotes || newStage }
        if (user?.id) eventRow.owner_id = user.id
        await supabase.from(EVENTS_TABLE).insert(eventRow)
        window.dispatchEvent(new CustomEvent('evolve:event-added'))
      }
      if (pendingSessionId && INTEG_MODAL_STAGES.includes(newStage)) {
        const session = pendingSessions.find((s) => s.id === pendingSessionId)
        await supabase.from('profiles').update({
          session_formation_id: pendingSessionId,
          integration_periode: session?.periode ?? null,
          integration_annee: session?.annee ?? null,
          integration_confirmed: false,
        }).eq('id', profile.id)
        updateProfile(profile.id, { session_formation_id: pendingSessionId, integration_periode: session?.periode, integration_annee: session?.annee, integration_confirmed: false })
      }
      await supabase.from('activities').insert({
        profile_id: profile.id,
        type: 'stage_change',
        note: `${oldStage} → ${newStage}`,
        date: new Date().toISOString().split('T')[0],
        icon: 'refresh',
        source: 'manual',
      })
      fetchProfiles()
    }
    setStageChangeDate('')
    setStageChangeTime('')
    setStageChangeRdType('Google Meet')
    setStageChangeNotes('')
    setStageChangeSkipStep(false)
    setPendingSessionId('')
    setPendingSessions([])
    setPendingStageChange(null)
  }

  const handleSkipStageChangeDate = async () => {
    if (!pendingStageChange) return
    const { profileId, profile, newStage } = pendingStageChange
    if (newStage === 'Recruté') {
      const oldStage = profile.stg ?? '—'
      changeStage(profileId, newStage)
      if (useSupabase) {
        await supabase.from('profiles').update({ stage: 'Recruté' }).eq('id', profile.id)
        await supabase.from('activities').insert({
          profile_id: profile.id,
          type: 'stage_change',
          note: `${oldStage} → Recruté`,
          date: new Date().toISOString().split('T')[0],
          icon: 'refresh',
          source: 'manual',
        })
        fetchProfiles()
      }
      setPendingStageChange(null)
      setStageChangeDate('')
      setStageChangeTime('')
      setStageChangeRdType('Google Meet')
      setStageChangeNotes('')
      setProfileToAssign({ id: profile.id, fn: profile.fn, ln: profile.ln, session_formation_id: profile.session_formation_id, stg: 'Recruté' })
      setShowSessionModal(true)
      return
    }
    const oldStage = profile.stg ?? '—'
    changeStage(profileId, newStage)
    if (useSupabase) {
      const updates = { stage: newStage }
      if (stageChangeSkipStep && newStage === 'Point Business Plan') updates.skip_business_plan = true
      if (stageChangeSkipStep && newStage === 'Démission reconversion') updates.skip_demission = true
      await supabase.from('profiles').update(updates).eq('id', profile.id)
      if (pendingSessionId && INTEG_MODAL_STAGES.includes(newStage)) {
        const session = pendingSessions.find((s) => s.id === pendingSessionId)
        await supabase.from('profiles').update({
          session_formation_id: pendingSessionId,
          integration_periode: session?.periode ?? null,
          integration_annee: session?.annee ?? null,
          integration_confirmed: false,
        }).eq('id', profile.id)
        updateProfile(profile.id, { session_formation_id: pendingSessionId, integration_periode: session?.periode, integration_annee: session?.annee, integration_confirmed: false })
      }
      await supabase.from('activities').insert({
        profile_id: profile.id,
        type: 'stage_change',
        note: `${oldStage} → ${newStage}`,
        date: new Date().toISOString().split('T')[0],
        icon: 'refresh',
        source: 'manual',
      })
      fetchProfiles()
    }
    setStageChangeDate('')
    setStageChangeTime('')
    setStageChangeRdType('Google Meet')
    setStageChangeNotes('')
    setStageChangeSkipStep(false)
    setPendingSessionId('')
    setPendingSessions([])
    setPendingStageChange(null)
  }

  const matColor = (m) => MATURITY_COLORS[m] || { bg: '#F3F4F6', text: '#6B7280' }
  const stageColor = (s) => STAGE_COLORS[s] || { bg: '#F3F4F6', text: '#6B7280' }
  const stag = (s) => ({ background: stageColor(s).bg, color: stageColor(s).text })
  const matStyle = (m) => ({ background: matColor(m).bg, color: matColor(m).text })

  const MODAL_MAT_STYLES = { Froid: { bg: '#f8fafc', color: '#94a3b8' }, Tiède: { bg: '#fff7ed', color: '#ea580c' }, Chaud: { bg: '#fff1f2', color: '#e11d48' }, 'Très chaud': { bg: '#fff1f2', color: '#e11d48' }, Chute: { bg: '#fff1f2', color: '#e11d48' }, 'Pas intéressé': { bg: '#f1f5f9', color: '#64748b', fontStyle: 'italic' }, Archivé: { bg: '#f8fafc', color: '#94a3b8' } }
  const MODAL_STAGE_STYLES = { R0: { bg: '#eff6ff', color: '#1d4ed8' }, R1: { bg: '#f0fdf4', color: '#15803d' }, "Point d'étape": { bg: '#fefce8', color: '#a16207' }, "Point d'étape téléphonique": { bg: '#fefce8', color: '#a16207' }, 'R2 Amaury': { bg: '#fff7ed', color: '#c2410c' }, 'Point Business Plan': { bg: '#fef3c7', color: '#b45309' }, 'Point juridique': { bg: '#f5f3ff', color: '#6d28d9' }, 'Démission reconversion': { bg: '#fff7ed', color: '#ea580c' }, Intégration: { bg: '#f0fdf4', color: '#15803d' }, Recruté: { bg: '#f0fdf4', color: '#15803d' }, Démission: { bg: '#fff7ed', color: '#ea580c' } }
  const MODAL_SOURCE_STYLES = { 'Chasse LinkedIn': { bg: '#eff6ff', color: '#1d4ed8' }, 'Chasse Mail': { bg: '#f0fdf4', color: '#15803d' }, Recommandation: { bg: '#fefce8', color: '#a16207' }, Ads: { bg: '#f5f3ff', color: '#6d28d9' }, 'Chasse externe': { bg: '#f8fafc', color: '#64748b' }, 'Inbound Marketing': { bg: '#f0fdf4', color: '#15803d' }, Autre: { bg: '#f8fafc', color: '#64748b' } }
  const modalMatStyle = (m) => ({ ...MODAL_MAT_STYLES[m || 'Froid'], borderRadius: 20, fontSize: 10, fontWeight: 600, padding: '3px 9px' })
  const modalStagStyle = (s) => ({ ...(MODAL_STAGE_STYLES[s] || { bg: '#f8fafc', color: '#64748b' }), borderRadius: 20, fontSize: 10, fontWeight: 600, padding: '3px 9px' })
  const modalSourceStyle = (src) => src ? { ...(MODAL_SOURCE_STYLES[src] || { bg: '#f8fafc', color: '#64748b' }), borderRadius: 20, fontSize: 10, fontWeight: 600, padding: '3px 9px' } : null

  const startEditField = (field, currentVal) => {
    setEditingField(field)
    setEditValue(currentVal ?? '')
  }

  const handleSaveFieldEdit = async () => {
    if (!editingField || !displayProfile?.id) return
    const field = editingField
    const newVal = field === 'region' || field === 'source' ? editValue : editValue.trim()
    const profileField = field === 'source' ? 'src' : field
    const oldVal = displayProfile[profileField] ?? '—'

    if (String(oldVal) === String(newVal)) {
      setEditingField(null)
      setEditValue('')
      return
    }

    if (field === 'region') changeRegion(displayProfile.id, newVal)
    else if (field === 'source') changeSource(displayProfile.id, newVal)
    else updateProfileField(displayProfile.id, profileField, newVal)

    setEditingField(null)
    setEditValue('')
    await loadActivities()
  }

  return (
    <div id="pg-pipeline" className="h-full flex flex-col overflow-hidden">
      <div className="pipbar py-4 px-5 pt-4 flex items-center gap-3 shrink-0">
        <div className="font-semibold text-sm">Pipeline recrutement — vue Kanban</div>
        <span className="bdg bg-[var(--s2)] text-[var(--t2)] text-xs py-0.5 px-2 rounded-full font-medium">{pipeline.length} profils actifs</span>
        <button type="button" className="btn bp bsm py-1.5 px-2.5 text-xs ml-auto" onClick={() => window.dispatchEvent(new CustomEvent('open-new-profile'))}>+ Nouveau profil</button>
      </div>
      <div className="kb flex gap-3 py-3.5 px-5 pb-5 overflow-x-auto flex-1 items-start">
          {STAGES.filter((st) => !stageFilter || st === stageFilter).map((st) => {
            const cards = all.filter((p) => p.stg === st)
            return (
              <DroppableColumn
                key={st}
                stage={st}
                cards={cards}
                onCardClick={(p) => {
                  setModalProfile(p)
                  setSelectedCardId(p.id)
                }}
                selectedCardId={selectedCardId}
                onDrop={handleDrop}
                showOwnerBadge={isGlobalView}
                nextEventsByProfileId={nextEventsByProfileId}
              />
            )
          })}
        </div>

      {modalProfile && displayProfile && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.2s',
          }}
          onClick={() => { setModalProfile(null); setSelectedCardId(null) }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 16,
              width: 1100,
              height: '95vh',
              maxHeight: '95vh',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              transition: 'all 0.2s',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(showStadeDropdown || showMaturiteDropdown || showSourceDropdown) && (
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                onClick={() => { setShowStadeDropdown(false); setShowMaturiteDropdown(false); setShowSourceDropdown(false) }}
                aria-hidden
              />
            )}

            {/* COLONNE GAUCHE */}
            <div
              style={{
                width: 280,
                flexShrink: 0,
                background: '#f9f7f4',
                padding: '24px 20px',
                borderRight: '1px solid rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#173731', color: '#E7E0D0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                {(displayProfile.fn?.[0] || '') + (displayProfile.ln?.[0] || '')}
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: '12px 0 4px', color: '#173731' }}>
                {capFirst(displayProfile.fn)} {capFirst(displayProfile.ln)}
              </h2>
              <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 12px' }}>
                {displayProfile.co || '—'} · {displayProfile.ti || '—'} · {displayProfile.city || '—'}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <InlineDropdown options={MATURITIES} value={displayProfile.mat} onChange={handleChangeMaturity} buttonStyle={modalMatStyle} buttonClassName="tag tag-btn" open={showMaturiteDropdown} onOpenChange={(v) => { setShowMaturiteDropdown(v); if (v) setShowStadeDropdown(false); }} containerClassName="maturite-dropdown" />
                <InlineDropdown options={STAGES} value={displayProfile.stg} onChange={handleChangeStage} buttonStyle={modalStagStyle} buttonClassName="tag tag-btn" placeholder="—" open={showStadeDropdown} onOpenChange={(v) => { setShowStadeDropdown(v); if (v) setShowMaturiteDropdown(false); }} containerClassName="stade-dropdown" />
                {displayProfile.src && (
                  <InlineDropdown options={SOURCES} value={displayProfile.src} onChange={(v) => { changeSource(displayProfile.id, v); setShowSourceDropdown(false); loadActivities(); }} buttonStyle={(v) => modalSourceStyle(v || displayProfile.src)} buttonClassName="tag tag-btn" open={showSourceDropdown} onOpenChange={(v) => { setShowSourceDropdown(v); if (v) { setShowStadeDropdown(false); setShowMaturiteDropdown(false); } }} containerClassName="source-dropdown" />
                )}
              </div>
              <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', padding: '10px 14px', marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#aaa', marginBottom: 2 }}>Score IA</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#173731' }}>{displayProfile.sc ?? '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#aaa', marginBottom: 2 }}>Priorité</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: (displayProfile.sc ?? 0) >= 70 ? '#15803d' : (displayProfile.sc ?? 0) >= 50 ? '#a16207' : '#94a3b8' }}>
                      {(displayProfile.sc ?? 0) >= 70 ? 'Prioritaire' : (displayProfile.sc ?? 0) >= 50 ? 'À travailler' : 'À écarter'}
                    </div>
                  </div>
                </div>
                <div style={{ height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#173731', width: `${Math.min(100, (displayProfile.sc ?? 0))}%`, borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
              </div>
              <button type="button" onClick={() => setScoreCorrectionOpen(true)} style={{ marginTop: 6, fontSize: 11, color: '#ea580c', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }} title="Signaler un score inexact">
                Signaler un score inexact
              </button>
              {displayProfile.stg === 'Recruté' && (
                <div style={{ marginTop: 8 }}>
                  {editingInteg ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <select
                        value={editSelectedSessionId}
                        onChange={(e) => setEditSelectedSessionId(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, background: 'white' }}
                      >
                        <option value="">— Aucune session</option>
                        {formationSessionsForRecrute.map((s) => (
                          <option key={s.id} value={s.id}>{formatSessionLabel(s)}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!displayProfile?.id || !useSupabase) return
                            const session = editSelectedSessionId ? formationSessionsForRecrute.find((s) => s.id === editSelectedSessionId) : null
                            const updates = {
                              session_formation_id: session?.id ?? null,
                              integration_periode: session?.periode ?? null,
                              integration_annee: session?.annee ?? null,
                            }
                            await supabase.from('profiles').update(updates).eq('id', displayProfile.id)
                            const sessionLabel = session ? formatSessionLabel(session) : 'Aucune'
                            await supabase.from(EVENTS_TABLE).insert({
                              profile_id: displayProfile.id,
                              event_type: 'Modification session',
                              event_date: new Date().toISOString(),
                              description: `Session modifiée → ${sessionLabel}`,
                              ...(user?.id && { owner_id: user.id }),
                            })
                            updateProfile(displayProfile.id, updates)
                            fetchProfiles?.()
                            setEditingInteg(false)
                            window.dispatchEvent(new CustomEvent('evolve:event-added'))
                            window.dispatchEvent(new CustomEvent('evolve:session-updated'))
                          }}
                          style={{ padding: '6px 12px', fontSize: 12, background: '#173731', color: '#E7E0D0', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingInteg(false); setEditSelectedSessionId(displayProfile.session_formation_id || ''); }}
                          style={{ padding: '6px 12px', fontSize: 12, background: 'transparent', color: '#173731', border: '1px solid #173731', borderRadius: 8, cursor: 'pointer' }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', color: '#15803d', fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20 }}>
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      <span>{formatSessionLabel(formationSessionsForRecrute.find((s) => s.id === displayProfile.session_formation_id)) || 'Non définie'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingInteg(true)
                          setEditSelectedSessionId(displayProfile.session_formation_id || '')
                        }}
                        style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', marginLeft: 2 }}
                        title="Modifier"
                      >
                        <IconPencil />
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '16px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, color: '#555' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flexShrink: 0, width: 14, height: 14, display: 'flex' }}><IconEnvelope /></span>
                  {editingField === 'mail' ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0 }}>
                      <input type="email" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveFieldEdit()} autoFocus style={{ flex: 1, padding: '4px 8px', fontSize: 12, border: '2px solid #173731', borderRadius: 6, outline: 'none' }} />
                      <button type="button" onClick={handleSaveFieldEdit} style={{ padding: '4px 10px', background: '#173731', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✓</button>
                    </div>
                  ) : (
                    <span onClick={() => startEditField('mail', displayProfile.mail)} style={{ color: '#173731', textDecoration: 'underline', cursor: 'pointer' }}>{displayProfile.mail || '—'}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flexShrink: 0, width: 14, height: 14, display: 'flex' }}><IconLink /></span>
                  <a href={displayProfile.li?.startsWith('http') ? displayProfile.li : `https://${displayProfile.li}`} target="_blank" rel="noopener noreferrer" style={{ color: '#173731', textDecoration: 'underline' }}>{displayProfile.li || '—'}</a>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flexShrink: 0, width: 14, height: 14, display: 'flex' }}><IconMapPin /></span>
                  {editingField === 'city' ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0 }}>
                      <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveFieldEdit()} autoFocus style={{ flex: 1, padding: '4px 8px', fontSize: 12, border: '2px solid #173731', borderRadius: 6, outline: 'none' }} />
                      <button type="button" onClick={handleSaveFieldEdit} style={{ padding: '4px 10px', background: '#173731', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✓</button>
                    </div>
                  ) : (
                    <span onClick={() => startEditField('city', displayProfile.city)} style={{ cursor: 'pointer' }}>{displayProfile.city || '—'}</span>
                  )}
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 24 }} />
              <button
                type="button"
                onClick={() => { setModalProfile(null); navigate(`/profiles/${displayProfile.id}`) }}
                style={{ width: '100%', marginTop: 'auto', padding: 10, borderRadius: 10, background: '#173731', color: '#D2AB76', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
              >
                Ouvrir la fiche complète →
              </button>
            </div>

            {/* COLONNE DROITE */}
            <div style={{ flex: 1, minHeight: 0, background: '#ffffff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 24px', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
                {['notes', 'events', 'activity', 'grille', 'parcours'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setModalTab(tab)}
                    style={{
                      padding: '12px 16px',
                      fontSize: 12,
                      fontWeight: 500,
                      background: 'none',
                      border: 'none',
                      borderBottom: modalTab === tab ? '2px solid #173731' : '2px solid transparent',
                      color: modalTab === tab ? '#173731' : '#aaa',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {tab === 'notes' ? 'Notes' : tab === 'events' ? 'Événements' : tab === 'activity' ? 'Activité' : tab === 'grille' ? 'Grille de notation' : 'Parcours professionnel'}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setModalProfile(null); setSelectedCardId(null) }}
                  style={{
                    padding: 8,
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 'auto',
                  }}
                >
                  <IconClose />
                </button>
              </div>

              {loadingDetail ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#6B6B6B' }}>Chargement...</div>
              ) : modalTab === 'notes' ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    {!showNoteForm && (
                      <button
                        type="button"
                        onClick={() => setShowNoteForm(true)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          background: '#173731',
                          color: '#E7E0D0',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        + Nouvelle note
                      </button>
                    )}
                  </div>
                  {!showNoteForm && notes.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 }}>
                      <span style={{ width: 48, height: 48, display: 'flex', color: '#bbb' }}><IconDocument /></span>
                      <div style={{ fontSize: 12, color: '#bbb' }}>Cliquez sur + Nouvelle note pour commencer</div>
                    </div>
                  )}
                  {showNoteForm && (
                    <div style={{ background: '#F8F5F1', padding: 16, borderRadius: 10, marginBottom: 16 }}>
                      <select
                        value={noteTemplate}
                        onChange={(e) => setNoteTemplate(e.target.value)}
                        style={{ width: '100%', padding: 8, marginBottom: 12, borderRadius: 6, border: '1px solid #E5E0D8' }}
                      >
                        {NOTE_TEMPLATE_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Saisir le contenu de la note..."
                        style={{ width: '100%', minHeight: 400, padding: 12, borderRadius: 6, border: '1px solid #E5E0D8', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button type="button" onClick={handleSaveNote} style={{ padding: '8px 16px', borderRadius: 8, background: '#D2AB76', color: '#173731', border: 'none', cursor: 'pointer', fontSize: 13 }}>Enregistrer</button>
                        <button type="button" onClick={() => { setShowNoteForm(false); setNoteContent(NOTE_TEMPLATES[noteTemplate] ?? '') }} style={{ padding: '8px 16px', borderRadius: 8, background: '#E5E0D8', color: '#6B6B6B', border: 'none', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                      </div>
                    </div>
                  )}
                  {notes.map((n) => (
                    <div
                      key={n.id}
                      className="pipeline-note-card"
                      style={{
                        background: 'white',
                        border: '1px solid #E5E0D8',
                        borderRadius: 10,
                        padding: 14,
                        marginBottom: 10,
                        transition: 'background 0.2s',
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { if (expandedNoteId !== n.id) e.currentTarget.style.background = '#F8F5F1' }}
                      onMouseLeave={(e) => { if (expandedNoteId !== n.id) e.currentTarget.style.background = 'white' }}
                    >
                      {editingNoteId === n.id ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <textarea value={editingNoteContent} onChange={(e) => setEditingNoteContent(e.target.value)} style={{ width: '100%', minHeight: 400, padding: 12, fontSize: 13, borderRadius: 8, border: '1px solid #E5E0D8', resize: 'vertical' }} />
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button type="button" onClick={handleUpdateNote} style={{ padding: '8px 16px', borderRadius: 8, background: '#D2AB76', color: '#173731', border: 'none', cursor: 'pointer', fontSize: 13 }}>Enregistrer</button>
                            <button type="button" onClick={() => { setEditingNoteId(null); setEditingNoteContent(''); setExpandedNoteId(null); }} style={{ padding: '8px 16px', borderRadius: 8, background: '#E5E0D8', color: '#6B6B6B', border: 'none', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}
                            onClick={() => setExpandedNoteId((prev) => (prev === n.id ? null : n.id))}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#1A1A1A' }}>{n.template || 'Note libre'}</div>
                              <div style={{ color: '#6B6B6B', fontSize: 12, marginTop: 4 }}>{formatActivityDate(n.created_at)}</div>
                              {expandedNoteId === n.id && (
                                <div style={{ marginTop: 12, padding: 12, background: '#F8F5F1', borderRadius: 8, fontSize: 13, color: '#1A1A1A', whiteSpace: 'pre-wrap' }} onClick={(e) => e.stopPropagation()}>
                                  {n.content || '—'}
                                </div>
                              )}
                            </div>
                            <span style={{ flexShrink: 0, fontSize: 12, color: '#6B6B6B', transition: 'transform 0.2s', transform: expandedNoteId === n.id ? 'rotate(180deg)' : 'none' }}>▾</span>
                          </div>
                          {expandedNoteId === n.id && (
                            <div className="pipeline-note-actions" style={{ display: 'flex', gap: 6, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
                              <button type="button" onClick={() => { setEditingNoteId(n.id); setEditingNoteContent(n.content || ''); }} style={{ padding: '3px 10px', fontSize: 12, color: '#173731', background: 'transparent', border: '1px solid #E5E0D8', borderRadius: 6, cursor: 'pointer' }}>Éditer</button>
                              <button type="button" onClick={() => setConfirmDeleteNote({ id: n.id, content: n.content })} style={{ padding: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', display: 'inline-flex' }} title="Supprimer"><IconTrash /></button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : modalTab === 'activity' ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: 24, position: 'relative', paddingLeft: 28 }}>
                  <div style={{ position: 'absolute', left: 6, top: 0, bottom: 0, width: 1, background: '#E5E0D8' }} />
                  {activities.length === 0 ? (
                    <div style={{ color: '#6B6B6B', fontSize: 13 }}>Aucune activité</div>
                  ) : (
                    <>
                      {activities.map((a) => {
                        const typeLabel = a.activity_type === 'score_corrected' ? 'Score' : { stage_change: 'Stade', note_added: 'Note', maturity_change: 'Maturité', source_change: 'Source', region_change: 'Région', field_edit: 'Modification' }[a.type] || 'Activité'
                        const title = a.note || a.activity_type || a.old_value || a.new_value || '—'
                        return (
                          <div key={a.id} style={{ position: 'relative', marginBottom: 16 }}>
                            <div style={{ position: 'absolute', left: -22, top: 4, width: 10, height: 10, borderRadius: '50%', background: '#173731', border: '2px solid #fff' }} />
                            <div style={{ background: '#F9F7F4', borderRadius: 8, border: '0.5px solid #E5E0D8', padding: '10px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#EEF4FB', color: '#185FA5', border: '0.5px solid #B5D4F4', fontWeight: 500 }}>
                                    {typeLabel}
                                  </span>
                                  <span style={{ fontSize: 13, fontWeight: 500, color: '#0D1117' }}>{title}</span>
                                </div>
                                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{formatActivityDate(a.created_at)}</span>
                              </div>
                              <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                                Modifié par <span style={{ fontWeight: 500, color: '#0D1117' }}>{a.author || 'Baptiste PATERAC'}</span>
                              </p>
                            </div>
                          </div>
                        )
                      })}
                      <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 8 }}>Début de l'historique</p>
                    </>
                  )}
                </div>
              ) : modalTab === 'grille' ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                  <GrilleNotationTab profile={displayProfile} updateProfile={updateProfile} useSupabase={useSupabase} />
                </div>
              ) : modalTab === 'parcours' ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                  {(() => {
                    const exps = displayProfile.experiences || displayProfile.parsed_experiences || []
                    const BORDER_TERTIARY = '#E5E0D8'
                    const BG_SECONDARY = '#F9F7F4'
                    if (!Array.isArray(exps) || exps.length === 0) {
                      return <div style={{ fontSize: 13, color: '#6B6B6B', textAlign: 'center', padding: 24 }}>Aucun parcours disponible</div>
                    }
                    return (
                      <div style={{ position: 'relative', paddingLeft: 32 }}>
                        <div style={{ position: 'absolute', left: 9, top: 0, bottom: 0, width: 1, background: BORDER_TERTIARY }} />
                        {exps.map((exp, i) => {
                          const badge = getExperienceBadge(exp)
                          const isCurrent = exp.isCurrent
                          return (
                            <div key={i} style={{ position: 'relative', marginBottom: 16 }}>
                              <div style={{ position: 'absolute', left: -27, top: 14, width: 10, height: 10, borderRadius: '50%', background: isCurrent ? '#173731' : '#fff', border: isCurrent ? 'none' : `2px solid ${BORDER_TERTIARY}` }} />
                              <div
                                style={{
                                  background: isCurrent ? '#F0F5F0' : BG_SECONDARY,
                                  borderLeft: isCurrent ? '3px solid #173731' : 'none',
                                  border: isCurrent ? 'none' : `0.5px solid ${BORDER_TERTIARY}`,
                                  borderRadius: 8,
                                  padding: '12px 14px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1A1A1A' }}>{exp.company || '—'}</span>
                                  {isCurrent && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#173731', color: '#E7E0D0' }}>Actuel</span>}
                                </div>
                                <div style={{ fontSize: 12, color: '#6B6B6B', marginBottom: 8 }}>{exp.title || '—'}</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>{formatExperiencePeriod(exp)}</span>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {badge === 'cabinet' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#D4EDE1', color: '#1A7A4A', fontWeight: 500 }}>Cabinet CGP</span>}
                                    {badge === 'banque' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#EFF6FF', color: '#1D4ED8', fontWeight: 500 }}>Banque</span>}
                                    {badge === 'assurance' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#ECFDF5', color: '#065F46', fontWeight: 500 }}>Assurance</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    {!showEventForm && (
                      <button
                        type="button"
                        onClick={() => setShowEventForm(true)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          background: '#173731',
                          color: '#E7E0D0',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        + Nouvel événement
                      </button>
                    )}
                  </div>
                  {!showEventForm && events.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 }}>
                      <span style={{ width: 48, height: 48, display: 'flex', color: '#bbb' }}><IconDocument /></span>
                      <div style={{ fontSize: 12, color: '#bbb' }}>Cliquez sur + Nouvel événement pour commencer</div>
                    </div>
                  )}
                  {showEventForm && (
                    <div style={{ background: '#F8F5F1', padding: 16, borderRadius: 10, marginBottom: 16 }}>
                      <select value={evType} onChange={(e) => setEvType(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 12, borderRadius: 6, border: '1px solid #E5E0D8' }}>
                        {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 12, borderRadius: 6, border: '1px solid #E5E0D8' }} />
                      <textarea value={evDetail} onChange={(e) => setEvDetail(e.target.value)} placeholder="Décrivez le déroulé, les points clés, les prochaines étapes..." style={{ width: '100%', minHeight: 200, padding: 8, marginBottom: 12, borderRadius: 6, border: '1px solid #E5E0D8', resize: 'vertical' }} />
                      <button type="button" onClick={handleAddEvent} style={{ padding: '8px 16px', borderRadius: 8, background: '#D2AB76', color: '#173731', border: 'none', cursor: 'pointer', fontSize: 13 }}>Ajouter</button>
                    </div>
                  )}
                  {events.map((e) => (
                    <div
                      key={e.id}
                      className="pipeline-event-card"
                      style={{
                        background: 'white',
                        border: '1px solid #E5E0D8',
                        borderRadius: 10,
                        padding: 14,
                        marginBottom: 10,
                        transition: 'background 0.2s',
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(ev) => { if (expandedEventId !== e.id) ev.currentTarget.style.background = '#F8F5F1' }}
                      onMouseLeave={(ev) => { if (expandedEventId !== e.id) ev.currentTarget.style.background = 'white' }}
                    >
                      {editingEventId === e.id ? (
                        <div onClick={(ev) => ev.stopPropagation()}>
                          <select value={editingEventType} onChange={(ev) => setEditingEventType(ev.target.value)} style={{ width: '100%', padding: 8, marginBottom: 12, borderRadius: 6, border: '1px solid #E5E0D8' }}>
                            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <input type="date" value={editingEventDate} onChange={(ev) => setEditingEventDate(ev.target.value)} style={{ width: '100%', padding: 8, marginBottom: 12, borderRadius: 6, border: '1px solid #E5E0D8' }} />
                          <textarea value={editingEventDetail} onChange={(ev) => setEditingEventDetail(ev.target.value)} placeholder="Décrivez le déroulé, les points clés, les prochaines étapes..." style={{ width: '100%', minHeight: 200, padding: 8, marginBottom: 12, borderRadius: 6, border: '1px solid #E5E0D8', resize: 'vertical' }} />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" onClick={handleSaveEventEdit} style={{ padding: '8px 16px', borderRadius: 8, background: '#D2AB76', color: '#173731', border: 'none', cursor: 'pointer', fontSize: 13 }}>Enregistrer</button>
                            <button type="button" onClick={() => { setEditingEventId(null); setEditingEventType('R0'); setEditingEventDate(''); setEditingEventDetail(''); setExpandedEventId(null); }} style={{ padding: '8px 16px', borderRadius: 8, background: '#E5E0D8', color: '#6B6B6B', border: 'none', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}
                            onClick={() => setExpandedEventId((prev) => (prev === e.id ? null : e.id))}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{(e.content || '').split(' — ')[0] || 'Événement'}</div>
                              <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 4 }}>{e.date ? new Date(e.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : (e.created_at ? new Date(e.created_at).toLocaleDateString('fr-FR') : '')}</div>
                              {expandedEventId === e.id && (
                                <div style={{ marginTop: 12, padding: 12, background: '#F8F5F1', borderRadius: 8, fontSize: 13, color: '#1A1A1A', whiteSpace: 'pre-wrap' }} onClick={(ev) => ev.stopPropagation()}>
                                  {e.content || '—'}
                                </div>
                              )}
                            </div>
                            <span style={{ flexShrink: 0, fontSize: 12, color: '#6B6B6B', transition: 'transform 0.2s', transform: expandedEventId === e.id ? 'rotate(180deg)' : 'none' }}>▾</span>
                          </div>
                          {expandedEventId === e.id && (
                            <div className="pipeline-event-actions" style={{ display: 'flex', gap: 6, marginTop: 12 }} onClick={(ev) => ev.stopPropagation()}>
                              <button type="button" onClick={() => startEditEvent(e)} style={{ padding: '3px 10px', fontSize: 12, color: '#173731', background: 'transparent', border: '1px solid #E5E0D8', borderRadius: 6, cursor: 'pointer' }}>Éditer</button>
                              <button type="button" onClick={() => setConfirmDeleteEvent({ id: e.id })} style={{ padding: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', display: 'inline-flex' }} title="Supprimer"><IconTrash /></button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modales de confirmation suppression */}
      {scoreCorrectionOpen && displayProfile && (
        <ScoreCorrectionModal
          profile={displayProfile}
          onClose={() => setScoreCorrectionOpen(false)}
          onSaved={async ({ correctedScore }) => {
            updateProfile(displayProfile.id, { sc: correctedScore })
            setModalProfile({ ...displayProfile, sc: correctedScore })
            showNotif('Score corrigé ✓')
          }}
          useSupabase={useSupabase}
        />
      )}

      {confirmDeleteNote && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setConfirmDeleteNote(null)}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: 320 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>Supprimer cette note ?</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConfirmDeleteNote(null)} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#6B6B6B' }}>Annuler</button>
              <button type="button" onClick={() => handleDeleteNote(confirmDeleteNote.id, confirmDeleteNote.content)} style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: '#DC2626', color: 'white', cursor: 'pointer' }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
      {pendingStageChange && pendingStageChange.newStage !== 'Recruté' && (() => {
        const TIME_SLOTS = Array.from({ length: 19 }, (_, i) => {
          const h = 9 + Math.floor(i / 2)
          const m = (i % 2) * 30
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        })
        const RDV_TYPES = ['Google Meet', 'Téléphone', 'Présentiel']
        const { profile, newStage } = pendingStageChange
        const currentStage = profile.stg || 'R0'
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPendingStageChange(null)}>
            <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: 380, maxWidth: 440, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ background: '#173731', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: '#D2AB76', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(210,171,118,0.5)' }}>Pipeline</span>
                </div>
                <div style={{ fontFamily: 'Palatino, "Palatino Linotype", "Book Antiqua", serif', fontSize: 18, fontWeight: 600, color: '#E7E0D0' }}>Passage en {newStage}</div>
                <div style={{ fontSize: 13, color: 'rgba(231,224,208,0.9)', marginTop: 4 }}>{profile.fn} {profile.ln} · {profile.co || '—'}</div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E5E0D8', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                    <span style={{ fontSize: 10, fontWeight: 500, color: '#666', textAlign: 'center', maxWidth: 70 }}>{currentStage === "Point d'étape téléphonique" ? "Point d'étape" : currentStage}</span>
                  </div>
                  <div style={{ flex: 1, height: 2, background: '#E5E0D8' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#D2AB76', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                    <span style={{ fontSize: 10, fontWeight: 500, color: '#D2AB76', textAlign: 'center', maxWidth: 70 }}>{newStage === "Point d'étape téléphonique" ? "Point d'étape" : newStage}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>Date</label>
                    <input
                      type="date"
                      value={stageChangeDate}
                      onChange={(e) => setStageChangeDate(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6 }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>Heure</label>
                    <select
                      value={stageChangeTime}
                      onChange={(e) => setStageChangeTime(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, background: 'white' }}
                    >
                      <option value="">—</option>
                      {TIME_SLOTS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>Type de RDV</label>
                  <select
                    value={stageChangeRdType}
                    onChange={(e) => setStageChangeRdType(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, background: 'white' }}
                  >
                    {RDV_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>Notes (optionnel)</label>
                  <textarea
                    value={stageChangeNotes}
                    onChange={(e) => setStageChangeNotes(e.target.value)}
                    placeholder="Notes…"
                    rows={3}
                    style={{ width: '100%', padding: 10, fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, resize: 'vertical' }}
                  />
                </div>
                {(newStage === 'Point Business Plan' || newStage === 'Démission reconversion') && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#444' }}>
                      <input type="checkbox" checked={stageChangeSkipStep} onChange={(e) => setStageChangeSkipStep(e.target.checked)} style={{ width: 16, height: 16 }} />
                      <span>Cette étape ne s&apos;applique pas à ce profil</span>
                    </label>
                  </div>
                )}
                {INTEG_MODAL_STAGES.includes(newStage) && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: '#666', display: 'block', marginBottom: 4 }}>Session de formation (optionnel)</label>
                    <select
                      value={pendingSessionId}
                      onChange={(e) => setPendingSessionId(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, background: 'white' }}
                    >
                      <option value="">— Pas encore défini</option>
                      {pendingSessions.map((s) => (
                        <option key={s.id} value={s.id}>{formatSessionLabel(s)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <button type="button" onClick={() => setPendingStageChange(null)} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#6B6B6B' }}>Annuler</button>
                  <button type="button" onClick={handleSkipStageChangeDate} style={{ padding: '6px 12px', fontSize: 12, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}>Sans date</button>
                  <button type="button" onClick={handleConfirmStageChange} disabled={!stageChangeDate.trim() || !stageChangeTime} style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: '#173731', color: '#E7E0D0', cursor: 'pointer', opacity: (stageChangeDate.trim() && stageChangeTime) ? 1 : 0.5 }}>Confirmer →</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {confirmDeleteEvent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setConfirmDeleteEvent(null)}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: 320 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>Supprimer cet événement ?</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConfirmDeleteEvent(null)} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#6B6B6B' }}>Annuler</button>
              <button type="button" onClick={() => handleDeleteEvent(confirmDeleteEvent.id)} style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: '#DC2626', color: 'white', cursor: 'pointer' }}>Confirmer</button>
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
              if (modalProfile?.id === chuteModalProfile.id) {
                setModalProfile(null)
                setSelectedCardId(null)
              }
              fetchProfiles()
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
              if (modalProfile?.id === pasInteresseModalProfile.id) {
                setModalProfile(null)
                setSelectedCardId(null)
              }
              fetchProfiles()
            }}
          />
        </div>
      )}
      {showSessionModal && profileToAssign && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setShowSessionModal(false); setProfileToAssign(null); setShowCreateSession(false); setNewSession({ date_session: '', lieu: '', places_total: 6, statut: 'planifiée', notes: '' }); }}>
          <div style={{ background: '#F5F0E8', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: 400, maxWidth: 480, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: ACCENT, padding: '20px 24px' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, color: 'white' }}>Félicitations ! {[profileToAssign?.fn || profileToAssign?.first_name, profileToAssign?.ln || profileToAssign?.last_name].filter(Boolean).join(' ') || '—'} est recruté</div>
              <div style={{ fontSize: 14, color: GOLD, marginTop: 4 }}>Assignez ce profil à une session de formation</div>
            </div>
            <div style={{ padding: 24 }}>
              {showCreateSession ? (
                <div>
                  {sessions.length > 0 && <button type="button" onClick={() => setShowCreateSession(false)} style={{ marginBottom: 16, padding: 0, background: 'none', border: 'none', fontSize: 12, color: '#666', cursor: 'pointer', textDecoration: 'underline' }}>Retour à la liste des sessions</button>}
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: ACCENT }}>Créer une nouvelle session</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div><label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>Date</label><input type="date" value={newSession.date_session} onChange={(e) => setNewSession((s) => ({ ...s, date_session: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6 }} /></div>
                    <div><label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>Lieu</label><input type="text" value={newSession.lieu} onChange={(e) => setNewSession((s) => ({ ...s, lieu: e.target.value }))} placeholder="Lieu" style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6 }} /></div>
                    <div><label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>Nombre de places</label><input type="number" value={newSession.places_total} onChange={(e) => setNewSession((s) => ({ ...s, places_total: parseInt(e.target.value, 10) || 6 }))} min={1} style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6 }} /></div>
                    <div><label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>Statut</label><select value={newSession.statut} onChange={(e) => setNewSession((s) => ({ ...s, statut: e.target.value }))} style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6 }}><option value="planifiée">Planifiée</option><option value="confirmée">Confirmée</option></select></div>
                    <div><label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>Notes (optionnel)</label><textarea value={newSession.notes} onChange={(e) => setNewSession((s) => ({ ...s, notes: e.target.value }))} rows={2} style={{ width: '100%', padding: 8, fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, resize: 'vertical' }} /></div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 13, color: '#444', marginBottom: 12 }}>Assigner à une session de formation</div>
                  <select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, marginBottom: 12 }} disabled={sessionsLoading}>
                    <option value="">Sélectionner une session</option>
                    {sessionsWithCount.map((s) => <option key={s.id} value={s.id}>{[s.periode, s.annee].filter(Boolean).join(' ') || formatSessionDate(s.date_session)} · {s.lieu || '—'} · {s.inscrits}/{s.places_total || 6} inscrits</option>)}
                  </select>
                    <button type="button" onClick={() => setShowCreateSession(true)} style={{ marginBottom: 16, padding: 0, background: 'none', border: 'none', fontSize: 13, color: ACCENT, cursor: 'pointer', textDecoration: 'underline' }}>Créer une nouvelle session</button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 20, paddingTop: 16, paddingLeft: 24, paddingRight: 24, paddingBottom: 24, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              {showCreateSession ? (
                <button type="button" onClick={async () => { if (!newSession.date_session || !profileToAssign?.id) return; const { data: newSess } = await supabase.from('sessions_formation').insert({ date_session: newSession.date_session, lieu: newSession.lieu || null, places_total: newSession.places_total, statut: newSession.statut, notes: newSession.notes || null }).select().single(); if (newSess?.id) { await supabase.from('profiles').update({ session_formation_id: newSess.id, integration_confirmed: true }).eq('id', profileToAssign.id); setShowSessionModal(false); setProfileToAssign(null); setShowCreateSession(false); setNewSession({ date_session: '', lieu: '', places_total: 6, statut: 'planifiée', notes: '' }); fetchProfiles(); window.dispatchEvent(new CustomEvent('evolve:session-updated')); } }} disabled={!newSession.date_session} style={{ padding: '10px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: ACCENT, color: 'white', cursor: 'pointer', opacity: newSession.date_session ? 1 : 0.6 }}>Créer et assigner</button>
              ) : (
                <button type="button" onClick={async () => { if (!selectedSession || !profileToAssign?.id) return; await supabase.from('profiles').update({ session_formation_id: selectedSession, integration_confirmed: true }).eq('id', profileToAssign.id); setShowSessionModal(false); setProfileToAssign(null); fetchProfiles(); window.dispatchEvent(new CustomEvent('evolve:session-updated')); }} disabled={!selectedSession} style={{ padding: '10px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: ACCENT, color: 'white', cursor: 'pointer', opacity: selectedSession ? 1 : 0.6 }}>Assigner à cette session</button>
              )}
              <button type="button" onClick={() => { setShowSessionModal(false); setProfileToAssign(null); setShowCreateSession(false); fetchProfiles(); }} style={{ padding: '10px 16px', fontSize: 13, border: `1px solid ${ACCENT}`, borderRadius: 6, background: 'transparent', color: ACCENT, cursor: 'pointer' }}>Passer sans assigner</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .kanban-card:not(.selected):hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .score-row:hover .score-inexact-btn { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
