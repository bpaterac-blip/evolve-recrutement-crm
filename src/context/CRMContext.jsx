import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { INITIAL_PROFILES } from '../lib/data'

const CRMContext = createContext(null)

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || ''
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  return Boolean(url && key)
}

function mapRowToProfile(row) {
  if (!row) return null
  return {
    id: row.id,
    fn: row.fn ?? '',
    ln: row.ln ?? '',
    co: row.co ?? '—',
    ti: row.ti ?? '—',
    city: row.city ?? '—',
    src: row.src ?? 'Chasse LinkedIn',
    sc: row.sc ?? 0,
    stg: row.stg ?? 'R0',
    mat: row.mat ?? 'Froid',
    integ: row.integ ?? '—',
    dt: row.dt ?? '',
    mail: row.mail ?? '—',
    li: row.li ?? '—',
    notes: row.notes ?? '',
    acts: Array.isArray(row.acts) ? row.acts : (typeof row.acts === 'string' ? JSON.parse(row.acts) : []),
  }
}

function mapProfileToRow(profile) {
  return {
    fn: profile.fn ?? '',
    ln: profile.ln ?? '',
    co: profile.co ?? '—',
    ti: profile.ti ?? '—',
    city: profile.city ?? '—',
    src: profile.src ?? 'Chasse LinkedIn',
    sc: profile.sc ?? 0,
    stg: profile.stg ?? 'R0',
    mat: profile.mat ?? 'Froid',
    integ: profile.integ ?? '—',
    dt: profile.dt ?? '',
    mail: profile.mail ?? '—',
    li: profile.li ?? '—',
    notes: profile.notes ?? '',
    acts: profile.acts ?? [],
  }
}

export function CRMProvider({ children }) {
  const [profiles, setProfiles] = useState([])
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

  // Charger les profils depuis Supabase
  const fetchProfiles = useCallback(async () => {
    if (!useSupabase) {
      setProfiles(INITIAL_PROFILES)
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setProfiles((data || []).map(mapRowToProfile))
    } catch (err) {
      console.error('Erreur fetch profiles:', err)
      setProfiles(INITIAL_PROFILES)
    } finally {
      setLoading(false)
    }
  }, [useSupabase])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  // Abonnement Realtime Supabase
  useEffect(() => {
    if (!useSupabase) return
    const channel = supabase
      .channel('profiles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchProfiles()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [useSupabase, fetchProfiles])

  const updateProfile = useCallback((id, updates) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))
  }, [])

  const persistProfileUpdate = useCallback(async (id, updates) => {
    if (!useSupabase) return
    const row = mapProfileToRow(updates)
    const { error } = await supabase.from('profiles').update(row).eq('id', id)
    if (error) {
      console.error('Erreur update profile:', error)
      showNotif('Erreur lors de la sauvegarde')
    }
  }, [useSupabase, showNotif])

  const changeStage = useCallback((id, newStg) => {
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === id)
      if (!p || p.stg === newStg) return prev
      const old = p.stg
      const updated = { ...p, stg: newStg, acts: [{ d: today(), t: `Stade → ${newStg}`, n: `Changement depuis ${old}`, ico: '↗', type: 'stg' }, ...(p.acts || [])] }
      persistProfileUpdate(id, updated)
      return prev.map((x) => (x.id === id ? updated : x))
    })
    const p = profiles.find((x) => x.id === id)
    if (p) showNotif(`${p.fn} ${p.ln} → ${newStg} ✓`)
  }, [profiles, showNotif, today, persistProfileUpdate])

  const changeMaturity = useCallback((id, newMat) => {
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === id)
      if (!p || p.mat === newMat) return prev
      const old = p.mat
      const updated = { ...p, mat: newMat, acts: [{ d: today(), t: `Maturité → ${newMat}`, n: `Changée depuis ${old}`, ico: '🌡', type: 'mat' }, ...(p.acts || [])] }
      persistProfileUpdate(id, updated)
      return prev.map((x) => (x.id === id ? updated : x))
    })
    const p = profiles.find((x) => x.id === id)
    if (p) showNotif(`Maturité de ${p.fn} ${p.ln} → ${newMat} ✓`)
  }, [profiles, showNotif, today, persistProfileUpdate])

  const changeInteg = useCallback((id, val) => {
    const p = profiles.find((x) => x.id === id)
    if (!p) return
    const updated = { ...p, integ: val }
    updateProfile(id, { integ: val })
    persistProfileUpdate(id, updated)
    showNotif(`Date d'intégration → ${val} ✓`)
  }, [profiles, updateProfile, persistProfileUpdate, showNotif])

  const saveNote = useCallback((id, note) => {
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === id)
      if (!p) return prev
      const updated = { ...p, notes: note, acts: [{ d: today(), t: 'Note mise à jour', n: note.slice(0, 60) + (note.length > 60 ? '…' : ''), ico: '📝', type: 'std' }, ...(p.acts || [])] }
      persistProfileUpdate(id, updated)
      return prev.map((x) => (x.id === id ? updated : x))
    })
    showNotif('💾 Note enregistrée ✓')
  }, [showNotif, today, persistProfileUpdate])

  const addEvent = useCallback((id, { type, date, note }) => {
    const ico = { 'RDV planifié': '📅', 'RDV démission reconversion': '📅', 'Point téléphonique': '📞', 'Relance prévue': '📩', 'Point juridique': '⚖️', 'Signature contrat': '✍️', 'Note libre': '📝' }[type] || '📌'
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === id)
      if (!p) return prev
      const updated = { ...p, acts: [{ d: date || today(), t: type, n: note || type, ico, type: 'event' }, ...(p.acts || [])] }
      persistProfileUpdate(id, updated)
      return prev.map((x) => (x.id === id ? updated : x))
    })
    showNotif(`Événement ajouté : ${type} ✓`)
  }, [showNotif, today, persistProfileUpdate])

  const addProfile = useCallback(async (data) => {
    const newP = {
      fn: data.fn || 'Nouveau',
      ln: data.ln || 'Profil',
      co: data.co || '—',
      ti: data.ti || '—',
      city: data.city || '—',
      src: data.src || 'Chasse LinkedIn',
      sc: data.sc ?? 0,
      stg: 'R0',
      mat: 'Froid',
      integ: '—',
      dt: today(),
      mail: data.mail || '—',
      li: data.li || '—',
      notes: '',
      acts: [{ d: today(), t: 'Ajouté au CRM', n: 'Entré manuellement en R0', ico: '➕', type: 'std' }],
    }
    if (useSupabase) {
      try {
        const { data: inserted, error } = await supabase.from('profiles').insert(mapProfileToRow(newP)).select('id').single()
        if (error) throw error
        setProfiles((prev) => [{ ...newP, id: inserted.id }, ...prev])
      } catch (err) {
        console.error('Erreur add profile:', err)
        showNotif('Erreur lors de l\'ajout du profil')
        return false
      }
    } else {
      setProfiles((prev) => [{ ...newP, id: Date.now() }, ...prev])
    }
    showNotif(`${newP.fn} ${newP.ln} ajouté au pipeline en R0 ✓`)
    return true
  }, [today, showNotif, useSupabase])

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
        updateProfile,
        changeStage,
        changeMaturity,
        changeInteg,
        saveNote,
        addEvent,
        addProfile,
        fetchProfiles,
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
