import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import { useAuth } from '../context/AuthContext'
import { useViewMode } from '../context/ViewModeContext'
import { supabase } from '../lib/supabase'
import { STAGES, MATURITIES, SOURCES } from '../lib/data'
import InlineDropdown from '../components/InlineDropdown'
import PasInteresseModal from '../components/PasInteresseModal'
import ChuteRaisonModal from '../components/ChuteRaisonModal'
import R0ConfirmModal from '../components/R0ConfirmModal'

const ACCENT = '#173731'
const GOLD = '#D2AB76'

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

const MATURITY_STYLES = {
  Chaud: { backgroundColor: '#fff1f2', color: '#e11d48' },
  Tiède: { backgroundColor: '#fff7ed', color: '#ea580c' },
  Froid: { backgroundColor: '#f8fafc', color: '#94a3b8' },
  Chute: { backgroundColor: '#fff1f2', color: '#e11d48', fontStyle: 'italic' },
  'Pas intéressé': { backgroundColor: '#f1f5f9', color: '#64748b', fontStyle: 'italic', fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 20 },
  Archivé: { backgroundColor: '#f8fafc', color: '#cbd5e1' },
  'Très chaud': { backgroundColor: '#fff1f2', color: '#e11d48' },
}

const STAGE_STYLES = {
  R0: { backgroundColor: '#eff6ff', color: '#1d4ed8' },
  R1: { backgroundColor: '#f0fdf4', color: '#15803d' },
  "Point d'étape téléphonique": { backgroundColor: '#fefce8', color: '#a16207' },
  "Point d'étape": { backgroundColor: '#fefce8', color: '#a16207' },
  'R2 Amaury': { backgroundColor: '#fff7ed', color: '#c2410c' },
  'Point Business Plan': { backgroundColor: '#fef3c7', color: '#b45309' },
  'Point juridique': { backgroundColor: '#faf5ff', color: '#7e22ce' },
  'Démission reconversion': { backgroundColor: '#fff1f2', color: '#e11d48' },
  Intégration: { backgroundColor: '#dcfce7', color: '#15803d' },
  Recruté: { backgroundColor: ACCENT, color: GOLD },
  Démission: { backgroundColor: '#fff1f2', color: '#e11d48' },
}

function getScoreStyle(score) {
  if (score == null) return { backgroundColor: '#f8fafc', color: '#94a3b8' }
  if (score >= 70) return { backgroundColor: '#dcfce7', color: '#15803d' }
  if (score >= 50) return { backgroundColor: '#fefce8', color: '#a16207' }
  return { backgroundColor: '#f8fafc', color: '#94a3b8' }
}

const IconTrash = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
)

const IconDownload = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const IconWarning = () => (
  <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#D2AB76" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

function getPriorityLabel(score) {
  if (score >= 70) return 'Prioritaire'
  if (score >= 40) return 'À travailler'
  return 'À écarter'
}

function escapeCsv(val) {
  if (val == null || val === '') return ''
  const s = String(val)
  if (s.includes(';') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

function formatSession(p) {
  if (p?.integration_periode && p?.integration_annee) return `${p.integration_periode} ${p.integration_annee}`
  if (p?.integration_periode) return p.integration_periode
  if (p?.integration_annee) return p.integration_annee
  return null
}

function formatAddedDate(p) {
  if (p?.created_at) return new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  return p?.dt || '—'
}

// ── Google Calendar URL ───────────────────────────────────────────────────────
function buildGoogleCalendarUrl({ title, date, time, description, guest, durationMin = 60 }) {
  if (!date) return null
  const pad = (n) => String(n).padStart(2, '0')
  const [y, m, d] = date.split('-')
  const [h, min] = (time || '09:00').split(':')
  const startStr = `${y}${m}${d}T${pad(h)}${pad(min)}00`
  const endDate = new Date(`${date}T${time || '09:00'}:00`)
  endDate.setMinutes(endDate.getMinutes() + durationMin)
  const endStr = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`
  const params = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${startStr}/${endStr}`, details: description || '' })
  if (guest) params.append('add', guest)
  return `https://calendar.google.com/calendar/render?${params}`
}

// ── Templates email ───────────────────────────────────────────────────────────
function buildEmailForStage(profile, newStage, date, time, rdvType, meetLink, transferLink, cgpContact, bpLink, skipBP) {
  const prenom = profile.fn || ''
  const prenomNom = `${profile.fn || ''} ${profile.ln || ''}`.trim()
  const d = date ? new Date(date + 'T12:00:00') : null
  const dateStr = d ? d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const heure = time && time !== '12:00' ? time : ''
  const meetLine = meetLink ? `\n🔗 Lien de connexion : ${meetLink}` : ''
  const closing = `\n\nBonne journée à vous,\nBien cordialement,`
  const sig = `\n\nBaptiste PATERAC\nAssocié & Co-fondateur | Responsable de réseau régions\nGroupe Evolve\nbpaterac@evolveinvestissement.com | 06 38 37 59 60 | https://groupe-evolve.fr`

  const TEMPLATES = {
    'R0': {
      subject: `Premier échange téléphonique Evolve – ${dateStr}${heure ? ' à ' + heure : ''}`,
      body: `Bonjour ${prenom},\n\nComme convenu, je vous confirme notre premier échange téléphonique de 15 minutes le ${dateStr}${heure ? ' à ' + heure : ''}.${closing}${sig}`,
    },
    'R1': {
      subject: `Suite premier échange téléphonique – Présentation visio du ${dateStr}${heure ? ' à ' + heure : ''}`,
      body: `${prenom},\n\nJe vous remercie pour notre premier échange. Comme convenu, je vous confirme notre présentation visio du ${dateStr}${heure ? ' à ' + heure : ''}${meetLink ? ' via ce lien : ' + meetLink : ''}.\n\nVous pouvez retrouver ci-dessous différents liens qui vous donneront plus d'informations sur Evolve et ses conseillers :\nSite : https://www.groupe-evolve.fr/\nLinkedIn : https://www.linkedin.com/company/evolvefr/\nYoutube : https://www.youtube.com/@Amaury_Dufresnoy${closing}${sig}`,
    },
    'Point Business Plan': {
      subject: `Suite présentation Evolve`,
      body: `${prenom},\n\nJe vous remercie pour notre échange du jour. Comme convenu, je vous confirme notre point Business Plan du ${dateStr}${heure ? ' à ' + heure : ''}${meetLink ? ' via ce lien : ' + meetLink : ''}.\n\nVous retrouverez le lien de la présentation téléchargeable sous 3 jours ici : ${transferLink || '[ lien Transfer ]'}\n\nJe reste à votre disposition pour tout complément d'information d'ici là,${closing}${sig}`,
    },
    "Point d'étape": skipBP ? {
      subject: `Suite présentation Evolve`,
      body: `${prenom},\n\nJe vous remercie pour notre échange du jour.\n\nVous pouvez retrouver le lien de la présentation téléchargeable sous 3 jours ici : ${transferLink || '[ lien Transfer ]'}\n\nComme convenu, je vous reconfirme notre point d'étape téléphonique du ${dateStr}${heure ? ' à ' + heure : ''}.\n\nJ'ai transmis vos coordonnées à ${cgpContact || '[ Prénom NOM ]'} qui va vous contacter pour fixer un créneau d'échange avec vous.\n\nJe reste à votre disposition pour tout complément d'information d'ici là,${closing}${sig}`,
    } : {
      subject: `Suite point Business Plan`,
      body: `${prenom},\n\nJe vous remercie pour notre point Business Plan du jour.\n\nComme convenu, vous pouvez retrouver via ce lien le Business Plan modifiable : ${bpLink || '[ lien Google Drive ]'}\n\nJ'ai transmis vos coordonnées à ${cgpContact || '[ Prénom NOM ]'} qui va vous contacter pour fixer un créneau afin d'échanger avec vous.\n\nJe vous reconfirme notre point d'étape le ${dateStr}${heure ? ' à ' + heure : ''}, d'ici là je reste disponible en cas de besoin.${closing}${sig}`,
    },
    'Démission reconversion': {
      subject: `Félicitations pour votre décision — ${prenomNom}`,
      body: `${prenom},\n\nFélicitations pour votre décision de vous lancer dans l'indépendance !\n\nNous sommes ravis de vous accompagner dans cette nouvelle étape. Toute l'équipe Evolve est à vos côtés pour rendre cette transition la plus sereine possible.${closing}${sig}`,
    },
    'R2 Amaury': {
      subject: `Confirmation de votre rendez-vous avec Amaury Leroux`,
      body: `${prenom},\n\nJe vous confirme votre rendez-vous avec Amaury Leroux, co-fondateur d'Evolve Investissement :\n\n📅 ${dateStr}${heure ? ' à ' + heure : ''}${meetLine}${closing}${sig}`,
    },
    'Point juridique': {
      subject: `Point juridique — ${prenomNom}`,
      body: `${prenom},\n\nJe vous confirme notre point juridique :\n\n📅 ${dateStr}${heure ? ' à ' + heure : ''}${meetLine}${closing}${sig}`,
    },
    'Recruté': {
      subject: `Bienvenue chez Evolve Investissement ! 🎉`,
      body: `${prenom},\n\nC'est avec un immense plaisir que nous vous accueillons officiellement au sein d'Evolve Investissement !\n\nVotre parcours commence ici — nous sommes impatients de construire quelque chose de grand avec vous.${sig}`,
    },
  }
  return TEMPLATES[newStage] || {
    subject: `Mise à jour de votre parcours — Evolve Investissement`,
    body: `${prenom},\n\nJe vous contacte concernant votre parcours au sein d'Evolve Investissement.${sig}`,
  }
}

export default function Profiles({ contactedOnly = false }) {
  const navigate = useNavigate()
  const { role, user } = useAuth()
  const { viewMode } = useViewMode()
  const { profiles, filteredProfiles, changeStage, changeMaturity, changeSource, loading, fetchProfiles, showNotif, useSupabase } = useCRM()
  const isGlobalView = role === 'admin' && viewMode === 'global'
  const [srcFilter, setSrcFilter] = useState('')
  const [stgFilter, setStgFilter] = useState('')
  const [matFilter, setMatFilter] = useState('')
  const [openDropdownId, setOpenDropdownId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [pasInteresseModalProfile, setPasInteresseModalProfile] = useState(null)
  const [chuteModalProfile, setChuteModalProfile] = useState(null)
  const [r0ConfirmProfile, setR0ConfirmProfile] = useState(null)
  const [emailPreviewModal, setEmailPreviewModal] = useState(null)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    const handleClickOutside = (e) => {
      const isInsideDropdown =
        e.target.closest('.source-dropdown') ||
        e.target.closest('.maturite-dropdown') ||
        e.target.closest('.ddrop') ||
        e.target.closest('[class*="ddrop"]')
      if (!isInsideDropdown) {
        setOpenDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside, true)
    return () => document.removeEventListener('mousedown', handleClickOutside, true)
  }, [])

  const P = filteredProfiles.filter((p) => {
    // En mode "contactés", ne montrer que les profils avec un stade (passés en pipeline)
    if (contactedOnly && !p.stg) return false
    if (srcFilter && p.src !== srcFilter) return false
    if (stgFilter && p.stg !== stgFilter) return false
    if (matFilter === 'Sans archivés' && p.mat === 'Archivé') return false
    if (matFilter && matFilter !== 'Sans archivés' && p.mat !== matFilter) return false
    return true
  })

  const ini = (a, b) => (a?.[0] || '') + (b?.[0] || '')
  const selectedCount = selectedIds.size
  const allSelected = P.length > 0 && P.every((p) => selectedIds.has(p.id))
  const someSelected = selectedCount > 0

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        P.forEach((p) => next.delete(p.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        P.forEach((p) => next.add(p.id))
        return next
      })
    }
  }

  const handleDeleteSelection = () => setDeleteModalOpen(true)

  const confirmDelete = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    await supabase.from('profiles').delete().in('id', ids)
    setSelectedIds(new Set())
    setDeleteModalOpen(false)
    await fetchProfiles()
  }

  const handleSendToR0 = (e, profile) => {
    e.stopPropagation()
    setR0ConfirmProfile(profile)
  }

  const confirmSendToR0 = async (source, r0Date, r0Time) => {
    const profile = r0ConfirmProfile
    if (!profile || !useSupabase) return
    // Update source if changed
    if (source && source !== profile.src) {
      changeSource(profile.id, source)
    }
    // Stocker la date+heure complète si heure renseignée
    const eventDateTime = r0Time ? `${r0Date}T${r0Time}:00` : r0Date
    // Update profile: stage R0 + next_event_date/label with the R0 date
    await supabase.from('profiles').update({
      stage: 'R0',
      next_event_date: eventDateTime,
      next_event_label: 'R0',
    }).eq('id', profile.id)
    // Create event for the R0 meeting
    const r0EventRow = {
      profile_id: profile.id,
      event_type: 'R0',
      event_date: eventDateTime,
      description: `R0 planifié (source: ${source})`,
    }
    if (user?.id) r0EventRow.owner_id = user.id
    // Create activity event for pipeline addition
    const pipelineEventRow = {
      profile_id: profile.id,
      event_type: 'Ajout pipeline',
      event_date: new Date().toISOString(),
      description: `Ajouté en R0 depuis Tous les profils (source: ${source})`,
    }
    if (user?.id) pipelineEventRow.owner_id = user.id
    await supabase.from('events').insert([r0EventRow, pipelineEventRow])
    changeStage(profile.id, 'R0')
    await fetchProfiles()
    setR0ConfirmProfile(null)
    showNotif(`${profile.fn} ${profile.ln} → R0 le ${new Date(r0Date).toLocaleDateString('fr-FR')}${r0Time ? ' à ' + r0Time : ''}`)
    // Construire l'URL Google Calendar
    const emailData = buildEmailForStage(profile, 'R0', r0Date, r0Time || '', 'Téléphone', '', '', '', '', false)
    const calUrl = buildGoogleCalendarUrl({
      title: `${profile.fn || ''} ${profile.ln || ''} & Evolve — Échange téléphonique`.trim(),
      date: r0Date,
      time: r0Time || '09:00',
      description: emailData.body,
      guest: profile.mail?.trim() || '',
      durationMin: 30,
    })
    setEmailSubject(emailData.subject)
    setEmailBody(emailData.body)
    setEmailSent(false)
    setEmailPreviewModal({ profile, newStage: 'R0', calendarUrl: calUrl })
  }

  // ── Envoi email via Edge Function Resend ─────────────────────────────────
  const handleSendEmail = async () => {
    const toEmail = (emailPreviewModal?.profile?.mail || '').trim()
    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      alert(`Adresse email invalide : "${toEmail}". Corrigez-la sur la fiche du profil.`)
      return
    }
    setEmailSending(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-profile-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          to: toEmail,
          subject: emailSubject,
          body: emailBody,
          userEmail: user?.email || '',
        }),
      })
      const result = await res.json()
      if (result.success) {
        setEmailSent(true)
      } else {
        alert(`Erreur envoi : ${JSON.stringify(result.error || result)}`)
      }
    } catch (e) {
      alert(`Erreur : ${e.message}`)
    } finally {
      setEmailSending(false)
    }
  }

  const handleExportCsv = () => {
    const toExport = profiles.filter((p) => selectedIds.has(p.id))
    if (toExport.length === 0) return
    const headers = ['Prénom', 'Nom', 'Employeur', 'Poste', 'URL LinkedIn', 'Score', 'Priorité', 'Stade', 'Maturité', "Date d'import"]
    const rows = toExport.map((p) => [
      escapeCsv(p.fn),
      escapeCsv(p.ln),
      escapeCsv(p.co),
      escapeCsv(p.ti),
      escapeCsv(p.li),
      escapeCsv(p.sc),
      escapeCsv(getPriorityLabel(p.sc)),
      escapeCsv(p.stg),
      escapeCsv(p.mat),
      escapeCsv(p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''),
    ])
    const csv = [headers, ...rows].map((r) => r.join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const today = new Date().toISOString().slice(0, 10)
    const namePart = `${(toExport[0].fn || '')}_${(toExport[0].ln || '')}`.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
    a.download = toExport.length === 1 ? (namePart ? `profil_${namePart}.csv` : 'profil.csv') : `export_profils_${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const headerCellStyle = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#bbb',
    padding: '12px 20px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  }

  const rowStyle = {
    padding: '14px 20px',
    borderBottom: '1px solid rgba(0,0,0,0.04)',
    transition: 'background 0.12s',
    overflow: 'visible',
  }

  return (
    <div style={{ padding: 22, background: '#F5F0E8' }}>
      <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', overflow: 'visible' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>{contactedOnly ? 'Prospects' : 'Tous les profils'}</h1>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 20, background: ACCENT, color: GOLD, fontSize: 12, fontWeight: 600 }}>
            {P.length} profils
          </span>
          {someSelected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', borderRadius: 8, background: 'rgba(210, 171, 118, 0.15)' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: ACCENT }}>{selectedCount} profil(s) sélectionné(s)</span>
              <button type="button" onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: ACCENT, color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 500, border: 'none' }}>
                <IconDownload /> Exporter en CSV
              </button>
              <button type="button" onClick={handleDeleteSelection} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: '#dc2626', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 500, border: 'none' }}>
                <IconTrash /> Supprimer la sélection
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <select value={srcFilter} onChange={(e) => setSrcFilter(e.target.value)} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: '#1A1A1A', cursor: 'pointer', outline: 'none' }}>
              <option value="">Toutes sources</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={stgFilter} onChange={(e) => setStgFilter(e.target.value)} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: '#1A1A1A', cursor: 'pointer', outline: 'none' }}>
              <option value="">Tous stades</option>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={matFilter} onChange={(e) => setMatFilter(e.target.value)} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: '#1A1A1A', cursor: 'pointer', outline: 'none' }}>
              <option value="">Toutes maturités</option>
              <option value="Sans archivés">Sans archivés</option>
              {MATURITIES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto', position: 'relative', zIndex: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'relative', zIndex: 1 }}>
            <tr>
              <th style={{ ...headerCellStyle, width: 100, textAlign: 'left' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
              </th>
              <th style={{ ...headerCellStyle, textAlign: 'left' }}>Profil</th>
              <th style={{ ...headerCellStyle, textAlign: 'left' }}>Source</th>
              <th style={{ ...headerCellStyle, textAlign: 'left' }}>Score</th>
              <th style={{ ...headerCellStyle, textAlign: 'left' }}>Maturité</th>
              <th style={{ ...headerCellStyle, textAlign: 'left' }}>Stade</th>
              <th style={{ ...headerCellStyle, textAlign: 'left' }}>Session</th>
              <th style={{ ...headerCellStyle, textAlign: 'left' }}>Ajouté</th>
            </tr>
          </thead>
          <tbody style={{ position: 'relative', zIndex: 2 }}>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ ...rowStyle, padding: 48, textAlign: 'center', color: '#bbb' }}>Chargement…</td>
              </tr>
            ) : P.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...rowStyle, padding: 48, textAlign: 'center', color: '#bbb' }}>Aucun profil</td>
              </tr>
            ) : (
              P.map((p) => {
                const sessionStr = formatSession(p)
                const scoreStyle = getScoreStyle(p.sc)
                const srcStyle = SOURCE_STYLES[p.src] || { backgroundColor: '#f8fafc', color: '#94a3b8' }
                return (
                  <tr
                    key={p.id}
                    style={{ ...rowStyle, background: selectedIds.has(p.id) ? 'rgba(210, 171, 118, 0.1)' : undefined }}
                    onMouseEnter={(e) => { if (!selectedIds.has(p.id)) e.currentTarget.style.background = '#faf9f7' }}
                    onMouseLeave={(e) => { if (!selectedIds.has(p.id)) e.currentTarget.style.background = '' }}
                  >
                    <td style={{ ...rowStyle, minWidth: 100, width: 100 }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} style={{ cursor: 'pointer', flexShrink: 0 }} onClick={(e) => e.stopPropagation()} />
                        {!contactedOnly && (
                          <button
                            type="button"
                            onClick={(e) => handleSendToR0(e, p)}
                            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1px solid #173731', color: '#173731', background: 'transparent', cursor: 'pointer', position: 'relative', zIndex: 0, flexShrink: 0 }}
                          >
                            R0
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ ...rowStyle, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); navigate(`/profiles/${p.id}`) }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: ACCENT, color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                          {ini(p.fn, p.ln)}
                        </div>
                        <div style={{ minWidth: 0, maxWidth: 350 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>{p.fn} {p.ln}</div>
                          <div style={{ fontSize: 11, color: '#bbb', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[p.co, p.ti, p.city, p.region].filter(Boolean).join(' · ') || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...rowStyle, position: 'relative', zIndex: 3 }} onClick={(e) => e.stopPropagation()}>
                      <div className="source-dropdown" style={{ maxWidth: 130 }}>
                        <InlineDropdown
                          options={SOURCES}
                          value={p.src}
                          onChange={(v) => { changeSource(p.id, v); setOpenDropdownId(null) }}
                          formatDisplay={(v) => ((v === 'Inbound Marketing' || v === 'Inbound') ? 'Inbound Mktg' : v)}
                          buttonClassName=""
                          buttonStyle={{ display: 'inline-block', borderRadius: 20, padding: '3px 7px', fontSize: 10, fontWeight: 600, border: 'none', cursor: 'pointer', maxWidth: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...srcStyle }}
                          open={openDropdownId?.profileId === p.id && openDropdownId?.field === 'source'}
                          onOpenChange={(v) => { if (v) setOpenDropdownId({ profileId: p.id, field: 'source' }); else setOpenDropdownId(null) }}
                          containerClassName="source-dropdown"
                        />
                      </div>
                    </td>
                    <td style={rowStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, fontSize: 12, fontWeight: 700, ...scoreStyle }}>
                        {p.sc ?? '—'}
                      </span>
                    </td>
                    <td style={{ ...rowStyle, position: 'relative', zIndex: 3 }} onClick={(e) => e.stopPropagation()}>
                      <div className="maturite-dropdown">
                        <InlineDropdown
                          options={MATURITIES}
                          value={p.mat}
                          onChange={(v) => {
                            if (v === 'Pas intéressé') {
                              setPasInteresseModalProfile(p)
                              setOpenDropdownId(null)
                              return
                            }
                            if (v === 'Chute') {
                              setChuteModalProfile(p)
                              setOpenDropdownId(null)
                              return
                            }
                            changeMaturity(p.id, v)
                            setOpenDropdownId(null)
                          }}
                          buttonStyle={(v) => ({ borderRadius: 20, padding: '3px 9px', fontSize: 11, border: 'none', cursor: 'pointer', ...(MATURITY_STYLES[v] || { bg: '#f8fafc', color: '#94a3b8' }) })}
                          buttonClassName=""
                          open={openDropdownId?.profileId === p.id && openDropdownId?.field === 'mat'}
                          onOpenChange={(v) => { if (v) setOpenDropdownId({ profileId: p.id, field: 'mat' }); else setOpenDropdownId(null) }}
                          containerClassName="maturite-dropdown"
                        />
                      </div>
                    </td>
                    <td style={rowStyle}>
                      <span style={{ display: 'inline-block', borderRadius: 20, padding: '3px 9px', fontSize: 11, border: 'none', ...(STAGE_STYLES[p.stg] || { backgroundColor: '#f8fafc', color: '#94a3b8' }) }}>
                        {p.stg || '—'}
                      </span>
                    </td>
                    <td style={{ ...rowStyle, fontSize: 11, fontWeight: 500, color: sessionStr ? ACCENT : '#ddd' }}>
                      {sessionStr || '—'}
                    </td>
                    <td style={{ ...rowStyle, fontSize: 11, color: '#ccc' }}>
                      {formatAddedDate(p)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {r0ConfirmProfile && (
        <R0ConfirmModal
          profile={r0ConfirmProfile}
          onClose={() => setR0ConfirmProfile(null)}
          onConfirm={confirmSendToR0}
        />
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
              setPasInteresseModalProfile(null)
              await fetchProfiles()
            }}
          />
        </div>
      )}
      {chuteModalProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setChuteModalProfile(null)}>
          <ChuteRaisonModal
            profile={chuteModalProfile}
            onClose={() => setChuteModalProfile(null)}
            onSaved={async (raison, detail) => {
              await supabase.from('profiles').update({
                maturity: 'Chute',
                chute_stade: chuteModalProfile.stg || 'Avant pipeline',
                chute_type: raison,
                chute_detail: detail || null,
                chute_date: new Date().toISOString(),
              }).eq('id', chuteModalProfile.id)
              changeMaturity(chuteModalProfile.id, 'Chute')
              setChuteModalProfile(null)
              await fetchProfiles()
            }}
          />
        </div>
      )}
      {deleteModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.4)' }} onClick={() => setDeleteModalOpen(false)}>
          <div style={{ background: '#F5F0E8', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: 400, padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 20 }}>
              <span style={{ marginBottom: 12 }}><IconWarning /></span>
              <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px', color: '#1A1A1A' }}>
                {selectedCount === 1 ? 'Supprimer ce profil ?' : `Supprimer ${selectedCount} profils ?`}
              </p>
              <p style={{ fontSize: 13, color: '#6B6B6B', margin: 0 }}>
                {selectedCount === 1
                  ? 'Cette action est irréversible. Le profil sera définitivement supprimé de la base.'
                  : `Cette action est irréversible. Ces ${selectedCount} profils seront définitivement supprimés de la base.`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setDeleteModalOpen(false)} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${ACCENT}`, background: 'transparent', color: ACCENT, cursor: 'pointer' }}>Annuler</button>
              <button type="button" onClick={confirmDelete} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 8, background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer' }}><IconTrash /> Confirmer la suppression</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALE EMAIL PREVIEW ────────────────────────────────────────────── */}
      {emailPreviewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #E5E0D8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: 'Palatino, serif', fontSize: 16, fontWeight: 600, color: '#173731' }}>
                  ✉️ Email au profil
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                  {emailPreviewModal.profile.fn} {emailPreviewModal.profile.ln} · Passage en {emailPreviewModal.newStage}
                </div>
              </div>
              <button type="button" onClick={() => setEmailPreviewModal(null)} style={{ background: 'none', border: 'none', fontSize: 18, color: '#999', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            {/* Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {!emailPreviewModal.profile.mail && (
                <div style={{ background: '#FFF3CD', border: '1px solid #FFC107', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#856404' }}>
                  ⚠️ Ce profil n'a pas d'adresse email renseignée. Ajoutez-en une sur sa fiche avant d'envoyer.
                </div>
              )}
              {emailPreviewModal.calendarUrl && (
                <a
                  href={emailPreviewModal.calendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, marginBottom: 16, textDecoration: 'none', color: '#15803D', fontSize: 12, fontWeight: 500 }}
                >
                  📅 <span>Ajouter au Google Calendar</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>↗</span>
                </a>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Objet</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Message</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={12}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, resize: 'vertical', outline: 'none', lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
              {emailSent && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 13, color: '#15803D', fontWeight: 500 }}>
                  ✅ Email envoyé avec succès à {emailPreviewModal.profile.mail}
                </div>
              )}
            </div>
            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #E5E0D8', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button type="button" onClick={() => setEmailPreviewModal(null)}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E0D8', background: 'white', color: '#666', cursor: 'pointer', fontSize: 13 }}>
                {emailSent ? 'Fermer' : 'Passer'}
              </button>
              {!emailSent && (
                <button type="button"
                  onClick={handleSendEmail}
                  disabled={emailSending || !emailPreviewModal.profile.mail}
                  style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: emailPreviewModal.profile.mail ? '#173731' : '#ccc', color: 'white', cursor: emailPreviewModal.profile.mail ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 500, minWidth: 120 }}>
                  {emailSending ? 'Envoi…' : '✉️ Envoyer'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
