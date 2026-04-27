import { useState, useEffect, useRef } from 'react'
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

const SESSION_CIBLE_STAGES = ['Point Business Plan', "Point d'étape téléphonique", "Point d'étape", 'Démission reconversion', 'R2 Amaury', 'Point juridique', 'Intégration', 'Recruté']

/**
 * Returns the list of stages between fromStage and toStage (exclusive).
 * Used to show the intermediate stages checklist when jumping stages.
 */
function getIntermediateStages(fromStage, toStage) {
  const normalize = (s) => {
    if (s === "Point d'étape téléphonique") return "Point d'étape"
    if (s === 'R2 Baptiste') return 'R2 Amaury'
    return s || ''
  }
  const from = STAGES.indexOf(normalize(fromStage))
  const to = STAGES.indexOf(normalize(toStage))
  if (from < 0 || to < 0 || to - from <= 1) return []
  return STAGES.slice(from + 1, to).map((stage) => ({
    stage,
    checked: true,
    date: '',
  }))
}
const INTEG_MODAL_STAGES = ["Point d'étape", "Point d'étape téléphonique", 'Démission reconversion', 'R2 Amaury', 'Point juridique', 'Recruté']
const INTEG_DATE_STAGES = ["Point d'étape", "Point d'étape téléphonique", 'Démission reconversion', 'R2 Amaury', 'Point juridique', 'Intégration', 'Recruté']
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const ANNEES = [2025, 2026, 2027]
import ScoreCorrectionModal from '../components/ScoreCorrectionModal'
import ChuteModal from '../components/ChuteModal'
import PasInteresseModal from '../components/PasInteresseModal'
import GrilleNotationTab from '../components/GrilleNotationTab'
import AISummaryModal from '../components/AISummaryModal'
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

function formatDateWithYear(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Durée Google Calendar par étape (en minutes) ─────────────────────────────
function getCalendarDuration(stage) {
  const DURATIONS = {
    'R0': 30,
    'R1': 60,
    'Point Business Plan': 30,
    "Point d'étape": 30,
    "Point d'étape téléphonique": 30,
    'R2 Amaury': 60,
    'Point juridique': 60,
    'Démission reconversion': 60,
    'Recruté': 60,
  }
  return DURATIONS[stage] ?? 60
}

// ── Titre Google Calendar par étape ──────────────────────────────────────────
function getCalendarTitle(stage, profile) {
  const prenomNom = `${profile?.fn || ''} ${profile?.ln || ''}`.trim()
  const LABELS = {
    'R0': `${prenomNom} & Evolve — Échange téléphonique`,
    'R1': `${prenomNom} & Evolve — Présentation visio`,
    'Point Business Plan': `${prenomNom} & Evolve — Point Business Plan`,
    "Point d'étape": `${prenomNom} & Evolve — Point d'étape`,
    "Point d'étape téléphonique": `${prenomNom} & Evolve — Point d'étape`,
    'R2 Amaury': `${prenomNom} & Evolve — R2 Amaury`,
    'Point juridique': `${prenomNom} & Evolve — Point juridique`,
    'Démission reconversion': `${prenomNom} & Evolve — Démission reconversion`,
    'Recruté': `${prenomNom} & Evolve — Intégration`,
  }
  return LABELS[stage] || `${prenomNom} & Evolve — ${stage}`
}

// ── Config expéditeurs ────────────────────────────────────────────────────────
const SENDERS_CONFIG = {
  'b.paterac@gmail.com': {
    name: 'Baptiste PATERAC',
    title: 'Associé & Co-fondateur | Responsable de réseau régions',
    email: 'bpaterac@evolveinvestissement.com',
    phone: '06 38 37 59 60',
    photoUrl: 'https://fcwzzrjhmjodterwjbbl.supabase.co/storage/v1/object/public/email-assets/unnamed%20(1).png',
  },
  'agoutard@evolveinvestissement.com': {
    name: 'Aurélien GOUTARD',
    title: 'Associé & Co-fondateur | Responsable de réseau IDF',
    email: 'agoutard@evolveinvestissement.com',
    phone: '06 44 17 51 29',
    photoUrl: 'https://fcwzzrjhmjodterwjbbl.supabase.co/storage/v1/object/public/email-assets/unnamed%20(3).png',
  },
}
const DEFAULT_SENDER_PIPELINE = SENDERS_CONFIG['b.paterac@gmail.com']

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

// ── Templates email par étape ─────────────────────────────────────────────────
function buildEmailForStage(profile, newStage, date, time, rdvType, meetLink, transferLink, cgpContact, bpLink, skipBP, sender = DEFAULT_SENDER_PIPELINE) {
  const prenom = profile.fn || ''
  const prenomNom = `${profile.fn || ''} ${profile.ln || ''}`.trim()
  const d = date ? new Date(date + 'T12:00:00') : null
  const dateStr = d ? d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const heure = time && time !== '12:00' ? time : ''
  const meetLine = meetLink ? `\n🔗 Lien de connexion : ${meetLink}` : ''
  const closing = `\n\nBonne journée à vous,\nBien cordialement,`
  const sig = `\n\n${sender.name}\n${sender.title}\nGroupe Evolve\n${sender.email} | ${sender.phone} | https://groupe-evolve.fr`

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
      // Cas : R1 → Point d'étape (BP sauté)
      subject: `Suite présentation Evolve`,
      body: `${prenom},\n\nJe vous remercie pour notre échange du jour.\n\nVous pouvez retrouver le lien de la présentation téléchargeable sous 3 jours ici : ${transferLink || '[ lien Transfer ]'}\n\nComme convenu, je vous reconfirme notre point d'étape téléphonique du ${dateStr}${heure ? ' à ' + heure : ''}.\n\nJ'ai transmis vos coordonnées à ${cgpContact || '[ Prénom NOM ]'} qui va vous contacter pour fixer un créneau d'échange avec vous.\n\nJe reste à votre disposition pour tout complément d'information d'ici là,${closing}${sig}`,
    } : {
      // Cas standard : Point BP → Point d'étape
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

// ── Éditeur de texte riche (bold, italic, underline, listes, titre) ──────────
function RichTextEditor({ value, onChange, placeholder = 'Saisir le contenu…', minHeight = 340 }) {
  const editorRef = useRef(null)

  // Sync contenu externe → éditeur (ex: changement de template)
  useEffect(() => {
    if (!editorRef.current) return
    if (editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])

  const exec = (cmd, val = null) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
    onChange(editorRef.current?.innerHTML || '')
  }

  const BTNS = [
    { icon: 'G', cmd: 'bold', title: 'Gras (Ctrl+B)', s: { fontWeight: 800 } },
    { icon: 'I', cmd: 'italic', title: 'Italique (Ctrl+I)', s: { fontStyle: 'italic' } },
    { icon: 'S', cmd: 'underline', title: 'Souligné (Ctrl+U)', s: { textDecoration: 'underline' } },
    { icon: null }, // séparateur
    { icon: '•', cmd: 'insertUnorderedList', title: 'Liste à puces' },
    { icon: '1.', cmd: 'insertOrderedList', title: 'Liste numérotée', s: { fontSize: 10, fontFamily: 'monospace' } },
    { icon: null },
    { icon: 'H', cmd: '__heading', title: 'Titre de section', s: { fontWeight: 700, fontFamily: 'serif', fontSize: 13 } },
    { icon: '✕', cmd: 'removeFormat', title: 'Effacer la mise en forme', s: { fontSize: 9, color: '#888' } },
  ]

  const btnStyle = (extra = {}) => ({
    minWidth: 28, height: 28, border: '1px solid #E5E0D8', borderRadius: 4,
    background: 'white', cursor: 'pointer', fontSize: 12,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 6px', transition: 'background 0.1s',
    ...extra,
  })

  const isEmpty = !value || value.replace(/<[^>]*>/g, '').trim() === ''

  return (
    <div style={{ border: '1px solid #E5E0D8', borderRadius: 8, overflow: 'hidden', background: 'white' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 10px', background: '#F5F3EE', borderBottom: '1px solid #E5E0D8', flexWrap: 'wrap' }}>
        {BTNS.map((b, i) => {
          if (!b.icon) return <span key={i} style={{ width: 1, height: 18, background: '#D5D0CA', margin: '0 3px', display: 'inline-block' }} />
          return (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                if (b.cmd === '__heading') exec('formatBlock', '<h3>')
                else exec(b.cmd)
              }}
              title={b.title}
              style={btnStyle(b.s || {})}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#E8E4DF' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
            >
              {b.icon}
            </button>
          )
        })}
      </div>
      {/* Zone de saisie */}
      <div style={{ position: 'relative' }}>
        {isEmpty && (
          <div style={{ position: 'absolute', top: 12, left: 13, fontSize: 13, color: '#bbb', pointerEvents: 'none', userSelect: 'none' }}>
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => onChange(editorRef.current?.innerHTML || '')}
          style={{ minHeight, padding: 12, fontSize: 13, lineHeight: 1.7, outline: 'none', color: '#1A1A1A', overflowY: 'auto' }}
        />
      </div>
    </div>
  )
}

// Helper: affiche le contenu d'une note (HTML ou plain text, avec markdown basique)
function renderNote(content) {
  if (!content) return '—'
  if (/<[a-z][\s\S]*>/i.test(content)) return content // HTML riche
  // Plain text → escape HTML, puis convertir markdown basique
  let html = content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // **gras** → <strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Lignes qui commencent par un emoji suivi d'un titre → header visuel
  html = html.replace(/^((?:📋|💡|🎯|✨|📌|🔑|⚡|📊|🏢|👤|📞|📅|🚀|⭐|💼|🔍|📝|💰|🎓|🏠|❓|✅|⚠|❌|🔄)\s*.+)$/gm,
    '<div style="font-weight:700;font-size:14px;margin:14px 0 6px;color:#173731;border-bottom:1px solid #E5E0D8;padding-bottom:4px">$1</div>')
  // Lignes commençant par - ou • → liste à puces stylée
  html = html.replace(/^[\-•]\s+(.+)$/gm,
    '<div style="padding-left:16px;position:relative;margin:3px 0"><span style="position:absolute;left:4px;color:#D2AB76">•</span>$1</div>')
  // Sauts de ligne restants
  html = html.replace(/\n/g, '<br>')
  return html
}

function KanbanCard({ profile, stage, onClick, isSelected, ownerBadge, nextEvent, onEditDate }) {
  const [expanded, setExpanded] = useState(false)
  const handleClick = () => onClick?.(profile)
  const handleToggle = (e) => {
    e.stopPropagation()
    setExpanded((v) => !v)
  }

  const hasNextEventDate = profile.next_event_date
  const displayDate = hasNextEventDate
    ? formatShortDate(profile.next_event_date)
    : (profile.created_at ? formatShortDate(profile.created_at) : profile.dt || '')
  const dateColor = hasNextEventDate ? '#D2AB76' : '#ccc'
  const dateTitle = hasNextEventDate ? `Prochain événement : ${formatDateWithYear(profile.next_event_date)}` : undefined

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

  // Owner color for left border
  const ownerColor = ownerBadge?.text || borderColor

  return (
    <div
      className={`kanban-card${isSelected ? ' selected' : ''}`}
      draggable={true}
      onDragStart={(e) => e.dataTransfer.setData('profileId', String(profile.id))}
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
        borderRadius: expanded ? 12 : 8,
        border: `1px solid rgba(0,0,0,0.06)`,
        borderLeft: `4px ${(isChute || isPasInteresse) ? 'dashed' : 'solid'} ${ownerColor}`,
        padding: expanded ? 14 : '8px 12px',
        marginBottom: expanded ? 8 : 4,
        cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        overflow: 'hidden',
        opacity: (isChute || isPasInteresse) ? 0.5 : 1,
        boxShadow: isSelected ? '0 0 0 2px #173731' : 'none',
        width: '100%',
      }}
    >
      {/* Ligne compacte (toujours visible) */}
      <div
        onClick={handleToggle}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          {ownerBadge && (
            <span style={{ fontSize: 8, fontWeight: 700, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: ownerBadge.bg, color: ownerBadge.text, flexShrink: 0, letterSpacing: '-0.5px' }} title={ownerBadge.name}>
              {ownerBadge.initial}
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: '#173731', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.fn} {profile.ln}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, ...scoreStyle }}>{profile.sc ?? '—'}</span>
          <span style={{ fontSize: 10, color: '#bbb', transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
        </div>
      </div>

      {/* Contenu déplié */}
      {expanded && (
        <div style={{ marginTop: 10 }}>
          {/* Employeur + Ville */}
          <div style={{ background: 'var(--color-background-secondary)', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 1px' }}>
              {profile.co || profile.company || '—'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0 }}>
              {[profile.city, profile.region].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>

          {/* Badge source */}
          {profile.src && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ display: 'inline-block', borderRadius: 20, padding: '3px 7px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...(SOURCE_STYLES[profile.src] || { backgroundColor: '#f8fafc', color: '#94a3b8' }) }}>
                {profile.src}
              </span>
            </div>
          )}

          {/* Maturité | Date */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 10, borderRadius: 20, padding: '2px 7px', fontWeight: 600, ...matStyle }}>
              {profile.mat}
            </span>
            {stage === 'Recruté' ? (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#16a34a' }}>Intégré ✓</span>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEditDate?.(profile, stage) }}
                title={dateTitle || 'Modifier la date du prochain RDV'}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, color: dateColor }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                <span style={{ fontSize: 10, fontWeight: 600 }}>{displayDate}</span>
                <span style={{ fontSize: 9, opacity: 0.6 }}>✎</span>
              </button>
            )}
          </div>

          {/* Badge session */}
          {sessionLabel && (
            <div style={{ marginTop: 6 }}>
              <span style={{ display: 'inline-block', background: '#f0fdf4', color: '#15803d', fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 20 }}>
                {sessionLabel}
              </span>
            </div>
          )}

          {/* Propriétaire */}
          {ownerBadge && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <span style={{ fontSize: 10, color: ownerBadge.text, fontWeight: 500 }}>{ownerBadge.name}</span>
            </div>
          )}

          {/* Bouton voir profil */}
          <div style={{ marginTop: 10, textAlign: 'right' }}>
            <button
              type="button"
              onClick={handleClick}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #173731', color: '#173731', background: 'transparent', cursor: 'pointer', fontWeight: 500 }}
            >
              Voir le profil →
            </button>
          </div>
        </div>
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

function DroppableColumn({ stage, cards, onCardClick, selectedCardId, onDrop, showOwnerBadge, nextEventsByProfileId, onEditDate }) {
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
            const ownerName = p.owner_full_name?.trim() || (p.owner_email || '').split('@')[0] || ''
            const ownerBadge = (p.owner_email || p.owner_id) ? {
              initial: (ownerName[0] || '?').toUpperCase(),
              name: ownerName,
              ...hashToColor(p.owner_email || String(p.owner_id)),
            } : null
            return <KanbanCard key={p.id} profile={p} stage={stage} onClick={onCardClick} isSelected={p.id === selectedCardId} ownerBadge={ownerBadge} nextEvent={nextEventsByProfileId?.[p.id]} onEditDate={onEditDate} />
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
  const currentSender = SENDERS_CONFIG[user?.email] ?? DEFAULT_SENDER_PIPELINE
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
  const [showAIModal, setShowAIModal] = useState(false)
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
  const [r1ScoringConfirmed, setR1ScoringConfirmed] = useState(false)
  const [intermediateStages, setIntermediateStages] = useState([]) // [{ stage, checked, date }]
  // Date edit modal
  const [dateEditProfile, setDateEditProfile] = useState(null) // { profile, stage }
  const [dateEditValue, setDateEditValue] = useState('')
  const [dateEditTime, setDateEditTime] = useState('')
  const [dateEditRdvType, setDateEditRdvType] = useState('Google Meet')
  const [dateEditNotes, setDateEditNotes] = useState('')
  const [dateEditSaving, setDateEditSaving] = useState(false)
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
  const [stageChangeMeetLink, setStageChangeMeetLink] = useState('')
  const [stageChangeTransferLink, setStageChangeTransferLink] = useState('')
  const [stageChangeCGPContact, setStageChangeCGPContact] = useState('')
  const [stageChangeBPLink, setStageChangeBPLink] = useState('')
  const [emailPreviewModal, setEmailPreviewModal] = useState(null) // { profile, newStage, calendarUrl }
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailTo, setEmailTo] = useState('')
  const [emailPreviewTab, setEmailPreviewTab] = useState('edit') // 'edit' | 'preview'
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
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
      if (!e.target.closest('.source-dropdown')) setShowSourceDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!modalProfile) {
      setShowStadeDropdown(false)
      setShowMaturiteDropdown(false)
      setShowSourceDropdown(false)
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
      supabase.from('activities').select('*').eq('profile_id', modalProfile.id).order('created_at', { ascending: false }).limit(50),
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
    const { data } = await supabase.from('activities').select('*').eq('profile_id', modalProfile.id).order('created_at', { ascending: false }).limit(50)
    setActivities(data || [])
  }

  const loadEvents = async () => {
    if (!modalProfile?.id) return
    const { data } = await supabase.from('events').select('*').eq('profile_id', modalProfile.id).order('created_at', { ascending: false })
    setEvents(data || [])
  }

  const today = () => new Date().toISOString().split('T')[0]

  const handleSaveNote = async () => {
    const plainText = noteContent.replace(/<[^>]*>/g, '').trim()
    if (!modalProfile?.id || !plainText) return
    await supabase.from('notes').insert({
      profile_id: modalProfile.id,
      content: noteContent, // HTML ou plain text
      template: noteTemplate,
      author: userProfile?.full_name?.trim() || user?.email || null,
    })
    await supabase.from('activities').insert({
      profile_id: modalProfile.id,
      type: 'note_added',
      note: plainText.slice(0, 200),
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
    const dateVal = evDate || today()
    await supabase.from('events').insert({
      profile_id: modalProfile.id,
      event_type: evType,
      event_date: dateVal,
      description: evDetail.trim() || null,
    })
    await supabase.from('activities').insert({
      profile_id: modalProfile.id,
      type: 'event_added',
      activity_type: 'event_added',
      note: evType + (evDetail.trim() ? ' — ' + evDetail.trim() : ''),
      date: dateVal,
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
    setEditingEventId(e.id)
    setEditingEventType(e.event_type || 'Autre')
    setEditingEventDate(e.event_date ? e.event_date.split('T')[0] : today())
    setEditingEventDetail(e.description || '')
  }

  const handleSaveEventEdit = async () => {
    if (!editingEventId || !modalProfile?.id) return
    await supabase.from('events').update({
      event_type: editingEventType,
      event_date: editingEventDate,
      description: editingEventDetail || null,
    }).eq('id', editingEventId)
    setEditingEventId(null)
    setEditingEventType('R0')
    setEditingEventDate('')
    setEditingEventDetail('')
    await loadEvents()
  }

  const handleChangeStage = async (v) => {
    const profileId = modalProfile?.id
    if (!profileId) return
    const oldValue = displayProfile?.stg ?? '—'
    if (oldValue === v) return

    // Detect stage jump — route through pendingStageChange modal if jumping
    const intermediate = getIntermediateStages(oldValue, v)
    if (intermediate.length > 0) {
      setIntermediateStages(intermediate)
      setPendingStageChange({ profileId, profile: displayProfile, newStage: v })
      setStageChangeDate('')
      setStageChangeTime('')
      setStageChangeRdType('Google Meet')
      setStageChangeNotes('')
      setStageChangeSkipStep(false)
      setR1ScoringConfirmed(false)
      return
    }

    // Direct 1-step change — apply immediately as before
    changeStage(profileId, v)
    await supabase.from('activities').insert({
      profile_id: profileId,
      activity_type: 'stage_change',
      type: 'stage_change',
      old_value: oldValue,
      new_value: v,
      note: `${oldValue} → ${v}`,
      date: new Date().toISOString().split('T')[0],
      icon: 'refresh',
      source: 'manual',
    })
    const { data } = await supabase.from('activities').select('*').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(10)
    setActivities(data || [])
    if (useSupabase) await fetchProfiles()
    if (v === 'Recruté') {
      setModalProfile(null)
      setSelectedCardId(null)
      setProfileToAssign({ ...displayProfile, session_formation_id: displayProfile.session_formation_id, stg: 'Recruté' })
      setShowSessionModal(true)
    }
  }

  const handleChangeMaturity = async (v) => {
    const profileId = modalProfile?.id
    if (!profileId) return
    console.log('onChange maturité:', profileId, v)
    const oldValue = displayProfile?.mat ?? '—'
    if (oldValue === v) return
    if (v === 'Chute') {
      setChuteModalProfile(displayProfile)
      return
    }
    if (v === 'Pas intéressé') {
      setPasInteresseModalProfile(displayProfile)
      return
    }
    changeMaturity(profileId, v)
    await supabase.from('activities').insert({
      profile_id: profileId,
      type: 'maturity_change',
      note: `${oldValue} → ${v}`,
      date: new Date().toISOString().split('T')[0],
      icon: 'refresh',
      source: 'manual',
    })
    const { data } = await supabase.from('activities').select('*').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(10)
    setActivities(data || [])
    if (useSupabase) await fetchProfiles()
  }

  const handleChangeSource = async (v) => {
    const profileId = modalProfile?.id
    if (!profileId) return
    changeSource(profileId, v)
    setShowSourceDropdown(false)
    await loadActivities()
    if (useSupabase) await fetchProfiles()
  }

  const handleSaveDateEdit = async () => {
    if (!dateEditProfile || !dateEditValue) return
    const { profile, stage } = dateEditProfile
    setDateEditSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const heureParts = (dateEditTime || '09:00').split(':')
    const heure = `${String(parseInt(heureParts[0], 10) || 9).padStart(2, '0')}:${String(parseInt(heureParts[1], 10) || 0).padStart(2, '0')}`
    const newDatetime = `${dateEditValue}T${heure}:00`
    const oldDate = profile.next_event_date ? profile.next_event_date.split('T')[0] : '—'

    // 1. Update profile
    await supabase.from('profiles').update({
      next_event_date: dateEditValue,
      next_event_label: profile.next_event_label || stage,
    }).eq('id', profile.id)
    updateProfile(profile.id, { next_event_date: dateEditValue, next_event_label: profile.next_event_label || stage })

    // 2. Upsert event in events table
    const { data: existingEvent } = await supabase
      .from('events')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('event_type', profile.next_event_label || stage)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const eventDesc = [dateEditRdvType, dateEditNotes].filter(Boolean).join(' · ') || undefined
    if (existingEvent?.id) {
      await supabase.from('events').update({
        event_date: newDatetime,
        ...(eventDesc ? { description: eventDesc } : {}),
      }).eq('id', existingEvent.id)
    } else {
      await supabase.from('events').insert({
        profile_id: profile.id,
        event_type: profile.next_event_label || stage,
        event_date: newDatetime,
        description: eventDesc,
      })
    }

    // 3. Activity for traceability
    await supabase.from('activities').insert({
      profile_id: profile.id,
      activity_type: 'stage_change',
      type: 'field_edit',
      old_value: oldDate,
      new_value: dateEditValue,
      note: `Date ${profile.next_event_label || stage} modifiée : ${oldDate} → ${dateEditValue}`,
      date: today,
      icon: 'calendar',
      source: 'manual',
    })

    // 4. Reload events & activities if modal is open on this profile
    if (modalProfile?.id === profile.id) {
      const [actsRes, evtsRes] = await Promise.all([
        supabase.from('activities').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('events').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }),
      ])
      setActivities(actsRes.data || [])
      setEvents(evtsRes.data || [])
    }

    window.dispatchEvent(new CustomEvent('evolve:event-added'))

    // ── Email preview après confirmation de date ──────────────────────────
    const _stage = profile.next_event_label || stage
    const _heure = heure
    const _skipBP = _stage === "Point d'étape" ? (profile.skip_business_plan || profile.stg !== 'Point Business Plan') : false
    const emailData = buildEmailForStage(profile, _stage, dateEditValue, _heure, dateEditRdvType, '', '', '', '', _skipBP, currentSender)
    setEmailSubject(emailData.subject)
    setEmailBody(emailData.body)
    setEmailTo(profile.mail || '')
    setEmailPreviewTab('edit')
    setEmailSent(false)
    setEmailPreviewModal({ profile, newStage: _stage, calendarUrl: null })
    // ─────────────────────────────────────────────────────────────────────

    setDateEditSaving(false)
    setDateEditProfile(null)
    setDateEditValue('')
    setDateEditTime('')
    setDateEditRdvType('Google Meet')
    setDateEditNotes('')
    fetchProfiles()
  }

  const handleDrop = async (profileId, newStage) => {
    const profile = all.find((p) => String(p.id) === String(profileId))
    if (!profile || profile.stg === newStage) return

    // Always route through pendingStageChange to allow intermediate stage selection
    const intermediate = getIntermediateStages(profile.stg, newStage)
    setIntermediateStages(intermediate)
    setPendingStageChange({ profileId, profile, newStage })
    setStageChangeDate('')
    setStageChangeTime('')
    setStageChangeRdType('Google Meet')
    setStageChangeNotes('')
    setStageChangeSkipStep(false)
    setR1ScoringConfirmed(false)
    setPendingSessionId(profile.session_formation_id || '')
  }

  const handleConfirmStageChange = async () => {
    if (!pendingStageChange) return
    const { profileId, profile, newStage } = pendingStageChange
    const today = new Date().toISOString().split('T')[0]

    // Helper: insert activities for checked intermediate stages
    const insertIntermediateActivities = async () => {
      const checked = intermediateStages.filter((s) => s.checked)
      if (checked.length === 0) return
      await supabase.from('activities').insert(
        checked.map((s) => ({
          profile_id: profile.id,
          activity_type: 'stage_change',
          type: 'stage_change',
          new_value: s.stage,
          note: `Passage en ${s.stage} (rétrospectif)`,
          date: s.date || today,
          icon: 'refresh',
          source: 'manual',
        }))
      )
    }

    if (newStage === 'Recruté') {
      const oldStage = profile.stg ?? '—'
      changeStage(profileId, newStage)
      if (useSupabase) {
        await insertIntermediateActivities()
        const recruteUpdates = { stage: 'Recruté', integration_confirmed: true }
        await supabase.from('profiles').update(recruteUpdates).eq('id', profile.id)
        await supabase.from('activities').insert({
          profile_id: profile.id,
          activity_type: 'stage_change',
          type: 'stage_change',
          old_value: oldStage,
          new_value: 'Recruté',
          note: `${oldStage} → Recruté`,
          date: today,
          icon: 'refresh',
          source: 'manual',
        })
        fetchProfiles()
      }
      setPendingStageChange(null)
      setIntermediateStages([])
      setStageChangeDate('')
      setStageChangeNotes('')
      setProfileToAssign({ id: profile.id, fn: profile.fn, ln: profile.ln, session_formation_id: profile.session_formation_id, stg: 'Recruté' })
      setShowSessionModal(true)
      return
    }
    const oldStage = profile.stg ?? '—'
    changeStage(profileId, newStage)
    if (useSupabase) {
      const dateChoisie = stageChangeDate ? String(stageChangeDate).split('T')[0].trim() : ''
      const heureParts = (stageChangeTime || '12:00').trim().split(':')
      const heureChoisie =
        heureParts.length >= 2
          ? `${String(parseInt(heureParts[0], 10) || 0).padStart(2, '0')}:${String(parseInt(heureParts[1], 10) || 0).padStart(2, '0')}`
          : '12:00'
      const updates = { stage: newStage }
      if (stageChangeSkipStep && newStage === 'Point Business Plan') updates.skip_business_plan = true
      if (stageChangeSkipStep && newStage === 'Démission reconversion') updates.skip_demission = true
      if (dateChoisie) {
        updates.next_event_date = dateChoisie
        updates.next_event_label = newStage
        const targetStage = newStage
        const selectedDate = dateChoisie
        const selectedTime = heureChoisie
        const selectedRdvType = stageChangeRdType || ''
        const notes = stageChangeNotes?.trim() || ''
        console.log('DEBUG event insert:', {
          profile_id: profile?.id,
          event_type: targetStage,
          event_date: selectedDate,
          heure: selectedTime,
          typeRdv: selectedRdvType,
          notes,
        })
        if (profile?.id) {
          const { data: existingEvent } = await supabase
            .from('events')
            .select('id')
            .eq('profile_id', profile.id)
            .eq('event_type', targetStage)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (existingEvent?.id) {
            const { error: updateError } = await supabase
              .from('events')
              .update({
                event_date: `${selectedDate}T${selectedTime || '09:00'}:00`,
                description: [selectedRdvType, notes].filter(Boolean).join(' · '),
              })
              .eq('id', existingEvent.id)
            if (updateError) console.error('ERROR event update:', updateError)
            else console.log('SUCCESS event update:', existingEvent.id)
          } else {
            const { data: eventData, error: eventError } = await supabase
              .from('events')
              .insert({
                profile_id: profile.id,
                event_type: targetStage,
                event_date: `${selectedDate}T${selectedTime || '09:00'}:00`,
                description: [selectedRdvType, notes].filter(Boolean).join(' · ') || null,
              })
              .select()
            if (eventError) console.error('ERROR event insert:', eventError)
            else console.log('SUCCESS event insert:', eventData)
          }
        } else {
          console.error('DEBUG event insert: profile.id manquant, insert events ignoré')
        }
        window.dispatchEvent(new CustomEvent('evolve:event-added'))
      }
      await supabase.from('profiles').update(updates).eq('id', profile.id)
      if (dateChoisie) {
        updateProfile(profile.id, { next_event_date: dateChoisie, next_event_label: newStage })
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
      await insertIntermediateActivities()
      await supabase.from('activities').insert({
        profile_id: profile.id,
        activity_type: 'stage_change',
        type: 'stage_change',
        old_value: oldStage,
        new_value: newStage,
        note: `${oldStage} → ${newStage}`,
        date: today,
        icon: 'refresh',
        source: 'manual',
      })
      // Reload activities for the open modal panel
      if (modalProfile?.id === profile.id) {
        const { data: freshActs } = await supabase.from('activities').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(50)
        setActivities(freshActs || [])
      }
      fetchProfiles()
    }
    // ── Email preview + Google Calendar ─────────────────────────────────────
    const _dateChoisie = stageChangeDate ? String(stageChangeDate).split('T')[0].trim() : ''
    const _heureParts = (stageChangeTime || '12:00').trim().split(':')
    const _heureChoisie = _heureParts.length >= 2
      ? `${String(parseInt(_heureParts[0], 10) || 0).padStart(2, '0')}:${String(parseInt(_heureParts[1], 10) || 0).padStart(2, '0')}`
      : '12:00'
    const _rdvType = stageChangeRdType || 'Google Meet'
    const _meetLink = stageChangeMeetLink?.trim() || ''
    const _skipBP2 = newStage === "Point d'étape" ? (profile.skip_business_plan || profile.stg !== 'Point Business Plan') : false
    const emailData = buildEmailForStage(profile, newStage, _dateChoisie, _heureChoisie, _rdvType, _meetLink, stageChangeTransferLink?.trim(), stageChangeCGPContact?.trim(), stageChangeBPLink?.trim(), _skipBP2, currentSender)
    const calUrl = _dateChoisie ? buildGoogleCalendarUrl({
      title: getCalendarTitle(newStage, profile),
      date: _dateChoisie,
      time: _heureChoisie,
      description: emailData.body,
      guest: profile.mail?.trim() || '',
      durationMin: getCalendarDuration(newStage),
    }) : null
    setEmailSubject(emailData.subject)
    setEmailBody(emailData.body)
    setEmailTo(profile.mail || '')
    setEmailPreviewTab('edit')
    setEmailSent(false)
    setEmailPreviewModal({ profile, newStage, calendarUrl: calUrl })
    // ────────────────────────────────────────────────────────────────────────
    setStageChangeDate('')
    setStageChangeTime('')
    setStageChangeRdType('Google Meet')
    setStageChangeNotes('')
    setStageChangeSkipStep(false)
    setPendingSessionId('')
    setPendingSessions([])
    setIntermediateStages([])
    setPendingStageChange(null)
  }

  const handleSkipStageChangeDate = async () => {
    if (!pendingStageChange) return
    const { profileId, profile, newStage } = pendingStageChange
    const today = new Date().toISOString().split('T')[0]

    const insertIntermediateActivities = async () => {
      const checked = intermediateStages.filter((s) => s.checked)
      if (checked.length === 0) return
      await supabase.from('activities').insert(
        checked.map((s) => ({
          profile_id: profile.id,
          activity_type: 'stage_change',
          type: 'stage_change',
          new_value: s.stage,
          note: `Passage en ${s.stage} (rétrospectif)`,
          date: s.date || today,
          icon: 'refresh',
          source: 'manual',
        }))
      )
    }

    if (newStage === 'Recruté') {
      const oldStage = profile.stg ?? '—'
      changeStage(profileId, newStage)
      if (useSupabase) {
        await insertIntermediateActivities()
        const recruteUpdates = { stage: 'Recruté', integration_confirmed: true }
        await supabase.from('profiles').update(recruteUpdates).eq('id', profile.id)
        await supabase.from('activities').insert({
          profile_id: profile.id,
          activity_type: 'stage_change',
          type: 'stage_change',
          old_value: oldStage,
          new_value: 'Recruté',
          note: `${oldStage} → Recruté`,
          date: today,
          icon: 'refresh',
          source: 'manual',
        })
        fetchProfiles()
      }
      setPendingStageChange(null)
      setIntermediateStages([])
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
      await insertIntermediateActivities()
      await supabase.from('activities').insert({
        profile_id: profile.id,
        activity_type: 'stage_change',
        type: 'stage_change',
        old_value: oldStage,
        new_value: newStage,
        note: `${oldStage} → ${newStage}`,
        date: today,
        icon: 'refresh',
        source: 'manual',
      })
      // Reload activities + events pour le panneau profil ouvert
      if (String(modalProfile?.id) === String(profile.id)) {
        const [freshActs, freshEvts] = await Promise.all([
          supabase.from('activities').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(50),
          supabase.from('events').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }),
        ])
        setActivities(freshActs.data || [])
        setEvents(freshEvts.data || [])
      }
      fetchProfiles()
    }
    // ── Email preview (pas de date dans ce cas) ──────────────────────────────
    const _skipBP3 = newStage === "Point d'étape" ? (profile.skip_business_plan || profile.stg !== 'Point Business Plan') : false
    const emailData = buildEmailForStage(profile, newStage, '', '', '', '', stageChangeTransferLink?.trim(), stageChangeCGPContact?.trim(), stageChangeBPLink?.trim(), _skipBP3, currentSender)
    setEmailSubject(emailData.subject)
    setEmailBody(emailData.body)
    setEmailTo(profile.mail || '')
    setEmailPreviewTab('edit')
    setEmailSent(false)
    setEmailPreviewModal({ profile, newStage, calendarUrl: null })
    // ────────────────────────────────────────────────────────────────────────
    setStageChangeDate('')
    setStageChangeTime('')
    setStageChangeRdType('Google Meet')
    setStageChangeNotes('')
    setStageChangeMeetLink('')
    setStageChangeTransferLink('')
    setStageChangeCGPContact('')
    setStageChangeBPLink('')
    setStageChangeSkipStep(false)
    setPendingSessionId('')
    setPendingSessions([])
    setIntermediateStages([])
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

  // ── Envoi email via Edge Function Resend ─────────────────────────────────
  const handleSendEmail = async () => {
    const toEmail = emailTo.trim()
    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      alert(`Adresse email invalide : "${toEmail}".`)
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

  // Constantes partagées entre les modals
  const TIME_SLOTS = Array.from({ length: 19 }, (_, i) => {
    const h = 9 + Math.floor(i / 2)
    const m = (i % 2) * 30
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  })
  const RDV_TYPES = ['Google Meet', 'Téléphone', 'Présentiel']

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
                  // Force un rechargement si c'est le même profil déjà ouvert
                  if (String(modalProfile?.id) === String(p.id)) {
                    Promise.all([
                      supabase.from('activities').select('*').eq('profile_id', p.id).order('created_at', { ascending: false }).limit(50),
                      supabase.from('events').select('*').eq('profile_id', p.id).order('created_at', { ascending: false }),
                    ]).then(([actsRes, evtsRes]) => {
                      setActivities(actsRes.data || [])
                      setEvents(evtsRes.data || [])
                    })
                  }
                  setModalProfile(p)
                  setSelectedCardId(p.id)
                }}
                selectedCardId={selectedCardId}
                onDrop={handleDrop}
                showOwnerBadge={true}
                nextEventsByProfileId={nextEventsByProfileId}
                onEditDate={(p, stg) => {
                  setDateEditProfile({ profile: p, stage: stg })
                  setDateEditValue(p.next_event_date ? p.next_event_date.split('T')[0] : '')
                  setDateEditTime(p.next_event_date ? (p.next_event_date.split('T')[1] || '').slice(0, 5) || '' : '')
                  setDateEditRdvType('Google Meet')
                  setDateEditNotes('')
                }}
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
                <select
                  value={displayProfile.mat || ''}
                  onChange={(e) => handleChangeMaturity(e.target.value)}
                  style={{
                    padding: '4px 8px', fontSize: 13, borderRadius: 6,
                    border: '1px solid #ccc', cursor: 'pointer',
                    background: '#173731', color: '#E7E0D0',
                  }}
                >
                  {MATURITIES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select
                  value={displayProfile.stg || ''}
                  onChange={(e) => handleChangeStage(e.target.value)}
                  style={{
                    padding: '4px 8px', fontSize: 13, borderRadius: 6,
                    border: '1px solid #ccc', cursor: 'pointer',
                    background: '#D2AB76', color: '#173731',
                  }}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={displayProfile.src || ''}
                  onChange={(e) => handleChangeSource(e.target.value)}
                  style={{
                    padding: '4px 8px', fontSize: 13, borderRadius: 6,
                    border: '1px solid #ccc', cursor: 'pointer',
                  }}
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
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
                  <span style={{ flexShrink: 0, width: 14, height: 14, display: 'flex' }}><IconEnvelope /></span>
                  {editingField === 'mail2' ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0 }}>
                      <input type="email" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveFieldEdit()} autoFocus style={{ flex: 1, padding: '4px 8px', fontSize: 12, border: '2px solid #173731', borderRadius: 6, outline: 'none' }} />
                      <button type="button" onClick={handleSaveFieldEdit} style={{ padding: '4px 10px', background: '#173731', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✓</button>
                    </div>
                  ) : (
                    <span onClick={() => startEditField('mail2', displayProfile.mail2)} style={{ color: displayProfile.mail2 ? '#173731' : '#bbb', textDecoration: displayProfile.mail2 ? 'underline' : 'none', cursor: 'pointer', fontSize: 12 }}>
                      {displayProfile.mail2 || '+ Mail 2 (personnel)'}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flexShrink: 0, fontSize: 13, lineHeight: 1 }}>📞</span>
                  {editingField === 'phone' ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0 }}>
                      <input type="tel" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveFieldEdit()} autoFocus style={{ flex: 1, padding: '4px 8px', fontSize: 12, border: '2px solid #173731', borderRadius: 6, outline: 'none' }} />
                      <button type="button" onClick={handleSaveFieldEdit} style={{ padding: '4px 10px', background: '#173731', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>✓</button>
                    </div>
                  ) : (
                    <span
                      onClick={() => startEditField('phone', displayProfile.phone)}
                      style={{ color: displayProfile.phone ? '#173731' : '#bbb', cursor: 'pointer', fontSize: 12 }}
                      title="Cliquer pour modifier"
                    >
                      {displayProfile.phone || '+ Ajouter un téléphone'}
                    </span>
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
              {/* ── Paternité ── */}
              {(() => {
                // Construire la liste des utilisateurs connus depuis tous les profils chargés
                const knownUsers = [...new Map(
                  filteredProfiles
                    .filter(p => p.owner_id)
                    .map(p => [p.owner_id, { id: p.owner_id, email: p.owner_email || '', name: p.owner_full_name?.trim() || (p.owner_email || '').split('@')[0] || 'Inconnu' }])
                ).values()]
                // Ajouter l'utilisateur courant s'il n'est pas encore dans la liste
                if (user?.id && !knownUsers.find(u => u.id === user.id)) {
                  knownUsers.push({ id: user.id, email: user.email || '', name: userProfile?.full_name?.trim() || (user.email || '').split('@')[0] || 'Moi' })
                }
                const currentOwner = knownUsers.find(u => u.id === displayProfile.owner_id) || null
                return (
                  <div style={{ marginTop: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Paternité</label>
                    <select
                      value={displayProfile.owner_id || ''}
                      onChange={async (e) => {
                        const selectedId = e.target.value
                        const selectedUser = knownUsers.find(u => u.id === selectedId)
                        if (!selectedUser) return
                        await supabase.from('profiles').update({
                          owner_id: selectedUser.id,
                          owner_email: selectedUser.email,
                          owner_full_name: selectedUser.name,
                        }).eq('id', displayProfile.id)
                        await fetchProfiles()
                        showNotif(`Paternité → ${selectedUser.name}`)
                      }}
                      style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #E5E0D8', borderRadius: 8, background: 'white', cursor: 'pointer', outline: 'none', color: '#1A1A1A' }}
                    >
                      {!displayProfile.owner_id && <option value="">— Non assigné —</option>}
                      {knownUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.id === user?.id ? `${u.name} (vous)` : u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })()}

              <div style={{ flex: 1, minHeight: 16 }} />
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
                <>
                  {/* Barre d'actions — fixe, hors scroll */}
                  <div style={{ padding: '10px 24px', borderBottom: '1px solid #F0EDE8', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setShowAIModal(true)}
                      style={{ padding: '7px 14px', borderRadius: 8, background: 'white', color: '#173731', border: '1px solid #D2AB76', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    >
                      ✨ Récap IA
                    </button>
                    {!showNoteForm && (
                      <button
                        type="button"
                        onClick={() => setShowNoteForm(true)}
                        style={{ padding: '7px 14px', borderRadius: 8, background: '#173731', color: '#E7E0D0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                      >
                        + Nouvelle note
                      </button>
                    )}
                  </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
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
                      <RichTextEditor
                        value={noteContent}
                        onChange={setNoteContent}
                        placeholder="Saisir le contenu de la note…"
                        minHeight={340}
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
                          <RichTextEditor
                            value={editingNoteContent}
                            onChange={setEditingNoteContent}
                            minHeight={340}
                          />
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
                                <div
                                  className="rich-note-content"
                                  style={{ marginTop: 12, padding: 12, background: '#F8F5F1', borderRadius: 8, fontSize: 13, color: '#1A1A1A', lineHeight: 1.7 }}
                                  onClick={(e) => e.stopPropagation()}
                                  dangerouslySetInnerHTML={{ __html: renderNote(n.content) }}
                                />
                              )}
                            </div>
                            <span style={{ flexShrink: 0, fontSize: 12, color: '#6B6B6B', transition: 'transform 0.2s', transform: expandedNoteId === n.id ? 'rotate(180deg)' : 'none' }}>▾</span>
                          </div>
                          {expandedNoteId === n.id && (
                            <div className="pipeline-note-actions" style={{ display: 'flex', gap: 6, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
                              <button type="button" onClick={() => { setEditingNoteId(n.id); setEditingNoteContent(n.content || ''); }} style={{ padding: '3px 10px', fontSize: 12, color: '#173731', background: 'transparent', border: '1px solid #E5E0D8', borderRadius: 6, cursor: 'pointer' }}>Éditer</button>
                              <button type="button" onClick={() => {
                                const plain = (n.content || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                                navigator.clipboard.writeText(plain)
                                const btn = document.getElementById(`copy-note-${n.id}`)
                                if (btn) { btn.textContent = '✅'; setTimeout(() => { btn.textContent = '📋' }, 1500) }
                              }} id={`copy-note-${n.id}`} style={{ padding: '3px 10px', fontSize: 14, background: 'transparent', border: '1px solid #E5E0D8', borderRadius: 6, cursor: 'pointer', lineHeight: 1 }} title="Copier la note">📋</button>
                              <button type="button" onClick={() => setConfirmDeleteNote({ id: n.id, content: n.content })} style={{ padding: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', display: 'inline-flex' }} title="Supprimer"><IconTrash /></button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                </>
              ) : modalTab === 'activity' ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: 24, position: 'relative', paddingLeft: 28 }}>
                  <div style={{ position: 'absolute', left: 6, top: 0, bottom: 0, width: 1, background: '#E5E0D8' }} />
                  {activities.length === 0 ? (
                    <div style={{ color: '#6B6B6B', fontSize: 13 }}>Aucune activité</div>
                  ) : (
                    <>
                      {activities.map((a) => {
                        const typeLabel = a.activity_type === 'score_corrected' ? 'Score' : { stage_change: 'Stade', note_added: 'Note', maturity_change: 'Maturité', source_change: 'Source', region_change: 'Région', field_edit: 'Modification' }[a.type] || 'Activité'
                        const rawNote = a.note || a.activity_type || a.old_value || a.new_value || '—'
                        const isRetro = typeof rawNote === 'string' && rawNote.includes('(rétrospectif)')
                        const title = isRetro ? rawNote.replace(' (rétrospectif)', '') : rawNote
                        return (
                          <div key={a.id} style={{ position: 'relative', marginBottom: 16 }}>
                            <div style={{ position: 'absolute', left: -22, top: 4, width: 10, height: 10, borderRadius: '50%', background: isRetro ? '#D2AB76' : '#173731', border: '2px solid #fff' }} />
                            <div style={{ background: isRetro ? '#FFFDF7' : '#F9F7F4', borderRadius: 8, border: `0.5px solid ${isRetro ? '#F0DDB0' : '#E5E0D8'}`, padding: '10px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#EEF4FB', color: '#185FA5', border: '0.5px solid #B5D4F4', fontWeight: 500 }}>
                                    {typeLabel}
                                  </span>
                                  {isRetro && (
                                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>
                                      rétrospectif
                                    </span>
                                  )}
                                  <span style={{ fontSize: 13, fontWeight: 500, color: '#0D1117' }}>{title}</span>
                                </div>
                                <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{formatActivityDate(a.created_at)}</span>
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
                  {!showEventForm && events.length === 0 && activities.filter((a) => (a.type === 'stage_change' || a.activity_type === 'stage_change') && a.new_value).length === 0 && (
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
                      <div style={{ marginBottom: 12 }}>
                        <RichTextEditor value={evDetail} onChange={setEvDetail} placeholder="Décrivez le déroulé, les points clés, les prochaines étapes..." minHeight={150} />
                      </div>
                      <button type="button" onClick={handleAddEvent} style={{ padding: '8px 16px', borderRadius: 8, background: '#D2AB76', color: '#173731', border: 'none', cursor: 'pointer', fontSize: 13 }}>Ajouter</button>
                    </div>
                  )}
                  {/* ── PARCOURS PIPELINE (dérivé des activités stage_change) ── */}
                  {(() => {
                    // Cherche dans activity_type ET type (CRMContext n'insère que activity_type,
                    // Pipeline insère les deux — on veut capturer les deux sources)
                    const stageActs = activities
                      .filter((a) => (a.type === 'stage_change' || a.activity_type === 'stage_change') && a.new_value)
                      // Déduplique si les deux inserts ont créé un doublon pour la même transition
                      .filter((a, i, arr) => arr.findIndex((b) => b.new_value === a.new_value && Math.abs(new Date(b.created_at) - new Date(a.created_at)) < 5000) === i)
                      .slice()
                      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                    if (stageActs.length === 0) return null
                    const STAGE_ICONS = { 'R0': '📞', 'R1': '🤝', 'Point Business Plan': '📊', "Point d'étape": '🔄', 'Démission reconversion': '✈️', 'R2 Amaury': '🏆', 'Point juridique': '⚖️', 'Recruté': '🎉' }
                    return (
                      <div style={{ background: '#F5F3EE', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#173731', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          🗺️ Parcours pipeline
                          <span style={{ fontSize: 10, fontWeight: 400, color: '#888' }}>— historique des étapes</span>
                        </div>
                        <div style={{ position: 'relative', paddingLeft: 20 }}>
                          <div style={{ position: 'absolute', left: 4, top: 4, bottom: 4, width: 1, background: '#D2AB76' }} />
                          {stageActs.map((a, i) => {
                            const isRetro = (a.note || '').includes('rétrospectif')
                            const dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
                            const icon = STAGE_ICONS[a.new_value] || '📍'
                            const isLast = i === stageActs.length - 1
                            return (
                              <div key={a.id} style={{ position: 'relative', marginBottom: isLast ? 0 : 8 }}>
                                <div style={{ position: 'absolute', left: -16, top: 3, width: 8, height: 8, borderRadius: '50%', background: isLast ? '#173731' : '#D2AB76', border: '2px solid #F5F3EE' }} />
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 13 }}>{icon}</span>
                                    <span style={{ fontSize: 12, fontWeight: isLast ? 700 : 500, color: isLast ? '#173731' : '#444' }}>{a.new_value}</span>
                                    {isRetro && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 20, background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>retro</span>}
                                  </div>
                                  <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{dateStr}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* ── ÉVÉNEMENTS MANUELS ── */}
                  {events.map((e) => {
                    // Compatibilité anciens champs (content/date) et nouveaux (event_type/event_date/description)
                    const evTitle = e.event_type || (e.content || '').split(' — ')[0] || 'Événement'
                    const evDateRaw = e.event_date || e.date
                    const evDateStr = evDateRaw
                      ? new Date(evDateRaw).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                      : (e.created_at ? new Date(e.created_at).toLocaleDateString('fr-FR') : '')
                    const evTimeStr = e.event_date && e.event_date.includes('T')
                      ? new Date(e.event_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                      : null
                    const evBody = e.description || e.content || null
                    return (
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
                            <div style={{ marginBottom: 12 }}>
                              <RichTextEditor value={editingEventDetail} onChange={setEditingEventDetail} placeholder="Décrivez le déroulé, les points clés, les prochaines étapes..." minHeight={150} />
                            </div>
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
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{evTitle}</div>
                                <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 4 }}>
                                  {evDateStr}{evTimeStr ? ` · ${evTimeStr}` : ''}
                                </div>
                                {expandedEventId === e.id && evBody && (
                                  <div style={{ marginTop: 12, padding: 12, background: '#F8F5F1', borderRadius: 8, fontSize: 13, color: '#1A1A1A', whiteSpace: 'pre-wrap' }} onClick={(ev) => ev.stopPropagation()}>
                                    {evBody}
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
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Récap IA */}
      {showAIModal && modalProfile && (
        <AISummaryModal
          profile={modalProfile}
          onClose={() => setShowAIModal(false)}
          onSave={async (content) => {
            await supabase.from('notes').insert({
              profile_id: modalProfile.id,
              content,
              template: 'Récap IA',
              author: userProfile?.full_name?.trim() || user?.email || null,
            })
            await loadNotes()
          }}
        />
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
        const { profile, newStage } = pendingStageChange
        const currentStage = profile.stg || 'R0'
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setPendingStageChange(null)}>
            <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', width: '100%', maxWidth: 440, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
              {/* Header — fixe */}
              <div style={{ background: '#173731', padding: '16px 20px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: '#D2AB76', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(210,171,118,0.5)' }}>Pipeline</span>
                </div>
                <div style={{ fontFamily: 'Palatino, "Palatino Linotype", "Book Antiqua", serif', fontSize: 18, fontWeight: 600, color: '#E7E0D0' }}>Passage en {newStage}</div>
                <div style={{ fontSize: 13, color: 'rgba(231,224,208,0.9)', marginTop: 4 }}>{profile.fn} {profile.ln} · {profile.co || '—'}</div>
              </div>
              {/* Corps — scrollable */}
              <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
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

                {/* ── ÉTAPES INTERMÉDIAIRES SAUTÉES ── */}
                {intermediateStages.length > 0 && (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#92400E', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚡</span>
                      <span>Étapes sautées — lesquelles ont eu lieu ?</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#B45309', marginBottom: 10 }}>
                      Cochez les étapes réalisées (même informellement) pour ne pas biaiser les analytics.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {intermediateStages.map((s, i) => (
                        <div key={s.stage} style={{ background: 'white', border: `1px solid ${s.checked ? '#D2AB76' : '#E5E0D8'}`, borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: s.checked ? 6 : 0 }}>
                            <input
                              type="checkbox"
                              id={`inter-${i}`}
                              checked={s.checked}
                              onChange={(e) => {
                                setIntermediateStages((prev) => prev.map((p, pi) => pi === i ? { ...p, checked: e.target.checked } : p))
                              }}
                              style={{ width: 15, height: 15, accentColor: '#173731', flexShrink: 0 }}
                            />
                            <label htmlFor={`inter-${i}`} style={{ fontSize: 12, fontWeight: 600, color: '#173731', cursor: 'pointer', flex: 1 }}>{s.stage}</label>
                          </div>
                          {s.checked && (
                            <div style={{ marginLeft: 23 }}>
                              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Date (optionnel)</label>
                              <input
                                type="date"
                                value={s.date}
                                onChange={(e) => {
                                  setIntermediateStages((prev) => prev.map((p, pi) => pi === i ? { ...p, date: e.target.value } : p))
                                }}
                                style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #E5E0D8', borderRadius: 4, width: '100%' }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── RAPPEL GRILLE DE NOTATION (R1 → étape suivante) ── */}
                {currentStage === 'R1' && (
                  <div style={{
                    background: r1ScoringConfirmed ? '#F0FDF4' : '#FFFBEB',
                    border: `1px solid ${r1ScoringConfirmed ? '#BBF7D0' : '#FDE68A'}`,
                    borderRadius: 8,
                    padding: '12px 14px',
                    marginBottom: 16,
                  }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{r1ScoringConfirmed ? '✅' : '📋'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: r1ScoringConfirmed ? '#166534' : '#92400E', marginBottom: 4 }}>
                          Grille de notation — à remplir avant de passer à l'étape suivante
                        </div>
                        <div style={{ fontSize: 11, color: r1ScoringConfirmed ? '#15803D' : '#B45309', marginBottom: 10, lineHeight: 1.4 }}>
                          Assurez-vous d'avoir évalué ce profil dans l'onglet <strong>Grille de notation</strong> : motivation, projet, expérience, potentiel réseau.
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={r1ScoringConfirmed}
                            onChange={(e) => setR1ScoringConfirmed(e.target.checked)}
                            style={{ width: 15, height: 15, accentColor: '#173731' }}
                          />
                          <span style={{ fontSize: 12, color: '#444', fontWeight: 500 }}>J'ai bien rempli la grille de notation</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

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
                {stageChangeRdType === 'Google Meet' && (
                  <div style={{ marginBottom: 16 }}>
                    {/* Bouton créer dans Google Calendar pour récupérer le lien Meet */}
                    {stageChangeDate && (() => {
                      const heureParts = (stageChangeTime || '09:00').split(':')
                      const h = String(parseInt(heureParts[0]) || 9).padStart(2, '0')
                      const min = String(parseInt(heureParts[1]) || 0).padStart(2, '0')
                      const _dateStr = String(stageChangeDate).split('T')[0]
                      const _timeStr = `${h}:${min}`
                      const previewEmail = buildEmailForStage(
                        pendingStageChange?.profile || {},
                        newStage,
                        _dateStr,
                        _timeStr,
                        stageChangeRdType || 'Google Meet',
                        stageChangeMeetLink?.trim() || '',
                        stageChangeTransferLink?.trim() || '',
                        stageChangeCGPContact?.trim() || '',
                        stageChangeBPLink?.trim() || '',
                        newStage === "Point d'étape" ? (pendingStageChange?.profile?.skip_business_plan || pendingStageChange?.profile?.stg !== 'Point Business Plan') : false,
                        currentSender
                      )
                      const calUrl = buildGoogleCalendarUrl({
                        title: getCalendarTitle(newStage, pendingStageChange?.profile || {}),
                        date: _dateStr,
                        time: _timeStr,
                        description: previewEmail.body,
                        guest: pendingStageChange?.profile?.mail?.trim() || '',
                        durationMin: getCalendarDuration(newStage),
                      })
                      return (
                        <a
                          href={calUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, marginBottom: 10, textDecoration: 'none', color: '#15803D', fontSize: 12, fontWeight: 500 }}
                        >
                          📅 <span>Créer l'événement dans Google Calendar</span>
                          <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>↗ Génère un lien Meet</span>
                        </a>
                      )
                    })()}
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>
                      🔗 Lien Google Meet
                      <span style={{ fontWeight: 400, color: '#AAA', marginLeft: 4 }}>(coller après création de l'événement)</span>
                    </label>
                    <input
                      type="url"
                      value={stageChangeMeetLink}
                      onChange={(e) => setStageChangeMeetLink(e.target.value)}
                      placeholder="https://meet.google.com/xxx-xxxx-xxx"
                      style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, boxSizing: 'border-box' }}
                    />
                  </div>
                )}
                {/* Lien Transfer — Point Business Plan */}
                {newStage === 'Point Business Plan' && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>📎 Lien Transfer (présentation)</label>
                    <input type="url" value={stageChangeTransferLink} onChange={(e) => setStageChangeTransferLink(e.target.value)} placeholder="https://we.tl/..." style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, boxSizing: 'border-box' }} />
                  </div>
                )}
                {/* Point d'étape — contact CGP + lien BP */}
                {newStage === "Point d'étape" && (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>👤 Contact CGP à transmettre</label>
                      <input type="text" value={stageChangeCGPContact} onChange={(e) => setStageChangeCGPContact(e.target.value)} placeholder="Prénom NOM" style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>📄 Lien Google Drive — Business Plan</label>
                      <input type="url" value={stageChangeBPLink} onChange={(e) => setStageChangeBPLink(e.target.value)} placeholder="https://docs.google.com/..." style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, boxSizing: 'border-box' }} />
                    </div>
                  </>
                )}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>Notes (optionnel)</label>
                  <RichTextEditor value={stageChangeNotes} onChange={setStageChangeNotes} placeholder="Notes…" minHeight={90} />
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
                    <label style={{ fontSize: 12, fontWeight: 500, color: '#666', display: 'block', marginBottom: 4 }}>Session cible (optionnel)</label>
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
              </div>
              {/* Footer — fixe */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid #E5E0D8', flexShrink: 0, display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', background: 'white' }}>
                <button type="button" onClick={() => { setPendingStageChange(null); setIntermediateStages([]) }} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#6B6B6B' }}>Annuler</button>
                <button type="button" onClick={handleSkipStageChangeDate} style={{ padding: '6px 12px', fontSize: 12, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}>Sans date</button>
                <button
                  type="button"
                  onClick={handleConfirmStageChange}
                  disabled={!stageChangeDate.trim() || !stageChangeTime || (currentStage === 'R1' && !r1ScoringConfirmed)}
                  title={currentStage === 'R1' && !r1ScoringConfirmed ? 'Confirmez avoir rempli la grille de notation' : undefined}
                  style={{
                    padding: '8px 16px',
                    fontSize: 13,
                    border: 'none',
                    borderRadius: 6,
                    background: '#173731',
                    color: '#E7E0D0',
                    cursor: (stageChangeDate.trim() && stageChangeTime && (currentStage !== 'R1' || r1ScoringConfirmed)) ? 'pointer' : 'not-allowed',
                    opacity: (stageChangeDate.trim() && stageChangeTime && (currentStage !== 'R1' || r1ScoringConfirmed)) ? 1 : 0.4,
                  }}
                >Confirmer →</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── MODAL MODIFICATION DE DATE ── */}
      {dateEditProfile && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => !dateEditSaving && setDateEditProfile(null)}
        >
          <div
            style={{ background: 'white', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', width: 400, maxWidth: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #E5E0D8', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#173731', marginBottom: 2 }}>
                Modifier la date — {dateEditProfile.stage}
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>
                {dateEditProfile.profile.fn} {dateEditProfile.profile.ln}
              </div>
            </div>

            {/* Body — scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {/* Date + Time */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>Date</label>
                  <input
                    type="date"
                    value={dateEditValue}
                    onChange={(e) => setDateEditValue(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>Heure</label>
                  <select
                    value={dateEditTime}
                    onChange={(e) => setDateEditTime(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, background: 'white' }}
                  >
                    <option value="">—</option>
                    {TIME_SLOTS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Type de RDV */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>Type de RDV</label>
                <select
                  value={dateEditRdvType}
                  onChange={(e) => setDateEditRdvType(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, background: 'white' }}
                >
                  {RDV_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 4 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>Notes (optionnel)</label>
                <RichTextEditor value={dateEditNotes} onChange={setDateEditNotes} placeholder="Contexte, préparation…" minHeight={90} />
              </div>

              {/* Info traçabilité */}
              <div style={{ marginTop: 10, padding: '8px 10px', background: '#F5F3EE', borderRadius: 6, fontSize: 11, color: '#888', lineHeight: 1.4 }}>
                📋 Cette modification sera enregistrée dans les événements et activités du profil pour la traçabilité.
              </div>
            </div>

            {/* Footer — fixe */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #E5E0D8', flexShrink: 0, display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'white' }}>
              <button
                type="button"
                onClick={() => setDateEditProfile(null)}
                disabled={dateEditSaving}
                style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#6B6B6B' }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveDateEdit}
                disabled={!dateEditValue || dateEditSaving}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  border: 'none',
                  borderRadius: 6,
                  background: '#173731',
                  color: '#E7E0D0',
                  cursor: (!dateEditValue || dateEditSaving) ? 'not-allowed' : 'pointer',
                  opacity: (!dateEditValue || dateEditSaving) ? 0.5 : 1,
                }}
              >
                {dateEditSaving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
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
                    <div><label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 4 }}>Notes (optionnel)</label><RichTextEditor value={newSession.notes} onChange={(v) => setNewSession((s) => ({ ...s, notes: v }))} placeholder="Notes…" minHeight={70} /></div>
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
                <button type="button" onClick={async () => { if (!selectedSession || !profileToAssign?.id) return; const sess = sessionsWithCount.find((s) => s.id === selectedSession); const updates = { integration_confirmed: true }; if (!profileToAssign.session_formation_id) { updates.session_formation_id = selectedSession; updates.integration_periode = sess?.periode ?? null; updates.integration_annee = sess?.annee ?? null; } await supabase.from('profiles').update(updates).eq('id', profileToAssign.id); setShowSessionModal(false); setProfileToAssign(null); fetchProfiles(); window.dispatchEvent(new CustomEvent('evolve:session-updated')); }} disabled={!selectedSession} style={{ padding: '10px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: ACCENT, color: 'white', cursor: 'pointer', opacity: selectedSession ? 1 : 0.6 }}>Assigner à cette session</button>
              )}
              <button type="button" onClick={() => { setShowSessionModal(false); setProfileToAssign(null); setShowCreateSession(false); fetchProfiles(); }} style={{ padding: '10px 16px', fontSize: 13, border: `1px solid ${ACCENT}`, borderRadius: 6, background: 'transparent', color: ACCENT, cursor: 'pointer' }}>Passer sans assigner</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALE EMAIL PREVIEW ────────────────────────────────────────────── */}
      {emailPreviewModal && (() => {
        const p = emailPreviewModal.profile
        const hasMail2 = !!(p.mail2?.trim())
        const validEmail = emailTo.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo.trim())
        // Aperçu HTML simplifié (signature texte → HTML inline)
        const previewHtml = emailBody
          .replace(/\n\nBaptiste PATERAC[\s\S]*$/, '')
          .replace(/\n\nAurélien GOUTARD[\s\S]*$/, '')
          .trim()
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/🔗 Lien de connexion : (https?:\/\/\S+)/g, '🔗 <a href="$1" style="color:#173731">Lien de connexion</a>')
          .replace(/\n\n/g, '</p><p style="margin:14px 0">')
          .replace(/\n/g, '<br>')
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 600, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>

              {/* Header */}
              <div style={{ padding: '18px 24px', borderBottom: '1px solid #E5E0D8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <div style={{ fontFamily: 'Palatino, serif', fontSize: 16, fontWeight: 600, color: '#173731' }}>✉️ Email au profil</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{p.fn} {p.ln} · Passage en {emailPreviewModal.newStage}</div>
                </div>
                <button type="button" onClick={() => setEmailPreviewModal(null)} style={{ background: 'none', border: 'none', fontSize: 18, color: '#999', cursor: 'pointer' }}>✕</button>
              </div>

              {/* Onglets */}
              <div style={{ display: 'flex', borderBottom: '1px solid #E5E0D8', flexShrink: 0 }}>
                {['edit', 'preview'].map((tab) => (
                  <button key={tab} type="button" onClick={() => setEmailPreviewTab(tab)}
                    style={{ flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
                      color: emailPreviewTab === tab ? '#173731' : '#999',
                      borderBottom: emailPreviewTab === tab ? '2px solid #173731' : '2px solid transparent' }}>
                    {tab === 'edit' ? '✏️ Rédiger' : '👁️ Aperçu'}
                  </button>
                ))}
              </div>

              {/* Body */}
              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

                {/* ── Destinataire ── */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Destinataire</label>
                  {hasMail2 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      {[{ label: 'Pro', val: p.mail }, { label: 'Personnel', val: p.mail2 }].map(({ label, val }) => (
                        <button key={label} type="button" onClick={() => setEmailTo(val || '')}
                          style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid',
                            background: emailTo === val ? '#173731' : 'white',
                            color: emailTo === val ? 'white' : '#173731',
                            borderColor: '#173731' }}>
                          {label} {val ? `(${val})` : '—'}
                        </button>
                      ))}
                    </div>
                  )}
                  <input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="adresse@email.com"
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: `1px solid ${validEmail ? '#E5E0D8' : '#FCA5A5'}`, borderRadius: 6, outline: 'none', boxSizing: 'border-box', background: validEmail || !emailTo ? 'white' : '#FFF5F5' }} />
                  {emailTo && !validEmail && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>Adresse email invalide</div>}
                </div>

                {emailPreviewTab === 'edit' ? (
                  <>
                    {/* Sujet */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Objet</label>
                      <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    {/* Corps */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Message</label>
                      <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={11}
                        style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, resize: 'vertical', outline: 'none', lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  </>
                ) : (
                  /* Aperçu HTML */
                  <div style={{ border: '1px solid #E5E0D8', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ background: '#F5F3EE', padding: '8px 14px', fontSize: 11, color: '#888', borderBottom: '1px solid #E5E0D8' }}>
                      <strong>De :</strong> Baptiste / Aurélien &nbsp;·&nbsp; <strong>À :</strong> {emailTo || '—'} &nbsp;·&nbsp; <strong>Objet :</strong> {emailSubject}
                    </div>
                    <div style={{ padding: '20px 24px', background: '#f9f7f4' }}>
                      <div style={{ maxWidth: 540, background: 'white', padding: '24px 28px', fontFamily: 'Arial,sans-serif', fontSize: 14, color: '#1A1A1A', lineHeight: 1.7, borderRadius: 4 }}>
                        <p style={{ margin: '0 0 14px' }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        {/* Signature selon l'utilisateur connecté */}
                        {(() => {
                          const isAurelien = user?.email === 'agoutard@evolveinvestissement.com'
                          const senderName = isAurelien ? 'Aurélien GOUTARD' : 'Baptiste PATERAC'
                          const senderTitle = isAurelien ? 'Associé & Co-fondateur | Responsable de réseau IDF' : 'Associé & Co-fondateur | Responsable de réseau régions'
                          const senderPhoto = isAurelien
                            ? 'https://fcwzzrjhmjodterwjbbl.supabase.co/storage/v1/object/public/email-assets/unnamed%20(3).png'
                            : 'https://fcwzzrjhmjodterwjbbl.supabase.co/storage/v1/object/public/email-assets/unnamed%20(1).png'
                          return (
                            <table cellPadding="0" cellSpacing="0" style={{ marginTop: 24, borderTop: '2px solid #D2AB76', paddingTop: 18, width: '100%' }}>
                              <tbody><tr>
                                <td style={{ paddingRight: 14, verticalAlign: 'top' }}>
                                  <img src={senderPhoto} width="56" height="56" style={{ borderRadius: '50%' }} alt="" />
                                </td>
                                <td style={{ fontFamily: 'Arial,sans-serif', fontSize: 12, color: '#1A1A1A', lineHeight: 1.6 }}>
                                  <div style={{ fontWeight: 700, fontSize: 13, color: '#173731' }}>{senderName}</div>
                                  <div style={{ color: '#666', fontSize: 11 }}>{senderTitle}</div>
                                  <div style={{ color: '#666', fontSize: 11, marginBottom: 6 }}>Groupe Evolve</div>
                                  <img src="https://fcwzzrjhmjodterwjbbl.supabase.co/storage/v1/object/public/email-assets/unnamed%20(2).png" height="20" alt="Evolve" />
                                </td>
                              </tr></tbody>
                            </table>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {emailSent && (
                  <div style={{ marginTop: 14, padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 13, color: '#15803D', fontWeight: 500 }}>
                    ✅ Email envoyé avec succès à {emailTo}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 24px', borderTop: '1px solid #E5E0D8', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
                {emailPreviewModal.calendarUrl && !emailSent && (
                  <a href={emailPreviewModal.calendarUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#15803D', textDecoration: 'none', fontSize: 12, fontWeight: 500 }}>
                    📅 Google Calendar
                  </a>
                )}
                <button type="button" onClick={() => setEmailPreviewModal(null)}
                  style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E0D8', background: 'white', color: '#666', cursor: 'pointer', fontSize: 13 }}>
                  {emailSent ? 'Fermer' : 'Passer'}
                </button>
                {!emailSent && (
                  <button type="button" onClick={handleSendEmail} disabled={emailSending || !validEmail}
                    style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: validEmail ? '#173731' : '#ccc', color: 'white', cursor: validEmail ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 500, minWidth: 120 }}>
                    {emailSending ? 'Envoi…' : '✉️ Envoyer'}
                  </button>
                )}
              </div>

            </div>
          </div>
        )
      })()}

      <style>{`
        .kanban-card:not(.selected):hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .score-row:hover .score-inexact-btn { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
