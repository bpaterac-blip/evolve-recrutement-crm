import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useViewMode } from './ViewModeContext'
import { calculateScore } from '../lib/scoring'
import { loadScoringConfig } from '../lib/scoringConfig'
import { INITIAL_PROFILES } from '../lib/data'

const CRMContext = createContext(null)
const PROFILES_TABLE = 'profiles'
const NOTES_TABLE = 'notes'
const EVENTS_TABLE = 'events'
const ACTIVITIES_TABLE = 'activities'
const SCORING_FEEDBACK_TABLE = 'scoring_feedback'

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || ''
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  return Boolean(url && key)
}

function mapRowToProfile(row) {
  if (!row) return null
  const exps = row.experiences
  const experiences = Array.isArray(exps) ? exps : (typeof exps === 'string' ? (() => { try { return JSON.parse(exps) || [] } catch { return [] } })() : [])
  return {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    fn: row.first_name ?? '',
    ln: row.last_name ?? '',
    co: row.company ?? '—',
    ti: row.title ?? '—',
    city: row.city ?? '—',
    region: row.region ?? '',
    src: row.source ?? 'Chasse LinkedIn',
    sc: row.score ?? 0,
    stg: row.stage ?? null,
    mat: row.maturity ?? 'Froid',
    integ: row.integration_date ?? '—',
    dt: row.created_at ? new Date(row.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '',
    mail: row.email ?? '—',
    li: row.linkedin_url ?? '—',
    experiences,
    dur: '',
    notes: '',
    acts: [],
    sequence_lemlist: row.sequence_lemlist ?? '',
    lead_status: row.lead_status ?? '',
    session_formation_id: row.session_formation_id ?? null,
    owner_id: row.owner_id ?? null,
    owner_email: row.owner_email ?? null,
    owner_full_name: row.owner_full_name ?? null,
    next_event_date: row.next_event_date ?? null,
    next_event_label: row.next_event_label ?? null,
  }
}

function mapProfileToRow(profile) {
  const exps = profile.experiences
  const experiences = Array.isArray(exps) ? exps : []
  const row = {
    first_name: profile.fn ?? '',
    last_name: profile.ln ?? '',
    company: profile.co ?? '—',
    title: profile.ti ?? '—',
    city: profile.city ?? '—',
    region: profile.region ?? '',
    email: profile.mail ?? '—',
    linkedin_url: profile.li ?? '—',
    source: profile.src ?? 'Chasse LinkedIn',
    score: profile.sc ?? 0,
    stage: profile.stg ?? null,
    maturity: profile.mat ?? 'Froid',
    sequence_lemlist: profile.sequence_lemlist ?? '',
    integration_date: profile.integ ?? '—',
    lead_status: profile.lead_status ?? '',
    next_event_date: profile.next_event_date ?? null,
    next_event_label: profile.next_event_label ?? null,
  }
  if (experiences.length) row.experiences = experiences
  return row
}

export function CRMProvider({ children }) {
  const { user, userProfile, role } = useAuth()
  const { viewMode } = useViewMode()
  const [profiles, setProfiles] = useState([])
  const [profileNotes, setProfileNotes] = useState({})
  const [profileActivities, setProfileActivities] = useState({})
  const [notif, setNotif] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [useSupabase] = useState(isSupabaseConfigured())

  const today = useCallback(() => {
    const d = new Date()
    return `${d.getDate()} ${['jan', 'fév', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'][d.getMonth()]}`
  }, [])

  const showNotif = useCallback((msg) => {
    setNotif(msg)
    setTimeout(() => setNotif(null), 3200)
  }, [])

  const fetchProfiles = useCallback(async () => {
    if (!useSupabase) {
      setProfiles(INITIAL_PROFILES)
      setLoading(false)
      return
    }
    try {
      let query = supabase.from(PROFILES_TABLE).select('*').order('created_at', { ascending: false })
      if (role === 'admin' && viewMode === 'personal' && user?.id) {
        query = query.eq('owner_id', user.id)
      }
      const { data, error } = await query
      if (error) throw error
      setProfiles((data || []).map(mapRowToProfile))
    } catch (err) {
      console.error('[Supabase] Erreur fetch profiles:', err)
      setProfiles(INITIAL_PROFILES)
    } finally {
      setLoading(false)
    }
  }, [useSupabase, role, viewMode, user?.id])

  const fetchNotes = useCallback(async (profileId) => {
    if (!useSupabase || !profileId) return []
    const { data } = await supabase.from(NOTES_TABLE).select('*').eq('profile_id', profileId).order('created_at', { ascending: false })
    return data || []
  }, [useSupabase])

  const fetchActivities = useCallback(async (profileId) => {
    if (!useSupabase || !profileId) return []
    const { data } = await supabase.from(ACTIVITIES_TABLE).select('*').eq('profile_id', profileId).order('created_at', { ascending: false })
    return (data || []).map((a) => {
      let t = a.activity_type
      let ico = 'dot'
      if (a.activity_type === 'stage_change') { t = `Stade → ${a.new_value}`; ico = 'arrow_up' }
      else if (a.activity_type === 'maturity_change') { t = `Maturité → ${a.new_value}`; ico = 'thermometer' }
      else if (a.activity_type === 'source_change') { t = `Source → ${a.new_value}`; ico = 'pin' }
      else if (a.activity_type === 'integration_change') { t = `Intégration → ${a.new_value}`; ico = 'calendar' }
      else if (a.activity_type === 'field_edit') { t = a.new_value || 'Champ modifié'; ico = 'pencil' }
      else if (a.activity_type === 'region_change') { t = `Région → ${a.new_value || '—'}`; ico = 'mappin' }
      else if (a.activity_type === 'note_added') { t = 'Note ajoutée'; ico = 'document'; }
      else if (a.activity_type === 'note_edited') { t = 'Note modifiée'; ico = 'document'; }
      else if (a.activity_type === 'note_deleted') { t = 'Note supprimée'; ico = 'trash'; }
      else if (a.activity_type === 'event_deleted') { t = 'Événement supprimé'; ico = 'trash'; }
      else if (a.activity_type === 'event_added') { t = a.new_value || 'Événement ajouté'; ico = 'pin' }
      else if (a.activity_type === 'profile_added') { t = 'Profil ajouté'; ico = 'plus' }
      else if (a.activity_type === 'lemlist_contact') { t = a.new_value || 'Premier contact Lemlist'; ico = 'envelope' }
      else if (a.activity_type === 'score_corrected') { t = a.new_value || 'Score corrigé'; ico = 'score_warning' }
      return {
        id: a.id,
        _source: 'activity',
        d: new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        t,
        n: a.old_value ? `Depuis ${a.old_value}` : a.new_value,
        ico,
        type: a.activity_type === 'stage_change' ? 'stg' : a.activity_type === 'maturity_change' ? 'mat' : a.activity_type === 'score_corrected' ? 'score_warning' : 'std',
        _ts: new Date(a.created_at).getTime(),
      }
    })
  }, [useSupabase])

  const fetchEvents = useCallback(async (profileId) => {
    if (!useSupabase || !profileId) return []
    const { data } = await supabase.from(EVENTS_TABLE).select('*').eq('profile_id', profileId).order('created_at', { ascending: false })
    const icos = { 'RDV planifié': 'calendar', 'RDV démission reconversion': 'calendar', 'Point téléphonique': 'mappin', 'Relance prévue': 'envelope', 'Point juridique': 'document', 'Signature contrat': 'pencil', 'Note libre': 'document' }
    return (data || []).map((e) => ({
      id: e.id,
      _source: 'event',
      d: e.event_date || new Date(e.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      t: e.event_type,
      n: e.description || e.event_type,
      ico: icos[e.event_type] || 'pin',
      type: 'event',
      _ts: new Date(e.created_at).getTime(),
    }))
  }, [useSupabase])

  const loadProfileDetail = useCallback(async (profileId) => {
    const [notes, activities, events] = await Promise.all([
      fetchNotes(profileId),
      fetchActivities(profileId),
      fetchEvents(profileId),
    ])
    const latestNote = notes[0]?.content ?? ''
    const acts = [...activities, ...events]
      .filter((a) => a._ts)
      .sort((a, b) => (b._ts || 0) - (a._ts || 0))
      .map(({ _ts, ...rest }) => ({ ...rest, ts: _ts }))
    setProfileNotes((prev) => ({ ...prev, [profileId]: latestNote }))
    setProfileActivities((prev) => ({ ...prev, [profileId]: acts }))
    return { notes: latestNote, acts }
  }, [fetchNotes, fetchActivities, fetchEvents])

  const deleteActivity = useCallback(async (profileId, activityId) => {
    if (!useSupabase) return
    await supabase.from(ACTIVITIES_TABLE).delete().eq('id', activityId)
    const [activities, events] = await Promise.all([fetchActivities(profileId), fetchEvents(profileId)])
    const acts = [...activities, ...events]
      .filter((a) => a._ts)
      .sort((a, b) => (b._ts || 0) - (a._ts || 0))
      .map(({ _ts, ...rest }) => ({ ...rest, ts: _ts }))
    setProfileActivities((prev) => ({ ...prev, [profileId]: acts }))
  }, [useSupabase, fetchActivities, fetchEvents])

  const insertActivity = useCallback(async (profileId, activityType, oldValue, newValue) => {
    if (!useSupabase) return
    await supabase.from(ACTIVITIES_TABLE).insert({
      profile_id: profileId,
      activity_type: activityType,
      old_value: oldValue,
      new_value: newValue,
    })
  }, [useSupabase])

  const deleteEvent = useCallback(async (profileId, eventId, contentSnapshot) => {
    if (!useSupabase) return
    await supabase.from(EVENTS_TABLE).delete().eq('id', eventId)
    insertActivity(profileId, 'event_deleted', (contentSnapshot || '').slice(0, 200), '')
    const [activities, events] = await Promise.all([fetchActivities(profileId), fetchEvents(profileId)])
    const acts = [...activities, ...events]
      .filter((a) => a._ts)
      .sort((a, b) => (b._ts || 0) - (a._ts || 0))
      .map(({ _ts, ...rest }) => ({ ...rest, ts: _ts }))
    setProfileActivities((prev) => ({ ...prev, [profileId]: acts }))
    showNotif('Événement supprimé')
  }, [useSupabase, fetchActivities, fetchEvents, insertActivity, showNotif])

  useEffect(() => {
    if (isSupabaseConfigured()) loadScoringConfig()
    fetchProfiles()
  }, [fetchProfiles])

  useEffect(() => {
    if (!useSupabase) return
    const channel = supabase
      .channel('profiles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: PROFILES_TABLE }, () => fetchProfiles())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [useSupabase, fetchProfiles])

  const updateProfile = useCallback((id, updates) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))
  }, [])

  const persistProfileUpdate = useCallback(async (id, updates) => {
    if (!useSupabase) return
    const row = { ...mapProfileToRow(updates), updated_at: new Date().toISOString() }
    await supabase.from(PROFILES_TABLE).update(row).eq('id', id)
  }, [useSupabase])

  const changeStage = useCallback((id, newStg) => {
    let oldStg = ''
    const now = new Date().toISOString()
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === id)
      if (!p || p.stg === newStg) return prev
      oldStg = p.stg
      const updated = { ...p, stg: newStg, updated_at: now }
      persistProfileUpdate(id, updated)
      insertActivity(id, 'stage_change', oldStg, newStg)
      return prev.map((x) => (x.id === id ? updated : x))
    })
    const p = profiles.find((x) => x.id === id)
    if (p) {
      showNotif(`${p.fn} ${p.ln} → ${newStg} ✓`)
      setProfileActivities((prev) => {
        const acts = prev[id] || []
        return { ...prev, [id]: [{ d: today(), t: `Stade → ${newStg}`, n: `Depuis ${oldStg || p.stg}`, ico: 'arrow_up', type: 'stg' }, ...acts] }
      })
    }
  }, [profiles, showNotif, persistProfileUpdate, insertActivity, today])

  const changeMaturity = useCallback((id, newMat) => {
    let oldMat = ''
    const now = new Date().toISOString()
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === id)
      if (!p || p.mat === newMat) return prev
      oldMat = p.mat
      const updated = { ...p, mat: newMat, updated_at: now }
      persistProfileUpdate(id, updated)
      insertActivity(id, 'maturity_change', oldMat, newMat)
      return prev.map((x) => (x.id === id ? updated : x))
    })
    const p = profiles.find((x) => x.id === id)
    if (p) {
      showNotif(`Maturité de ${p.fn} ${p.ln} → ${newMat} ✓`)
      setProfileActivities((prev) => {
        const acts = prev[id] || []
        return { ...prev, [id]: [{ d: today(), t: `Maturité → ${newMat}`, n: `Depuis ${oldMat || p.mat}`, ico: 'thermometer', type: 'mat' }, ...acts] }
      })
    }
  }, [profiles, showNotif, persistProfileUpdate, insertActivity, today])

  const changeInteg = useCallback((id, val) => {
    const p = profiles.find((x) => x.id === id)
    if (!p) return
    const oldInteg = p.integ
    const updated = { ...p, integ: val, updated_at: new Date().toISOString() }
    updateProfile(id, { integ: val })
    persistProfileUpdate(id, updated)
    if (useSupabase && (oldInteg !== val)) insertActivity(id, 'integration_change', oldInteg || '', val)
    showNotif(`Date d'intégration → ${val} ✓`)
  }, [profiles, updateProfile, persistProfileUpdate, showNotif, useSupabase, insertActivity])

  const changeSource = useCallback((id, newSrc) => {
    const p = profiles.find((x) => x.id === id)
    if (!p || p.src === newSrc) return
    const oldSrc = p.src
    const updated = { ...p, src: newSrc, updated_at: new Date().toISOString() }
    setProfiles((prev) => prev.map((x) => (x.id === id ? updated : x)))
    persistProfileUpdate(id, updated)
    insertActivity(id, 'source_change', oldSrc, newSrc)
    showNotif(`Source ${p.fn} ${p.ln} → ${newSrc} ✓`)
    setProfileActivities((prev) => {
      const acts = prev[id] || []
      return { ...prev, [id]: [{ d: today(), t: `Source → ${newSrc}`, n: `Depuis ${oldSrc}`, ico: 'pin', type: 'std' }, ...acts] }
    })
  }, [profiles, showNotif, persistProfileUpdate, insertActivity, today])

  const changeRegion = useCallback((id, newRegion) => {
    const p = profiles.find((x) => x.id === id)
    if (!p || p.region === newRegion) return
    const oldRegion = p.region || ''
    const updated = { ...p, region: newRegion, updated_at: new Date().toISOString() }
    setProfiles((prev) => prev.map((x) => (x.id === id ? updated : x)))
    persistProfileUpdate(id, updated)
    insertActivity(id, 'region_change', oldRegion, newRegion || '—')
    showNotif(`Région ${p.fn} ${p.ln} → ${newRegion || '—'} ✓`)
  }, [profiles, showNotif, persistProfileUpdate, insertActivity])

  const FIELD_LABELS = { fn: 'Prénom', ln: 'Nom', mail: 'Email', li: 'LinkedIn', co: 'Employeur', ti: 'Intitulé de poste', city: 'Ville', next_event_date: 'Prochain événement', next_event_label: 'Type d\'événement' }
  const updateProfileField = useCallback((id, field, newValue) => {
    const p = profiles.find((x) => x.id === id)
    if (!p) return
    const oldVal = p[field] ?? ''
    if (oldVal === newValue) return
    const updated = { ...p, [field]: newValue, updated_at: new Date().toISOString() }
    setProfiles((prev) => prev.map((x) => (x.id === id ? updated : x)))
    persistProfileUpdate(id, updated)
    const label = FIELD_LABELS[field] || field
    insertActivity(id, 'field_edit', `${label}: ${oldVal}`, `${label}: ${newValue}`)
    setProfileActivities((prev) => {
      const acts = prev[id] || []
      return { ...prev, [id]: [{ d: today(), t: `${label} → ${newValue}`, n: `Depuis ${oldVal}`, ico: 'pencil', type: 'std' }, ...acts] }
    })
    showNotif(`${label} mis à jour ✓`)
  }, [profiles, showNotif, persistProfileUpdate, insertActivity, today])

  const saveNote = useCallback(async (id, note) => {
    if (useSupabase) {
      await supabase.from(NOTES_TABLE).insert({ profile_id: id, content: note })
      insertActivity(id, 'note_added', '', note.slice(0, 200))
    }
    setProfileNotes((prev) => ({ ...prev, [id]: note }))
    setProfileActivities((prev) => {
      const acts = prev[id] || []
      return { ...prev, [id]: [{ d: today(), t: 'Note ajoutée', n: note.slice(0, 60) + (note.length > 60 ? '…' : ''), ico: 'document', type: 'std' }, ...acts] }
    })
    showNotif('Note enregistrée ✓')
  }, [showNotif, today, useSupabase, insertActivity])

  const updateNote = useCallback(async (profileId, noteId, newContent, oldContent) => {
    if (!useSupabase) return
    await supabase.from(NOTES_TABLE).update({ content: newContent, updated_at: new Date().toISOString() }).eq('id', noteId)
    insertActivity(profileId, 'note_edited', (oldContent || '').slice(0, 200), (newContent || '').slice(0, 200))
    const list = await fetchNotes(profileId)
    setProfileNotes((prev) => ({ ...prev, [profileId]: list?.[0]?.content ?? '' }))
    setProfileActivities((prev) => {
      const acts = prev[profileId] || []
      return { ...prev, [profileId]: [{ d: today(), t: 'Note modifiée', n: (newContent || '').slice(0, 60) + ((newContent || '').length > 60 ? '…' : ''), ico: 'document', type: 'std' }, ...acts] }
    })
    showNotif('Note mise à jour ✓')
  }, [useSupabase, fetchNotes, showNotif, insertActivity, today])

  const deleteNote = useCallback(async (profileId, noteId, contentSnapshot) => {
    if (!useSupabase) return
    await supabase.from(NOTES_TABLE).delete().eq('id', noteId)
    insertActivity(profileId, 'note_deleted', (contentSnapshot || '').slice(0, 200), '')
    const list = await fetchNotes(profileId)
    setProfileNotes((prev) => ({ ...prev, [profileId]: list?.[0]?.content ?? '' }))
    showNotif('Note supprimée')
  }, [useSupabase, fetchNotes, showNotif, insertActivity])

  const deleteProfile = useCallback(async (profileId) => {
    if (!useSupabase) return
    await supabase.from(PROFILES_TABLE).delete().eq('id', profileId)
    setProfiles((prev) => prev.filter((p) => p.id !== profileId))
    showNotif('Profil supprimé')
  }, [useSupabase, showNotif])

  const addEvent = useCallback(async (id, { type, date, note }) => {
    if (useSupabase) {
      await supabase.from(EVENTS_TABLE).insert({
        profile_id: id,
        event_type: type,
        event_date: date || today(),
        description: note || type,
      })
    }
    setProfileActivities((prev) => {
      const acts = prev[id] || []
      const ico = { 'RDV planifié': 'calendar', 'Relance': 'envelope', "Point d'étape": 'pin', 'Démission reconversion': 'calendar', 'Autre': 'pin' }[type] || 'pin'
      return { ...prev, [id]: [{ d: date || today(), t: type, n: note || type, ico, type: 'event' }, ...acts] }
    })
    showNotif(`Événement ajouté : ${type} ✓`)
  }, [showNotif, today, useSupabase])

  const updateProfileScore = useCallback(async (id, newScore, feedbackNote) => {
    const p = profiles.find((x) => x.id === id)
    if (!p) return
    const prevScore = p.sc
    updateProfile(id, { sc: newScore })
    persistProfileUpdate(id, { ...p, sc: newScore })
    if (useSupabase) {
      await supabase.from(SCORING_FEEDBACK_TABLE).insert({
        profile_id: id,
        previous_score: prevScore,
        new_score: newScore,
        feedback_note: feedbackNote,
      })
    }
    showNotif(`Score mis à jour : ${prevScore} → ${newScore} ✓`)
  }, [profiles, updateProfile, persistProfileUpdate, showNotif, useSupabase])

  const addProfile = useCallback(async (data) => {
    const base = {
      fn: data.fn || 'Nouveau',
      ln: data.ln || 'Profil',
      co: data.co || '—',
      ti: data.ti || '—',
      city: data.city || '—',
      region: data.region || '',
      src: data.src || 'Chasse LinkedIn',
      stg: null,
      mat: 'Froid',
      integ: '—',
      dt: today(),
      mail: data.mail || '—',
      li: data.li || '—',
      dur: data.dur || '',
      experiences: Array.isArray(data.experiences) ? data.experiences : [],
      formation: data.formation || '',
      notes: '',
      acts: [],
    }
    const sc = data.sc != null ? data.sc : calculateScore(base)
    const newP = { ...base, sc }
    if (useSupabase) {
      if (!user?.id) {
        showNotif('Session expirée — reconnectez-vous pour ajouter un profil')
        return false
      }
      try {
        const ownerFullName = userProfile?.full_name?.trim() || user.email || null
        const row = { ...mapProfileToRow(newP), owner_id: user.id, owner_email: user.email || null, owner_full_name: ownerFullName }
        let { data: inserted, error } = await supabase.from(PROFILES_TABLE).insert(row).select('id').single()
        if (error && error.message && error.message.includes('region')) {
          const { region: _r, ...rowWithoutRegion } = row
          const res = await supabase.from(PROFILES_TABLE).insert(rowWithoutRegion).select('id').single()
          error = res.error
          inserted = res.data
        }
        if (error) throw error
        setProfiles((prev) => [{ ...newP, id: inserted.id }, ...prev])
        insertActivity(inserted.id, 'profile_added', '', 'Profil ajouté')
      } catch (err) {
        console.error('[Supabase] Erreur add profile:', err)
        showNotif(`Erreur: ${err?.message}`)
        return false
      }
    } else {
      setProfiles((prev) => [{ ...newP, id: Date.now() }, ...prev])
    }
    showNotif(`${newP.fn} ${newP.ln} ajouté ✓ (score: ${sc})`)
    return true
  }, [today, showNotif, useSupabase, insertActivity, user?.id, user?.email, userProfile?.full_name])

  const addProfilesBatch = useCallback(async (profilesData) => {
    const rows = profilesData.map((p) => {
      const base = {
        fn: p.fn || '',
        ln: p.ln || '',
        co: p.co || '—',
        ti: p.ti || '—',
        city: p.city || '—',
        region: p.region || '',
        src: p.src || 'Chasse LinkedIn',
        mail: p.mail || '—',
        li: p.li || '—',
        stg: null,
        mat: 'Froid',
        integ: '—',
        dur: p.dur || '',
        experiences: Array.isArray(p.experiences) ? p.experiences : [],
        formation: p.formation || '',
        sequence_lemlist: p.sequence_lemlist || '',
        lead_status: p.lead_status || '',
      }
      const sc = p.sc != null ? p.sc : calculateScore(base)
      return mapProfileToRow({ ...base, sc })
    })
    if (useSupabase && rows.length) {
      if (!user?.id) return 0
      const ownerFullName = userProfile?.full_name?.trim() || user.email || null
      const ownerPayload = { owner_id: user.id, owner_email: user.email || null, owner_full_name: ownerFullName }
      const rowsWithOwner = rows.map((r) => ({ ...r, ...ownerPayload }))
      let { data, error } = await supabase.from(PROFILES_TABLE).insert(rowsWithOwner).select('id, first_name, last_name, company, title, city, region, email, linkedin_url, source, score, stage, maturity, integration_date, created_at, experiences, sequence_lemlist, lead_status, owner_id, owner_email, owner_full_name')
      if (error && error.message && error.message.includes('region')) {
        const rowsWithoutRegion = rowsWithOwner.map((r) => { const { region: _r, ...rest } = r; return rest })
        const res = await supabase.from(PROFILES_TABLE).insert(rowsWithoutRegion).select('id, first_name, last_name, company, title, city, email, linkedin_url, source, score, stage, maturity, integration_date, created_at, experiences, sequence_lemlist, lead_status, owner_id, owner_email, owner_full_name')
        error = res.error
        data = res.data
      }
      if (error) throw error
      const newProfiles = (data || []).map(mapRowToProfile)
      setProfiles((prev) => [...newProfiles, ...prev])
      for (let i = 0; i < newProfiles.length; i++) {
        const lastContacted = profilesData[i]?.lastContactedDate
        if (lastContacted && newProfiles[i]?.id) {
          await supabase.from(ACTIVITIES_TABLE).insert({
            profile_id: newProfiles[i].id,
            activity_type: 'lemlist_contact',
            old_value: '',
            new_value: `Premier contact Lemlist — ${lastContacted}`,
          })
        }
      }
      return newProfiles.length
    }
    return 0
  }, [useSupabase, user?.id, user?.email, userProfile?.full_name])

  const searchTrimmed = (searchQuery || '').trim()
  const filteredProfiles = profiles.filter((p) => {
    const q = searchTrimmed.toLowerCase()
    if (!q) return true
    return (
      p.fn?.toLowerCase().startsWith(q) ||
      p.ln?.toLowerCase().startsWith(q) ||
      (p.fn + ' ' + p.ln).toLowerCase().includes(q) ||
      (p.ln + ' ' + p.fn).toLowerCase().includes(q)
    )
  })

  return (
    <CRMContext.Provider
      value={{
        profiles,
        filteredProfiles,
        loading,
        searchQuery,
        setSearchQuery,
        notif,
        showNotif,
        today,
        useSupabase,
        updateProfile,
        changeStage,
        changeMaturity,
        changeInteg,
        changeSource,
        changeRegion,
        updateProfileField,
        saveNote,
        updateNote,
        deleteNote,
        deleteProfile,
        addEvent,
        addProfile,
        addProfilesBatch,
        updateProfileScore,
        fetchProfiles,
        loadProfileDetail,
        fetchNotes,
        fetchActivities,
        deleteActivity,
        deleteEvent,
        profileNotes,
        profileActivities,
      }}
    >
      {children}
    </CRMContext.Provider>
  )
}

export function useCRM() {
  const ctx = useContext(CRMContext)
  if (!ctx) throw new Error('useCRM must be used within CRMProvider')
  return ctx
}
