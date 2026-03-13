import { createContext, useContext, useState, useCallback } from 'react'
import { INITIAL_PROFILES } from '../lib/data'

const CRMContext = createContext(null)

export function CRMProvider({ children }) {
  const [profiles, setProfiles] = useState(INITIAL_PROFILES)
  const [notif, setNotif] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const today = () => {
    const d = new Date()
    return `${d.getDate()} ${['jan', 'fév', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'][d.getMonth()]}`
  }

  const showNotif = useCallback((msg) => {
    setNotif(msg)
    setTimeout(() => setNotif(null), 3200)
  }, [])

  const updateProfile = useCallback((id, updates) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))
  }, [])

  const changeStage = useCallback((id, newStg) => {
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === id)
      if (!p || p.stg === newStg) return prev
      const old = p.stg
      return prev.map((x) => (x.id === id ? { ...x, stg: newStg, acts: [{ d: today(), t: `Stade → ${newStg}`, n: `Changement depuis ${old}`, ico: '↗', type: 'stg' }, ...(x.acts || [])] } : x))
    })
    const p = profiles.find((x) => x.id === id)
    if (p) showNotif(`${p.fn} ${p.ln} → ${newStg} ✓`)
  }, [profiles, showNotif])

  const changeMaturity = useCallback((id, newMat) => {
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === id)
      if (!p || p.mat === newMat) return prev
      const old = p.mat
      return prev.map((x) => (x.id === id ? { ...x, mat: newMat, acts: [{ d: today(), t: `Maturité → ${newMat}`, n: `Changée depuis ${old}`, ico: '🌡', type: 'mat' }, ...(x.acts || [])] } : x))
    })
    const p = profiles.find((x) => x.id === id)
    if (p) showNotif(`Maturité de ${p.fn} ${p.ln} → ${newMat} ✓`)
  }, [profiles, showNotif])

  const changeInteg = useCallback((id, val) => {
    const p = profiles.find((x) => x.id === id)
    if (!p) return
    updateProfile(id, { integ: val })
    showNotif(`Date d'intégration → ${val} ✓`)
  }, [profiles, updateProfile, showNotif])

  const saveNote = useCallback((id, note) => {
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === id)
      if (!p) return prev
      return prev.map((x) => (x.id === id ? { ...x, notes: note, acts: [{ d: today(), t: 'Note mise à jour', n: note.slice(0, 60) + (note.length > 60 ? '…' : ''), ico: '📝', type: 'std' }, ...(x.acts || [])] } : x))
    })
    showNotif('💾 Note enregistrée ✓')
  }, [showNotif])

  const addEvent = useCallback((id, { type, date, note }) => {
    const ico = { 'RDV planifié': '📅', 'RDV démission reconversion': '📅', 'Point téléphonique': '📞', 'Relance prévue': '📩', 'Point juridique': '⚖️', 'Signature contrat': '✍️', 'Note libre': '📝' }[type] || '📌'
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === id)
      if (!p) return prev
      return prev.map((x) => (x.id === id ? { ...x, acts: [{ d: date || today(), t: type, n: note || type, ico, type: 'event' }, ...(x.acts || [])] } : x))
    })
    showNotif(`Événement ajouté : ${type} ✓`)
  }, [showNotif])

  const addProfile = useCallback((data) => {
    const newP = {
      id: Date.now(),
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
    setProfiles((prev) => [newP, ...prev])
    showNotif(`${newP.fn} ${newP.ln} ajouté au pipeline en R0 ✓`)
  }, [today, showNotif])

  const filteredProfiles = searchQuery
    ? profiles.filter((p) => `${p.fn} ${p.ln} ${p.co} ${p.city}`.toLowerCase().includes(searchQuery.toLowerCase()))
    : profiles

  return (
    <CRMContext.Provider
      value={{
        profiles,
        filteredProfiles,
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
