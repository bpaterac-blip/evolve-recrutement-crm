import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { calculateScore } from '../lib/scoring'
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
    fn: row.first_name ?? '',
    ln: row.last_name ?? '',
    co: row.company ?? '—',
    ti: row.title ?? '—',
    city: row.city ?? '—',
    src: row.source ?? 'Chasse LinkedIn',
    sc: row.score ?? 0,
    stg: row.stage ?? 'R0',
    mat: row.maturity ?? 'Froid',
    integ: row.integration_date ?? '—',
    dt: row.created_at ? new Date(row.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '',
    mail: row.email ?? '—',
    li: row.linkedin_url ?? '—',
    experiences,
    dur: row.duration ?? '',
    notes: '',
    acts: [],
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
    email: profile.mail ?? '—',
    linkedin_url: profile.li ?? '—',
    source: profile.src ?? 'Chasse LinkedIn',
    score: profile.sc ?? 0,
    stage: profile.stg ?? 'R0',
    maturity: profile.mat ?? 'Froid',
    sequence_lemlist: profile.sequence_lemlist ?? '',
    integration_date: profile.integ ?? '—',
  }
  if (experiences.length) row.experiences = experiences
  if (profile.dur) row.duration = profile.dur
  return row
}

export function CRMProvider({ children }) {
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
      const { data, error } = await supabase
        .from(PROFILES_TABLE)
        .select('*')
        .order('id', { ascending: false })
      if (error) throw error
      setProfiles((data || []).map(mapRowToProfile))
    } catch (err) {
      console.error('[Supabase] Erreur fetch profiles:', err)
      setProfiles(INITIAL_PROFILES)
    } finally {
      setLoading(false)
    }
  }, [useSupabase])

  const fetchNotes = useCallback(async (profileId) => {
    if (!useSupabase || !profileId) return []
    const { data } = await supabase.from(NOTES_TABLE).select('*').eq('profile_id', profileId).order('created_at', { ascending: false })
    return data || []
  }, [useSupabase])

  const fetchActivities = useCallback(async (profileId) => {
    if (!useSupabase || !profileId) return []
    const { data } = await supabase.from(ACTIVITIES_TABLE).select('*').eq('profile_id', profileId).order('created_at', { ascending: false })
    return (data || []).map((a) => ({
      d: new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      t: a.activity_type === 'stage_change' ? `Stade → ${a.new_value}` : a.activity_type === 'maturity_change' ? `Maturité → ${a.new_value}` : a.activity_type,
      n: a.old_value ? `Depuis ${a.old_value}` : a.new_value,
      ico: a.activity_type === 'stage_change' ? '↗' : '🌡',
      type: a.activity_type === 'stage_change' ? 'stg' : 'mat',
      _ts: new Date(a.created_at).getTime(),
    }))
  }, [useSupabase])

  const fetchEvents = useCallback(async (profileId) => {
    if (!useSupabase || !profileId) return []
    const { data } = await supabase.from(EVENTS_TABLE).select('*').eq('profile_id', profileId).order('created_at', { ascending: false })
    const icos = { 'RDV planifié': '📅', 'RDV démission reconversion': '📅', 'Point téléphonique': '📞', 'Relance prévue': '📩', 'Point juridique': '⚖️', 'Signature contrat': '✍️', 'Note libre': '📝' }
    return (data || []).map((e) => ({
      d: e.event_date || new Date(e.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      t: e.event_type,
      n: e.description || e.event_type,
      ico: icos[e.event_type] || '📌',
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
      .map(({ _ts, ...rest }) => rest)
    setProfileNotes((prev) => ({ ...prev, [profileId]: latestNote }))
    setProfileActivities((prev) => ({ ...prev, [profileId]: acts }))
    return { notes: latestNote, acts }
  }, [fetchNotes, fetchActivities, fetchEvents])

  useEffect(() => {
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
    const row = mapProfileToRow(updates)
    await supabase.from(PROFILES_TABLE).update(row).eq('id', id)
  }, [useSupabase])

  const insertActivity = useCallback(async (profileId, activityType, oldValue, newValue) => {
    if (!useSupabase) return
    await supabase.from(ACTIVITIES_TABLE).insert({
      profile_id: profileId,
      activity_type: activityType,
      old_value: oldValue,
      new_value: newValue,
    })
  }, [useSupabase])

  const changeStage = useCallback((id, newStg) => {
    let oldStg = ''
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === id)
      if (!p || p.stg === newStg) return prev
      oldStg = p.stg
      const updated = { ...p, stg: newStg }
      persistProfileUpdate(id, updated)
      insertActivity(id, 'stage_change', oldStg, newStg)
      return prev.map((x) => (x.id === id ? updated : x))
    })
    const p = profiles.find((x) => x.id === id)
    if (p) {
      showNotif(`${p.fn} ${p.ln} → ${newStg} ✓`)
      setProfileActivities((prev) => {
        const acts = prev[id] || []
        return { ...prev, [id]: [{ d: today(), t: `Stade → ${newStg}`, n: `Depuis ${oldStg || p.stg}`, ico: '↗', type: 'stg' }, ...acts] }
      })
    }
  }, [profiles, showNotif, persistProfileUpdate, insertActivity, today])

  const changeMaturity = useCallback((id, newMat) => {
    let oldMat = ''
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === id)
      if (!p || p.mat === newMat) return prev
      oldMat = p.mat
      const updated = { ...p, mat: newMat }
      persistProfileUpdate(id, updated)
      insertActivity(id, 'maturity_change', oldMat, newMat)
      return prev.map((x) => (x.id === id ? updated : x))
    })
    const p = profiles.find((x) => x.id === id)
    if (p) {
      showNotif(`Maturité de ${p.fn} ${p.ln} → ${newMat} ✓`)
      setProfileActivities((prev) => {
        const acts = prev[id] || []
        return { ...prev, [id]: [{ d: today(), t: `Maturité → ${newMat}`, n: `Depuis ${oldMat || p.mat}`, ico: '🌡', type: 'mat' }, ...acts] }
      })
    }
  }, [profiles, showNotif, persistProfileUpdate, insertActivity, today])

  const changeInteg = useCallback((id, val) => {
    const p = profiles.find((x) => x.id === id)
    if (!p) return
    const updated = { ...p, integ: val }
    updateProfile(id, { integ: val })
    persistProfileUpdate(id, updated)
    showNotif(`Date d'intégration → ${val} ✓`)
  }, [profiles, updateProfile, persistProfileUpdate, showNotif])

  const saveNote = useCallback(async (id, note) => {
    if (useSupabase) {
      await supabase.from(NOTES_TABLE).insert({ profile_id: id, content: note })
    }
    setProfileNotes((prev) => ({ ...prev, [id]: note }))
    setProfileActivities((prev) => {
      const acts = prev[id] || []
      return { ...prev, [id]: [{ d: today(), t: 'Note mise à jour', n: note.slice(0, 60) + (note.length > 60 ? '…' : ''), ico: '📝', type: 'std' }, ...acts] }
    })
    showNotif('💾 Note enregistrée ✓')
  }, [showNotif, today, useSupabase])

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
      const ico = { 'RDV planifié': '📅', 'RDV démission reconversion': '📅', 'Point téléphonique': '📞', 'Relance prévue': '📩', 'Point juridique': '⚖️', 'Signature contrat': '✍️', 'Note libre': '📝' }[type] || '📌'
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
      src: data.src || 'Chasse LinkedIn',
      stg: 'R0',
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
      try {
        const { data: inserted, error } = await supabase.from(PROFILES_TABLE).insert(mapProfileToRow(newP)).select('id').single()
        if (error) throw error
        setProfiles((prev) => [{ ...newP, id: inserted.id }, ...prev])
      } catch (err) {
        console.error('[Supabase] Erreur add profile:', err)
        showNotif(`Erreur: ${err?.message}`)
        return false
      }
    } else {
      setProfiles((prev) => [{ ...newP, id: Date.now() }, ...prev])
    }
    showNotif(`${newP.fn} ${newP.ln} ajouté au pipeline en R0 ✓ (score: ${sc})`)
    return true
  }, [today, showNotif, useSupabase])

  const addProfilesBatch = useCallback(async (profilesData) => {
    const rows = profilesData.map((p) => {
      const base = { fn: p.fn || '', ln: p.ln || '', co: p.co || '—', ti: p.ti || '—', city: p.city || '—', src: p.src || 'Chasse LinkedIn', mail: p.mail || '—', li: p.li || '—', stg: 'R0', mat: 'Froid', integ: '—', dur: p.dur || '', experiences: Array.isArray(p.experiences) ? p.experiences : [], formation: p.formation || '' }
      const sc = p.sc != null ? p.sc : calculateScore(base)
      return mapProfileToRow({ ...base, sc })
    })
    if (useSupabase && rows.length) {
      const { data, error } = await supabase.from(PROFILES_TABLE).insert(rows).select('id, first_name, last_name, company, title, city, email, linkedin_url, source, score, stage, maturity, integration_date, created_at, experiences, duration')
      if (error) throw error
      const newProfiles = (data || []).map(mapRowToProfile)
      setProfiles((prev) => [...newProfiles, ...prev])
      return newProfiles.length
    }
    return 0
  }, [useSupabase])

  const filteredProfiles = searchQuery
    ? profiles.filter((p) => `${p.fn} ${p.ln} ${p.co} ${p.city}`.toLowerCase().includes(searchQuery.toLowerCase()))
    : profiles

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
        saveNote,
        addEvent,
        addProfile,
        addProfilesBatch,
        updateProfileScore,
        fetchProfiles,
        loadProfileDetail,
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
