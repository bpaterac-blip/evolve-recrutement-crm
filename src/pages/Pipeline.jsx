import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCRM } from '../context/CRMContext'
import { enrichProfileWithNetrows } from '../lib/netrows'
import { scoreProfile, getExperienceBadge } from '../lib/scoring'
import {
  STAGES,
  STAGE_COLORS,
  MATURITIES,
  MATURITY_COLORS,
  NOTE_TEMPLATES,
  EVENT_TYPES,
  SOURCES,
  REGIONS,
  INTEG_OPTS,
  INTEG_ADD_DATE,
} from '../lib/data'
import InlineDropdown from '../components/InlineDropdown'
import ScoreCorrectionModal from '../components/ScoreCorrectionModal'
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

const IconLinkedIn = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>

function formatActivityDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
}

function capFirst(str) {
  if (!str || typeof str !== 'string') return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

const ICON_SM = { width: 13, height: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#1A1A1A' }

function KanbanCard({ profile, stage, onClick, isSelected }) {
  const matColor = MATURITY_COLORS[profile.mat] || { bg: '#F3F4F6', text: '#6B7280' }

  const handleClick = () => onClick(profile)

  return (
    <div
      className="kanban-card"
      draggable={true}
      onDragStart={(e) => e.dataTransfer.setData('profileId', String(profile.id))}
      onClick={handleClick}
      style={{
        background: 'white',
        borderRadius: 10,
        padding: 16,
        marginBottom: 8,
        cursor: 'grab',
        borderLeft: `3px solid ${matColor.text}`,
        boxShadow: isSelected ? '0 0 0 2px #173731' : '0 1px 3px rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.15s',
        width: '100%',
      }}
    >
      {/* LIGNE 1 - Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#173731',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {(profile.fn?.[0] || '') + (profile.ln?.[0] || '')}
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, minWidth: 0, color: '#1A1A1A' }}>{profile.fn} {profile.ln}</div>
      </div>

      {/* LIGNE 2 - Employeur */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={ICON_SM}><IconBuilding /></span>
        <span style={{ fontSize: 13, color: '#1A1A1A' }}>{profile.co || '—'}</span>
      </div>

      {/* LIGNE 3 - Ville */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={ICON_SM}><IconMapPin /></span>
        <span style={{ fontSize: 12, color: '#1A1A1A' }}>{profile.city || '—'}</span>
      </div>

      {/* LIGNE 4 - Région */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={ICON_SM}><IconMap /></span>
        <span style={{ fontSize: 12, color: '#1A1A1A' }}>{profile.region || '—'}</span>
      </div>

      {/* LIGNE 5 - Badge Source */}
      {profile.src && (
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#F3F4F6', color: '#1A1A1A' }}>
            {profile.src}
          </span>
        </div>
      )}

      {/* LIGNE 6 - Badge Maturité */}
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: matColor.bg, color: matColor.text }}>
          {profile.mat}
        </span>
      </div>

      {/* LIGNE 7 - Intégration potentielle */}
      {profile.integ && profile.integ !== '—' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={ICON_SM}><IconCalendar /></span>
          <span style={{ fontSize: 12, color: '#1A1A1A' }}>{profile.integ}</span>
        </div>
      )}

      {/* LIGNE 8 - Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: profile.integ && profile.integ !== '—' ? 0 : 2 }}>
        <span style={{ fontSize: 11, color: '#1A1A1A' }}>
          {profile.created_at
            ? new Date(profile.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
            : profile.dt || ''}
        </span>
        {stage !== 'Recruté' ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation() }}
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 6,
              border: '1px solid #E5E0D8',
              background: 'transparent',
              cursor: 'pointer',
              color: '#1A1A1A',
            }}
          >
            + RDV
          </button>
        ) : (
          <span style={{ fontSize: 10, color: '#1A1A1A' }}>Intégré ✓</span>
        )}
      </div>
    </div>
  )
}

function DroppableColumn({ stage, cards, onCardClick, selectedCardId, onDrop }) {
  const c = STAGE_COLORS[stage] || {}

  return (
    <div
      className="kcol w-[215px] shrink-0 flex flex-col gap-1.5"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const profileId = e.dataTransfer.getData('profileId')
        if (profileId) onDrop(profileId, stage)
      }}
    >
      <div className="kch flex items-center justify-between py-2 px-3 rounded-lg text-xs font-semibold" style={{ background: c.bg, color: c.text }}>
        <span>{stage}</span>
        <span className="bg-white/60 py-0.5 px-1.5 rounded-[10px] text-[11px]">{cards.length}</span>
      </div>
      <div className="flex flex-col gap-1.5 min-h-[80px]">
        {cards.map((p) => (
          <KanbanCard key={p.id} profile={p} stage={stage} onClick={onCardClick} isSelected={p.id === selectedCardId} />
        ))}
      </div>
    </div>
  )
}

const NOTE_TEMPLATE_OPTS = ['Note libre', 'Récapitulatif R0', 'Récapitulatif R1', "Récapitulatif Point d'étape"]

export default function Pipeline() {
  const navigate = useNavigate()
  const { filteredProfiles, changeStage, changeMaturity, changeInteg, changeSource, changeRegion, updateProfileField, updateProfile, showNotif, useSupabase } = useCRM()
  const pipeline = filteredProfiles.filter((p) => p.stg && p.stg !== 'Recruté' && p.mat !== 'Archivé')
  const all = filteredProfiles.filter((p) => p.stg && p.mat !== 'Archivé')
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
  const [integCustomMode, setIntegCustomMode] = useState(false)
  const [expandedNoteId, setExpandedNoteId] = useState(null)
  const [expandedEventId, setExpandedEventId] = useState(null)
  const [enriching, setEnriching] = useState(false)
  const [scoreCorrectionOpen, setScoreCorrectionOpen] = useState(false)

  const displayProfile = modalProfile ? (filteredProfiles.find((p) => p.id === modalProfile.id) || modalProfile) : null

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

  const handleEnrichNetrows = async () => {
    if (!displayProfile?.li) return
    setEnriching(true)
    try {
      const result = await enrichProfileWithNetrows(displayProfile.li)
      const { score } = scoreProfile(displayProfile, result.experiences)
      updateProfile(displayProfile.id, { experiences: result.experiences, sc: score })
      if (useSupabase) {
        await supabase.from('profiles').update({ experiences: result.experiences, score }).eq('id', displayProfile.id)
      }
      showNotif('Profil enrichi ✓')
    } catch (err) {
      showNotif(`Erreur Netrows : ${err?.message}`)
    } finally {
      setEnriching(false)
    }
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
    setNoteContent(NOTE_TEMPLATES[noteTemplate] ?? '')
  }, [noteTemplate])

  useEffect(() => {
    if (!modalProfile) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (editingField) { setEditingField(null); setEditValue(''); setIntegCustomMode(false) }
        else { setModalProfile(null); setSelectedCardId(null) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalProfile, editingField])

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
      author: 'Baptiste',
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
  }

  const handleChangeMaturity = async (v) => {
    if (!displayProfile?.id || !modalProfile?.id) return
    const oldValue = displayProfile.mat ?? '—'
    if (oldValue === v) return
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
    const oldStage = profile.stg ?? '—'
    changeStage(profileId, newStage)
    await supabase.from('profiles').update({ stage: newStage }).eq('id', profile.id)
    await supabase.from('activities').insert({
      profile_id: profile.id,
      type: 'stage_change',
      note: `${oldStage} → ${newStage}`,
      date: new Date().toISOString().split('T')[0],
      icon: 'refresh',
      source: 'manual',
    })
  }

  const matColor = (m) => MATURITY_COLORS[m] || { bg: '#F3F4F6', text: '#6B7280' }
  const stageColor = (s) => STAGE_COLORS[s] || { bg: '#F3F4F6', text: '#6B7280' }
  const stag = (s) => ({ background: stageColor(s).bg, color: stageColor(s).text })
  const matStyle = (m) => ({ background: matColor(m).bg, color: matColor(m).text })

  const startEditField = (field, currentVal) => {
    setEditingField(field)
    const val = currentVal ?? ''
    setEditValue(val)
    setIntegCustomMode(field === 'integration_date' && val && !INTEG_OPTS.includes(val))
  }

  const handleSaveFieldEdit = async () => {
    if (!editingField || !displayProfile?.id) return
    const field = editingField
    const newVal = field === 'region' || field === 'source' || field === 'integration_date' ? editValue : editValue.trim()
    const profileField = field === 'source' ? 'src' : field === 'integration_date' ? 'integ' : field
    const oldVal = displayProfile[profileField] ?? '—'

    if (String(oldVal) === String(newVal)) {
      setEditingField(null)
      setEditValue('')
      return
    }

    if (field === 'region') changeRegion(displayProfile.id, newVal)
    else if (field === 'source') changeSource(displayProfile.id, newVal)
    else if (field === 'integration_date') changeInteg(displayProfile.id, newVal || '—')
    else updateProfileField(displayProfile.id, profileField, newVal)

    setEditingField(null)
    setEditValue('')
    setIntegCustomMode(false)
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
          {STAGES.map((st) => {
            const cards = all.filter((p) => p.stg === st)
            return (
              <DroppableColumn
                key={st}
                stage={st}
                cards={cards}
                onCardClick={(p) => {
                  console.log('Clic carte', p.id)
                  setModalProfile(p)
                  setSelectedCardId(p.id)
                }}
                selectedCardId={selectedCardId}
                onDrop={handleDrop}
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
            <button
              type="button"
              onClick={() => { setModalProfile(null); setSelectedCardId(null) }}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                fontSize: 20,
                cursor: 'pointer',
                zIndex: 10,
                background: 'none',
                border: 'none',
              }}
            >
              <IconClose />
            </button>

            {/* COLONNE GAUCHE */}
            <div
              style={{
                width: 320,
                flexShrink: 0,
                background: '#F5F3EF',
                padding: 24,
                borderRight: '1px solid #E5E0D8',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  background: '#173731',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 600,
                }}
              >
                {(displayProfile.fn?.[0] || '') + (displayProfile.ln?.[0] || '')}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '12px 0 4px', color: '#1A1A1A' }}>
                {capFirst(displayProfile.fn)} {capFirst(displayProfile.ln)}
              </h2>
              <p style={{ fontSize: 13, color: '#6B6B6B', margin: 0 }}>{displayProfile.co} · {displayProfile.ti}</p>
              <p style={{ fontSize: 12, color: '#6B6B6B', margin: '4px 0 16px' }}>
                {displayProfile.city}{displayProfile.region ? ` · ${displayProfile.region}` : ''}
              </p>
              <div style={{ height: 1, background: '#E5E0D8', marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <InlineDropdown options={MATURITIES} value={displayProfile.mat} onChange={handleChangeMaturity} buttonStyle={matStyle} buttonClassName="tag tag-btn px-2 py-0.5 rounded-md text-xs" />
                <InlineDropdown options={STAGES} value={displayProfile.stg} onChange={handleChangeStage} buttonStyle={stag} buttonClassName="tag tag-btn px-2 py-0.5 rounded-md text-xs" placeholder="—" />
              </div>
              <div style={{ height: 1, background: '#E5E0D8', marginBottom: 16 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: '#6B6B6B', fontSize: 13 }}>
                {/* Email */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#6B6B6B', flexShrink: 0 }}><IconEnvelope /></span>
                  {editingField === 'mail' ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0 }}>
                      <input type="email" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveFieldEdit()} autoFocus style={{ flex: 1, padding: '4px 8px', fontSize: 13, border: '2px solid #173731', borderRadius: 6, outline: 'none' }} />
                      <button type="button" onClick={handleSaveFieldEdit} style={{ padding: '4px 10px', background: '#173731', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✓</button>
                    </div>
                  ) : (
                    <span onClick={() => startEditField('mail', displayProfile.mail)} style={{ color: '#173731', textDecoration: 'underline', cursor: 'pointer' }}>{displayProfile.mail || '—'}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#6B6B6B', flexShrink: 0 }}><IconLink /></span>
                  <a href={displayProfile.li?.startsWith('http') ? displayProfile.li : `https://${displayProfile.li}`} target="_blank" rel="noopener noreferrer" style={{ color: '#173731', textDecoration: 'underline' }}>{displayProfile.li || '—'}</a>
                </div>
                {/* Ville */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#6B6B6B', flexShrink: 0, width: 14, height: 14, display: 'flex' }}><IconMapPin /></span>
                  {editingField === 'city' ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0 }}>
                      <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveFieldEdit()} autoFocus style={{ flex: 1, padding: '4px 8px', fontSize: 13, border: '2px solid #173731', borderRadius: 6, outline: 'none' }} />
                      <button type="button" onClick={handleSaveFieldEdit} style={{ padding: '4px 10px', background: '#173731', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✓</button>
                    </div>
                  ) : (
                    <span onClick={() => startEditField('city', displayProfile.city)} style={{ cursor: 'pointer' }}>{displayProfile.city || '—'}</span>
                  )}
                </div>
                {/* Région */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#6B6B6B', flexShrink: 0, width: 14, height: 14, display: 'flex' }}><IconMap /></span>
                  {editingField === 'region' ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0 }}>
                      <select value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus style={{ flex: 1, padding: '4px 8px', fontSize: 13, border: '2px solid #173731', borderRadius: 6, outline: 'none' }}>
                        <option value="">—</option>
                        {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button type="button" onClick={handleSaveFieldEdit} style={{ padding: '4px 10px', background: '#173731', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✓</button>
                    </div>
                  ) : (
                    <span onClick={() => startEditField('region', displayProfile.region)} style={{ cursor: 'pointer' }}>{displayProfile.region || '—'}</span>
                  )}
                </div>
                {/* Source */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#6B6B6B', flexShrink: 0 }}><IconTag /></span>
                  {editingField === 'source' ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0 }}>
                      <select value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus style={{ flex: 1, padding: '4px 8px', fontSize: 13, border: '2px solid #173731', borderRadius: 6, outline: 'none' }}>
                        {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button type="button" onClick={handleSaveFieldEdit} style={{ padding: '4px 10px', background: '#173731', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✓</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                      <span onClick={() => startEditField('source', displayProfile.src)} style={{ cursor: 'pointer' }}>{displayProfile.src || '—'}</span>
                      {displayProfile.sequence_lemlist && (
                        <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: '#FFF7ED', color: '#F97316', fontWeight: 500 }}>Lemlist : {displayProfile.sequence_lemlist}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="score-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#6B6B6B', flexShrink: 0 }}><IconStar /></span>
                  <span style={{ fontWeight: 600 }}>{displayProfile.sc ?? '—'}</span>
                  <button
                    type="button"
                    onClick={() => setScoreCorrectionOpen(true)}
                    className="score-inexact-btn"
                    style={{ fontSize: 12, color: '#F97316', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s', padding: '0 4px' }}
                    title="Signaler un score inexact"
                  >
                    ⚠ Score inexact
                  </button>
                </div>
                {/* Intégration potentielle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#6B6B6B', flexShrink: 0 }}><IconCalendar /></span>
                  {editingField === 'integration_date' ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0, flexDirection: 'column' }}>
                      {integCustomMode ? (
                        <>
                          <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="ex: Mars 2027" autoFocus style={{ padding: '4px 8px', fontSize: 13, border: '2px solid #173731', borderRadius: 6, outline: 'none' }} />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" onClick={() => { if (editValue.trim()) handleSaveFieldEdit(); }} style={{ padding: '4px 10px', background: '#173731', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✓</button>
                            <button type="button" onClick={() => { setIntegCustomMode(false); setEditValue(displayProfile.integ || ''); }} style={{ padding: '4px 10px', background: 'none', border: '1px solid #E5E0D8', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Annuler</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <select value={editValue} onChange={(e) => { const v = e.target.value; if (v === INTEG_ADD_DATE) { setIntegCustomMode(true); setEditValue(''); } else setEditValue(v); }} autoFocus style={{ flex: 1, padding: '4px 8px', fontSize: 13, border: '2px solid #173731', borderRadius: 6, outline: 'none' }}>
                            {INTEG_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                            <option value={INTEG_ADD_DATE}>{INTEG_ADD_DATE}</option>
                          </select>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" onClick={handleSaveFieldEdit} style={{ padding: '4px 10px', background: '#173731', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✓</button>
                            <button type="button" onClick={() => { setEditingField(null); setEditValue(''); setIntegCustomMode(false); }} style={{ padding: '4px 10px', background: 'none', border: '1px solid #E5E0D8', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Annuler</button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <span onClick={() => startEditField('integration_date', displayProfile.integ)} style={{ cursor: 'pointer' }}>{displayProfile.integ || '—'}</span>
                  )}
                </div>
              </div>
              {displayProfile.li && (
                <div style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={handleEnrichNetrows}
                    disabled={enriching}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      background: '#fff',
                      border: '1px solid #173731',
                      borderRadius: 8,
                      color: '#173731',
                      fontSize: 13,
                      cursor: enriching ? 'not-allowed' : 'pointer',
                      opacity: enriching ? 0.7 : 1,
                      width: '100%',
                      justifyContent: 'center',
                    }}
                  >
                    <IconLinkedIn />
                    {enriching ? 'Enrichissement…' : 'Enrichir via Netrows'}
                  </button>
                </div>
              )}
              {Array.isArray(displayProfile.experiences) && displayProfile.experiences.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B6B6B', marginBottom: 10 }}>Parcours professionnel</div>
                  <div style={{ position: 'relative', paddingLeft: 16 }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: '#173731', borderRadius: 1 }} />
                    {displayProfile.experiences.map((exp, i) => {
                      const badge = getExperienceBadge(exp)
                      return (
                        <div key={i} style={{ position: 'relative', paddingBottom: 14 }}>
                          <div style={{ position: 'absolute', left: -20, top: 4, width: 8, height: 8, borderRadius: '50%', background: '#fff', border: '2px solid #173731' }} />
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#1A1A1A' }}>{exp.company || '—'}</div>
                          <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 2 }}>{exp.title || '—'}</div>
                          <div style={{ fontSize: 11, color: '#6B6B6B', marginTop: 2 }}>{formatExperiencePeriod(exp)}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            {badge === 'cabinet' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#D4EDE1', color: '#1A7A4A', fontWeight: 500 }}>Cabinet CGP</span>}
                            {badge === 'captif' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#FDE8E8', color: '#c0392b', fontWeight: 500 }}>Captif</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div style={{ flex: 1, minHeight: 24 }} />
              <button
                type="button"
                onClick={() => { setModalProfile(null); navigate(`/profiles/${displayProfile.id}`) }}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 8,
                  background: '#173731',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Ouvrir la fiche complète →
              </button>
            </div>

            {/* COLONNE DROITE */}
            <div style={{ flex: 1, minHeight: 0, background: 'white', padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: 24, marginBottom: 20, borderBottom: '1px solid #E5E0D8' }}>
                {['notes', 'events', 'activity'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setModalTab(tab)}
                    style={{
                      padding: '8px 0',
                      fontSize: 14,
                      fontWeight: 500,
                      background: 'none',
                      border: 'none',
                      borderBottom: modalTab === tab ? '2px solid #173731' : '2px solid transparent',
                      color: modalTab === tab ? '#173731' : '#6B6B6B',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {tab === 'notes' ? 'Notes' : tab === 'events' ? 'Événements' : 'Activité'}
                  </button>
                ))}
              </div>

              {loadingDetail ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#6B6B6B' }}>Chargement...</div>
              ) : modalTab === 'notes' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    {!showNoteForm && (
                      <button
                        type="button"
                        onClick={() => setShowNoteForm(true)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          background: '#D2AB76',
                          color: '#173731',
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
                <div style={{ position: 'relative', paddingLeft: 24 }}>
                  <div style={{ position: 'absolute', left: 5, top: 0, bottom: 0, width: 2, background: '#173731' }} />
                  {activities.length === 0 ? (
                    <div style={{ color: '#6B6B6B', fontSize: 13 }}>Aucune activité</div>
                  ) : (
                    activities.map((a) => (
                      <div key={a.id} style={{ position: 'relative', marginBottom: 16, paddingLeft: 16 }}>
                        <div style={{ position: 'absolute', left: -19, top: 2, width: 10, height: 10, borderRadius: '50%', background: '#173731' }} />
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ color: '#6B6B6B', flexShrink: 0, marginTop: 1 }}><IconActivity /></span>
                          <div>
                            <div style={{ fontSize: 13, color: '#1A1A1A' }}>{a.note || a.activity_type || a.old_value || a.new_value || '—'}</div>
                            <div style={{ fontSize: 11, color: '#6B6B6B', marginTop: 2 }}>{formatActivityDate(a.created_at)}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    {!showEventForm && (
                      <button
                        type="button"
                        onClick={() => setShowEventForm(true)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          background: '#D2AB76',
                          color: '#173731',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        + Événement
                      </button>
                    )}
                  </div>
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

      <style>{`
        .kanban-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12) !important; }
        .score-row:hover .score-inexact-btn { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
