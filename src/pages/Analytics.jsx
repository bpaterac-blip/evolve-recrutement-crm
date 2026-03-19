import { useState, useEffect, useMemo, useRef } from 'react'
import { useCRM } from '../context/CRMContext'
import { PAS_INTERESSE_TYPES } from '../lib/data'
import { useAuth } from '../context/AuthContext'
import { useViewMode } from '../context/ViewModeContext'
import { supabase } from '../lib/supabase'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

const ACCENT = '#173731'
const GOLD = '#D2AB76'
const CHUTE_RED = '#ef4444'
const RECRUITED_GREEN = '#16a34a'

const ANALYTICS_SOURCES = ['Chasse LinkedIn', 'Chasse Mail', 'Recommandation', 'Ads', 'Chasse externe', 'Inbound Marketing', 'Autre']

const ANALYTICS_STAGES = ['R0', 'R1', 'Point Business Plan', "Point d'étape", 'R2 Amaury', 'Démission reconversion', 'Point juridique', 'Recruté']

const CHUTE_STAGES = ['Avant pipeline', 'R0', 'R1', 'Point Business Plan', "Point d'étape téléphonique", 'R2 Amaury', 'Démission reconversion', 'Point juridique']

const CHUTE_TYPES = ['Contraintes contractuelles', 'Situation personnelle', 'Offres concurrentes', 'Statut / réglementaire', 'Contact perdu', 'Autre']

function normalizeStageForMatch(stg) {
  if (stg === "Point d'étape") return "Point d'étape téléphonique"
  if (stg === 'R2 Baptiste') return 'R2 Amaury'
  return stg || ''
}

const SECTOR_KEYWORDS = {
  Banque: ['bnp', 'société générale', 'cic', 'lcl', 'crédit agricole', 'credit agricole', 'banque', 'bpce', "caisse d'épargne", 'banque populaire', 'la banque postale'],
  Assurance: ['axa', 'allianz', 'generali', 'swiss life', 'groupama', 'maif', 'ag2r', 'aviva', 'mma', 'natixis'],
  'Cabinet CGP': ['cabinet', 'patrimoine', 'gestion', 'conseil', 'indépendant', 'cgp', 'laplace', 'primonial'],
}

const IconClock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const IconUserOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

const IconEmpty = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" />
  </svg>
)

function normalize(str) {
  if (!str || typeof str !== 'string') return ''
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

function mapSourceToDisplay(src) {
  if (src === 'Inbound') return 'Inbound Marketing'
  if (ANALYTICS_SOURCES.includes(src)) return src
  return 'Autre'
}

function getSectorFromCompany(company) {
  const c = normalize(company || '')
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some((k) => c.includes(k))) return sector
  }
  return 'Autre'
}

function parseYearsFromExperiences(experiences) {
  const exps = Array.isArray(experiences) ? experiences : []
  if (exps.length === 0) return null
  const now = new Date().getFullYear()
  let totalYears = 0
  let count = 0
  for (const exp of exps) {
    const start = exp.startYear ?? exp.start
    if (!start) continue
    const end = exp.isCurrent ? now : (exp.endYear ?? exp.end ?? now)
    const years = Math.max(0, (typeof end === 'number' ? end : parseInt(end, 10) || now) - (typeof start === 'number' ? start : parseInt(start, 10) || now))
    totalYears += years
    count++
  }
  return count > 0 ? totalYears / count : null
}

function parseYearsFromDuration(dur) {
  if (!dur || typeof dur !== 'string') return null
  const m = dur.match(/(\d+)\s*ans?/i) || dur.match(/(\d+)\s*years?/i)
  if (m) return parseInt(m[1], 10)
  const since = dur.match(/depuis\s*(\d{4})/i)
  if (since) return new Date().getFullYear() - parseInt(since[1], 10)
  return null
}

function getYearsExperience(profile) {
  const durInCo = profile?.durationInCompany ?? profile?.duration ?? profile?.dur
  const yearsFromDur = parseYearsFromDuration(durInCo)
  if (yearsFromDur != null) return yearsFromDur
  const durInRole = profile?.durationInRole
  const yearsFromRole = parseYearsFromDuration(durInRole)
  if (yearsFromRole != null) return yearsFromRole
  const yearsFromExp = parseYearsFromExperiences(profile?.experiences)
  if (yearsFromExp != null) return yearsFromExp
  return null
}

function formatDateFr(d) {
  if (!d) return '—'
  const s = new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function filterByPeriod(profiles, period) {
  if (period === 'all') return profiles
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const quarterStart = Math.floor(month / 3) * 3
  return profiles.filter((p) => {
    const d = new Date(p.created_at || 0)
    if (period === 'year') return d.getFullYear() === year
    if (period === 'quarter') return d.getFullYear() === year && d.getMonth() >= quarterStart && d.getMonth() < quarterStart + 3
    if (period === 'month') return d.getFullYear() === year && d.getMonth() === month
    return true
  })
}

function getFunnelBarColor(stage) {
  if (['R0', 'R1'].includes(stage)) return ACCENT
  if (stage === 'Recruté') return RECRUITED_GREEN
  return GOLD
}

function FunnelBar({ step, funnelCounts, maxCount, showRate }) {
  const { stage, n } = step
  const idx = funnelCounts.findIndex((s) => s.stage === stage)
  const nextCount = funnelCounts[idx + 1]?.n ?? 0
  const rate = n > 0 && idx < funnelCounts.length - 1 ? Math.round((nextCount / n) * 100) : null
  const widthPct = Math.max(4, maxCount > 0 ? (n / maxCount) * 100 : 4)
  const barBg = n === 0 ? 'rgba(0,0,0,0.08)' : getFunnelBarColor(stage)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#555', width: 160, flexShrink: 0 }}>{stage}</span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 24, background: 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${widthPct}%`, height: '100%', background: barBg, borderRadius: 4, minWidth: 4, transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT, minWidth: 28 }}>{n}</span>
        </div>
      </div>
      {showRate && rate != null && (
        <div style={{ fontSize: 10, color: '#aaa', marginLeft: 160, marginBottom: 8 }}>↓ {rate}% de passage</div>
      )}
    </>
  )
}

function ChuteBarRow({ data, maxChute, onOpenModal }) {
  const { stage, chuteCount, taux, profiles } = data
  const hasChute = chuteCount > 0
  const widthPct = maxChute > 0 ? Math.max(4, (chuteCount / maxChute) * 100) : (hasChute ? 100 : 4)
  const barBg = hasChute ? CHUTE_RED : 'rgba(0,0,0,0.08)'
  const numColor = hasChute ? CHUTE_RED : '#aaa'
  return (
    <div
      onClick={() => profiles.length > 0 && onOpenModal({ title: `Chutes au stade ${stage}`, profiles, columns: ['chute_type', 'chute_detail', 'chute_date'] })}
      style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: profiles.length > 0 ? 'pointer' : 'default', padding: '4px 0' }}
    >
      <span style={{ fontSize: 12, color: '#555', width: 160, flexShrink: 0 }}>{stage}</span>
      <div style={{ flex: 1, height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${widthPct}%`, height: '100%', background: barBg, borderRadius: 6, minWidth: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: numColor, width: 20, textAlign: 'right' }}>{chuteCount}</span>
      <span style={{ fontSize: 11, color: numColor, width: 35, textAlign: 'right' }}>{taux}%</span>
    </div>
  )
}

function DurationBarRow({ stage, days }) {
  const maxDays = 60
  const widthPct = days != null ? Math.min(100, (days / maxDays) * 100) : 0
  const barBg = days != null ? GOLD : 'rgba(0,0,0,0.08)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: '#444', width: 160, flexShrink: 0 }}>{stage}</span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 20, background: 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: days != null ? `${Math.max(4, widthPct)}%` : '4%', height: '100%', background: barBg, borderRadius: 4, minWidth: 4 }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: days != null ? ACCENT : '#999', minWidth: 32 }}>{days != null ? `${days}j` : '—'}</span>
      </div>
    </div>
  )
}

const CHART_COLORS = ['#173731', '#D2AB76', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6']

function RaisonsDoughnutChart({ data, onSliceClick }) {
  const chartRef = useRef(null)
  const withData = data.filter((r) => r.count > 0)
  const totalChute = withData.reduce((a, r) => a + r.count, 0)
  const chartData = {
    labels: withData.map((r) => r.type),
    datasets: [{
      data: withData.map((r) => r.count),
      backgroundColor: withData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
      borderWidth: 0,
      hoverOffset: 8,
    }],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw} profils` } },
    },
    onClick: (_, elements) => {
      if (elements.length > 0) {
        const idx = elements[0].index
        const r = withData[idx]
        if (r?.count > 0) onSliceClick(r)
      }
    },
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
      <div style={{ width: 100, height: 100, flexShrink: 0 }}>
        <Doughnut data={chartData} options={options} ref={chartRef} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#666' }}>
        {withData.map((r, i) => (
          <div key={r.type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
            <span>{r.type}: {r.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SourcesRecrutesBars({ srcData }) {
  const withRecrutes = srcData.filter((s) => s.recruited > 0).sort((a, b) => b.pctRecrutes - a.pctRecrutes)
  const withoutRecrutes = srcData.filter((s) => s.recruited === 0)
  const ordered = [...withRecrutes, ...withoutRecrutes]
  return (
    <div className="space-y-3">
      {ordered.map((s) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#444', width: 160, flexShrink: 0 }}>{s.label}</span>
          <div style={{ flex: 1, maxWidth: '100%', height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, s.pctRecrutes)}%`, height: '100%', background: s.recruited > 0 ? RECRUITED_GREEN : 'rgba(0,0,0,0.08)', borderRadius: 6, transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 12, color: '#666', minWidth: 70 }}>{s.pctRecrutes}% · {s.recruited} rec.</span>
        </div>
      ))}
      {ordered.length === 0 && <div className="text-[13px] py-4" style={{ color: '#888' }}>Aucune donnée</div>}
    </div>
  )
}

function ChuteProfilesModal({ title, profiles, columns, onClose }) {
  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  const getSub = (p) => {
    const parts = []
    if (columns.includes('chute_type')) parts.push(p.chute_type || '—')
    if (columns.includes('chute_stade')) parts.push(p.chute_stade || '—')
    if (columns.includes('chute_detail')) parts.push(p.chute_detail || '—')
    if (columns.includes('chute_date')) parts.push(formatDate(p.chute_date))
    return parts.join(' · ')
  }
  const getMatBadgeStyle = (mat) => mat === 'Pas intéressé'
    ? { background: '#f1f5f9', color: '#64748b', fontStyle: 'italic', fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }
    : { background: '#fff1f2', color: '#e11d48', fontStyle: 'italic', fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: 520, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ background: ACCENT, padding: '16px 20px' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, color: 'white' }}>{title}</div>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          {profiles.length === 0 ? (
            <div className="text-[13px]" style={{ color: '#888' }}>Aucun profil</div>
          ) : (
            <ul className="space-y-3">
              {profiles.map((p) => (
                <li key={p.id} className="border-b border-[rgba(0,0,0,0.06)] pb-3 last:border-0" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT, color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                    {initials(p.fn || p.first_name, p.ln || p.last_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{p.fn || p.first_name} {p.ln || p.last_name}</span>
                      <span style={{ ...getMatBadgeStyle(p.mat), flexShrink: 0 }}>{p.mat === 'Pas intéressé' ? 'Pas intéressé' : 'Chute'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>{getSub(p)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, border: `1px solid ${ACCENT}`, borderRadius: 6, background: 'transparent', color: ACCENT, cursor: 'pointer' }}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

function initials(fn, ln) {
  return ((fn?.[0] || '') + (ln?.[0] || '')).toUpperCase() || '?'
}

const MATURITY_BADGE_STYLES = {
  Chaud: { bg: '#dc2626', color: 'white' },
  Tiède: { bg: '#f59e0b', color: 'white' },
  Froid: { bg: '#94a3b8', color: 'white' },
}

function SessionFormationCompact({ session, goal }) {
  const [profiles, setProfiles] = useState([])
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name, city, region, company, stage, integration_confirmed, maturity').eq('session_formation_id', session.id)
      setProfiles(data || [])
    }
    load()
  }, [session.id])
  const confirmes = profiles.filter((p) => p.integration_confirmed === true)
  const potentiels = profiles.filter((p) => p.integration_confirmed !== true)
  const total = confirmes.length + potentiels.length
  const pctConfirmes = Math.min(100, goal > 0 ? (confirmes.length / goal) * 100 : 0)
  const pctPotentiels = Math.min(100, goal > 0 ? (potentiels.length / goal) * 100 : 0)
  const titleSession = [session.periode, session.annee].filter(Boolean).join(' ') || formatDateFr(session.date_session)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, color: ACCENT }}>{titleSession}</div>
      <div className="text-[12px] mb-2" style={{ color: '#444' }}>{confirmes.length} confirmés · {potentiels.length} potentiels / {goal}</div>
      <div style={{ display: 'flex', height: 8, background: 'rgba(0,0,0,0.08)', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ width: `${pctConfirmes}%`, background: RECRUITED_GREEN, borderRadius: 6, transition: 'width 0.3s', minWidth: confirmes.length > 0 ? 4 : 0 }} />
        <div style={{ width: `${pctPotentiels}%`, background: GOLD, borderRadius: 6, transition: 'width 0.3s', minWidth: potentiels.length > 0 ? 4 : 0 }} />
      </div>
      {total > 0 && (
        <div>
          {confirmes.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT, color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                {initials(p.first_name, p.last_name)}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{[p.first_name, p.last_name].filter(Boolean).join(' ')}</span>
                <span style={{ fontSize: 12, color: '#888' }}> · {p.city || '—'} · {p.region || '—'}</span>
              </div>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#D4EDE1', color: '#166534', fontWeight: 600 }}>Confirmé</span>
            </div>
          ))}
          {potentiels.map((p) => {
            const mat = p.maturity || 'Froid'
            const matStyle = MATURITY_BADGE_STYLES[mat] || MATURITY_BADGE_STYLES.Froid
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT, color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, opacity: 0.7 }}>
                  {initials(p.first_name, p.last_name)}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, color: '#333' }}>{[p.first_name, p.last_name].filter(Boolean).join(' ')}</span>
                  <span style={{ fontSize: 12, color: '#888' }}> · {p.city || '—'} · {p.region || '—'}</span>
                </div>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: matStyle.bg, color: matStyle.color, fontWeight: 600 }}>{mat}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SessionsFormationCard({ sessions, goal }) {
  if (sessions.length === 0) {
    return (
      <div className="text-[13px] py-8 text-center" style={{ color: '#888' }}>Aucune session planifiée</div>
    )
  }
  return (
    <div>
      {sessions.map((session) => (
        <SessionFormationCompact key={session.id} session={session} goal={goal} />
      ))}
    </div>
  )
}

export default function Analytics() {
  const { filteredProfiles } = useCRM()
  const { user, role } = useAuth()
  const { viewMode } = useViewMode()
  const [period, setPeriod] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [activities, setActivities] = useState([])
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [chuteModal, setChuteModal] = useState(null)

  const isGlobalView = role === 'admin' && viewMode === 'global'
  const sessionGoal = isGlobalView ? 6 : 3
  const allProfiles = [...filteredProfiles].filter((p) => p.mat !== 'Archivé')
  const ownerEmails = [...new Set(allProfiles.map((p) => p.owner_email || '').filter(Boolean))].sort()
  const P = ownerFilter === 'all' ? allProfiles : allProfiles.filter((p) => (p.owner_email || '') === ownerFilter)
  const PPeriod = filterByPeriod(P, period)

  const alwaysAllData = [...allProfiles].filter((p) => p.mat !== 'Archivé')
  const ownerFilteredAll = ownerFilter === 'all' ? alwaysAllData : alwaysAllData.filter((p) => (p.owner_email || '') === ownerFilter)

  const profileIdsForActivities = useMemo(() => ownerFilteredAll.map((p) => p.id).filter(Boolean).sort().join(','), [ownerFilter, allProfiles.length, ownerFilteredAll.length])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const ids = profileIdsForActivities ? profileIdsForActivities.split(',').filter(Boolean) : []
      if (ids.length === 0) {
        setActivities([])
        setLoading(false)
        return
      }
      const { data } = await supabase.from('activities').select('*').eq('activity_type', 'stage_change').in('profile_id', ids).order('created_at', { ascending: true })
      setActivities(data || [])
      setLoading(false)
    }
    load()
  }, [profileIdsForActivities])

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase.from('sessions_formation').select('*').gte('date_session', today).order('date_session', { ascending: true }).limit(2)
      setUpcomingSessions(data || [])
    }
    load()
  }, [])

  const stats = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000
    const now = Date.now()

    const forFunnel = PPeriod.filter((p) => p.stg && p.stg !== '')
    const forAlways = ownerFilteredAll
    const chuteProfiles = forAlways.filter((p) => p.mat === 'Chute' || p.mat === 'Pas intéressé')

    const countInStage = (stg) => {
      const excludeSkip = (p) => {
        if (stg === 'Point Business Plan' && p.skip_business_plan) return false
        if (stg === 'Démission reconversion' && p.skip_demission) return false
        return true
      }
      if (stg === "Point d'étape") return forFunnel.filter((p) => normalizeStageForMatch(p.stg) === "Point d'étape téléphonique" && excludeSkip(p)).length
      if (stg === "Point d'étape téléphonique") return forFunnel.filter((p) => normalizeStageForMatch(p.stg) === stg && excludeSkip(p)).length
      return forFunnel.filter((p) => p.stg === stg && excludeSkip(p)).length
    }

    const funnelCounts = ANALYTICS_STAGES.map((s) => ({ stage: s, n: countInStage(s) }))
    const total = forFunnel.length
    const totalRecrutes = forAlways.filter((p) => p.stg === 'Recruté').length

    const stageDurations = {}
    const stageOrder = ANALYTICS_STAGES
    const actsByProfile = {}
    activities.forEach((a) => {
      if (!actsByProfile[a.profile_id]) actsByProfile[a.profile_id] = []
      actsByProfile[a.profile_id].push({ old: a.old_value, new: a.new_value, ts: new Date(a.created_at).getTime() })
    })
    for (const pid of Object.keys(actsByProfile)) {
      actsByProfile[pid].sort((a, b) => a.ts - b.ts)
    }
    const profileCreated = {}
    forAlways.forEach((p) => { profileCreated[p.id] = new Date(p.created_at || 0).getTime() })
    const stageDataKey = (s) => (s === "Point d'étape" ? "Point d'étape téléphonique" : s)
    stageOrder.forEach((stage) => {
      stageDurations[stage] = []
      const dk = stageDataKey(stage)
      if (dk !== stage) stageDurations[dk] = stageDurations[dk] ?? []
    })
    for (const p of forAlways) {
      const acts = actsByProfile[p.id] || []
      const created = profileCreated[p.id] || 0
      let currentStage = 'R0'
      let currentStageStart = created
      for (const act of acts) {
        if (act.old) {
          const dur = (act.ts - currentStageStart) / dayMs
          const norm = normalizeStageForMatch(currentStage) || currentStage
          if (stageDurations[norm]) stageDurations[norm].push(dur)
        }
        currentStage = normalizeStageForMatch(act.new) || act.new || currentStage
        currentStageStart = act.ts
      }
      const dur = (now - currentStageStart) / dayMs
      const norm = normalizeStageForMatch(currentStage) || currentStage
      if (stageDurations[norm]) stageDurations[norm].push(dur)
    }
    const avgByStage = {}
    stageOrder.forEach((s) => {
      const arr = stageDurations[stageDataKey(s)] || []
      avgByStage[s] = arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null
    })

    const chuteByStage = CHUTE_STAGES.map((stage) => {
      const matchStg = (p) => {
        const stade = p.chute_stade || p.stg || 'Avant pipeline'
        if (stage === 'Avant pipeline') return stade === 'Avant pipeline' || !stade || stade === ''
        if (stage === "Point d'étape téléphonique") return normalizeStageForMatch(stade) === stage
        return stade === stage
      }
      const chuteCount = chuteProfiles.filter((p) => matchStg(p)).length
      const currentInStage = stage === 'Avant pipeline' ? 0 : forAlways.filter((p) => {
        const s = p.stg
        if (stage === "Point d'étape téléphonique") return normalizeStageForMatch(s) === stage && p.mat !== 'Chute' && p.mat !== 'Pas intéressé'
        return s === stage && p.mat !== 'Chute' && p.mat !== 'Pas intéressé'
      }).length
      const denom = currentInStage + chuteCount
      const taux = denom > 0 ? Math.round((chuteCount / denom) * 100) : 0
      return { stage, chuteCount, currentInStage, taux, profiles: chuteProfiles.filter((p) => matchStg(p)) }
    })

    const chuteByType = {}
    chuteProfiles.forEach((p) => {
      const t = p.chute_type || 'Autre'
      if (!chuteByType[t]) chuteByType[t] = []
      chuteByType[t].push(p)
    })
    const allRaisonTypes = [...CHUTE_TYPES, ...PAS_INTERESSE_TYPES]
    const raisonsAbandon = allRaisonTypes.map((t) => ({
      type: t,
      count: (chuteByType[t] || []).length,
      profiles: chuteByType[t] || [],
    }))
    const totalChute = chuteProfiles.length

    const bySource = {}
    forAlways.forEach((p) => {
      const s = mapSourceToDisplay(p.src || 'Chasse LinkedIn')
      if (!bySource[s]) bySource[s] = { total: 0, recruited: 0 }
      bySource[s].total++
      if (p.stg === 'Recruté') bySource[s].recruited++
    })
    const srcData = ANALYTICS_SOURCES.map((s) => ({
      label: s,
      total: bySource[s]?.total || 0,
      recruited: bySource[s]?.recruited || 0,
      pctRecrutes: totalRecrutes > 0 ? Math.round(((bySource[s]?.recruited || 0) / totalRecrutes) * 100) : 0,
    }))

    const recrutesProfiles = forAlways.filter((p) => p.stg === 'Recruté')
    const year2026 = 2026
    const recrutes2026Filter = (p) => p.stg === 'Recruté' && p.created_at && new Date(p.created_at).getFullYear() === year2026
    const recrutes2026 = forAlways.filter(recrutes2026Filter).length
    const recrutes2026ByOwner = {}
    forAlways.filter(recrutes2026Filter).forEach((p) => {
      const email = p.owner_email || ''
      if (email) recrutes2026ByOwner[email] = (recrutes2026ByOwner[email] || 0) + 1
    })
    const r0ToIntegDelay = recrutesProfiles
      .map((p) => {
        const acts = (actsByProfile[p.id] || []).filter((a) => a.new === 'Recruté')
        const integDate = acts.length > 0 ? acts[acts.length - 1].ts : new Date(p.updated_at || p.created_at).getTime()
        const created = new Date(p.created_at || 0).getTime()
        return (integDate - created) / dayMs
      })
      .filter((d) => d > 0)
    const avgDelay = r0ToIntegDelay.length > 0 ? Math.round(r0ToIntegDelay.reduce((a, b) => a + b, 0) / r0ToIntegDelay.length) : null

    const integresProfiles = forAlways.filter((p) => p.stg === 'Recruté')
    const scoresIntegres = integresProfiles.map((p) => p.sc ?? 0).filter((s) => s > 0)
    const scoresAll = forAlways.map((p) => p.sc ?? 0).filter((s) => s > 0)
    const avgScoreIntegres = scoresIntegres.length > 0 ? Math.round(scoresIntegres.reduce((a, b) => a + b, 0) / scoresIntegres.length) : null
    const avgScoreAll = scoresAll.length > 0 ? Math.round(scoresAll.reduce((a, b) => a + b, 0) / scoresAll.length) : null

    const yearsIntegres = integresProfiles.map(getYearsExperience).filter((y) => y != null)
    const yearsAll = forAlways.map(getYearsExperience).filter((y) => y != null)
    const avgYearsIntegres = yearsIntegres.length > 0 ? (yearsIntegres.reduce((a, b) => a + b, 0) / yearsIntegres.length).toFixed(1) : null
    const avgYearsAll = yearsAll.length > 0 ? (yearsAll.reduce((a, b) => a + b, 0) / yearsAll.length).toFixed(1) : null

    const bySector = {}
    integresProfiles.forEach((p) => {
      const s = getSectorFromCompany(p.co)
      bySector[s] = (bySector[s] || 0) + 1
    })
    const sectorData = Object.entries(bySector).map(([k, v]) => ({ label: k, count: v, pct: integresProfiles.length > 0 ? Math.round((v / integresProfiles.length) * 100) : 0 })).sort((a, b) => b.count - a.count)

    const recrutes = forAlways.filter((p) => p.stg === 'Recruté')
    const delais = recrutes
      .filter((p) => p.created_at && p.updated_at)
      .map((p) => {
        const debut = new Date(p.created_at)
        const fin = new Date(p.updated_at)
        return Math.round((fin - debut) / (1000 * 60 * 60 * 24))
      })
      .filter((d) => d >= 0)
    const delaiMoyenRecrutement = delais.length > 0 ? Math.round(delais.reduce((a, b) => a + b, 0) / delais.length) : null

    const active = forFunnel.filter((p) => {
      const last = p.updated_at || p.created_at
      if (!last) return false
      return (now - new Date(last).getTime()) / dayMs <= 30
    }).length
    const inactive = forFunnel.filter((p) => {
      const last = p.updated_at || p.created_at
      if (!last) return true
      return (now - new Date(last).getTime()) / dayMs > 30
    }).length

    return {
      funnelCounts,
      total,
      avgByStage,
      chuteByStage,
      raisonsAbandon,
      totalChute,
      srcData,
      totalRecrutes,
      avgDelay,
      avgScoreIntegres,
      avgScoreAll,
      avgYearsIntegres,
      avgYearsAll,
      sectorData,
      recrutesCount: recrutesProfiles.length,
      integresProfiles,
      recrutes2026,
      recrutes2026ByOwner,
      objectif2026: isGlobalView ? 30 : 15,
      delaiMoyenRecrutement,
      recrutesCountForDelai: recrutes.length,
      active,
      inactive,
    }
  }, [PPeriod, ownerFilteredAll, activities, period, isGlobalView])

  const sectionTitleStyle = { fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#999', marginBottom: 12 }
  const cardStyle = { background: '#ffffff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 24px', boxShadow: 'none' }
  const cardLabelStyle = { fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#999', marginBottom: 8 }

  return (
    <div className="page h-full overflow-y-auto p-[22px]" style={{ background: '#F5F0E8' }}>
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: ACCENT }}>Analytics</div>
          <div className="text-[13px]" style={{ color: '#888' }}>Performance recrutement Evolve</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="text-[12px] py-1.5 px-2.5 rounded-md border" style={{ borderColor: 'var(--border)' }}>
            <option value="all">Tout</option>
            <option value="year">Cette année</option>
            <option value="quarter">Ce trimestre</option>
            <option value="month">Ce mois</option>
          </select>
          {isGlobalView && ownerEmails.length > 0 && (
            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="text-[12px] py-1.5 px-2.5 rounded-md border" style={{ borderColor: 'var(--border)' }}>
              <option value="all">Tous les utilisateurs</option>
              {ownerEmails.map((em) => (
                <option key={em} value={em}>{em.split('@')[0]}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-[13px] mb-4" style={{ color: '#888' }}>Chargement…</div>
      )}

      <section className="mb-8">
        <div style={sectionTitleStyle}>Pipeline</div>
        <div className="analytics-pipeline-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={cardStyle}>
              <div style={cardLabelStyle}>Funnel de conversion</div>
              {stats.funnelCounts.map((step, i) => (
                <div key={step.stage}>
                  <FunnelBar step={step} funnelCounts={stats.funnelCounts} maxCount={Math.max(1, ...stats.funnelCounts.map((s) => s.n))} showRate={i < stats.funnelCounts.length - 1} />
                </div>
              ))}
            </div>
            <div style={{ ...cardStyle, minHeight: 160 }}>
              <div style={cardLabelStyle}>Objectif 2026</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: ACCENT }}>{stats.recrutes2026 ?? 0} / {stats.objectif2026 ?? 15}</div>
              <div style={{ marginTop: 8, height: 8, background: 'rgba(0,0,0,0.08)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, ((stats.recrutes2026 ?? 0) / (stats.objectif2026 ?? 15)) * 100)}%`, height: '100%', background: RECRUITED_GREEN, borderRadius: 6, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>{Math.round(((stats.recrutes2026 ?? 0) / (stats.objectif2026 ?? 15)) * 100)}% de l'objectif atteint</div>
              {isGlobalView && ownerEmails.length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {ownerEmails.map((em) => {
                    const n = stats.recrutes2026ByOwner?.[em] ?? 0
                    const pct = Math.min(100, (n / 15) * 100)
                    const local = em.split('@')[0]
                    const av = local.slice(0, 2).toUpperCase()
                    return (
                      <div key={em} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT, color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                          {av}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT, minWidth: 80 }}>{local}</span>
                        <span style={{ fontSize: 12, color: '#888', minWidth: 36 }}>{n} / 15</span>
                        <div style={{ flex: 1, minWidth: 60, height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: RECRUITED_GREEN, borderRadius: 6, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div style={cardStyle}>
              <div style={cardLabelStyle}>Délai moyen recrutement</div>
              {stats.recrutesCountForDelai > 0 ? (
                <>
                  <div style={{ fontSize: 32, fontWeight: 700, color: ACCENT }}>{stats.delaiMoyenRecrutement != null ? stats.delaiMoyenRecrutement : '—'}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>jours en moyenne de R0 à Recruté</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, fontWeight: 700, color: ACCENT }}>—</div>
                  <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>Aucun recrutement finalisé</div>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={cardStyle}>
              <div style={cardLabelStyle}>Durée moyenne par stade</div>
              {ANALYTICS_STAGES.map((s) => (
                <DurationBarRow key={s} stage={s} days={stats.avgByStage[s]} />
              ))}
            </div>
            <div style={{ ...cardStyle, minHeight: 200 }}>
              <div style={cardLabelStyle}>Raisons d'abandon</div>
              {stats.totalChute > 0 ? (
                <RaisonsDoughnutChart data={stats.raisonsAbandon} onSliceClick={(r) => r.count > 0 && setChuteModal({ title: r.type, profiles: r.profiles, columns: ['chute_stade', 'chute_detail', 'chute_date'] })} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12" style={{ color: '#888' }}>
                  <span className="mb-3" style={{ color: '#bbb' }}><IconEmpty /></span>
                  <span className="text-[13px]">Aucun abandon enregistré</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={cardStyle}>
              <div style={cardLabelStyle}>Prochaines sessions</div>
              <SessionsFormationCard sessions={upcomingSessions} goal={sessionGoal} />
            </div>
            <div style={cardStyle}>
              <div style={cardLabelStyle}>Taux de chute par stade</div>
              {(() => {
                const maxChute = Math.max(1, ...stats.chuteByStage.map((b) => b.chuteCount))
                return stats.chuteByStage.map((b) => <ChuteBarRow key={b.stage} data={b} maxChute={maxChute} onOpenModal={(m) => setChuteModal(m)} />)
              })()}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div style={sectionTitleStyle}>Acquisition</div>
        <div className="analytics-acquisition-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          <div style={cardStyle}>
            <div style={cardLabelStyle}>Sources de recrutement</div>
            <SourcesRecrutesBars srcData={stats.srcData.filter((s) => s.total > 0)} />
            {stats.srcData.filter((s) => s.total > 0).length === 0 && (
              <div className="text-[13px] py-4" style={{ color: '#888' }}>Aucune donnée</div>
            )}
          </div>
          <div style={cardStyle}>
            <div style={cardLabelStyle}>% intégrés par secteur</div>
            {stats.sectorData.length > 0 ? (
              <div className="space-y-2">
                {stats.sectorData.map((s) => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="text-[12px] w-[140px] shrink-0" style={{ color: '#444' }}>{s.label}</span>
                    <div style={{ flex: 1, maxWidth: '100%', height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${s.pct}%`, height: '100%', background: GOLD, borderRadius: 6 }} />
                    </div>
                    <span className="text-[11px]" style={{ color: '#666' }}>{s.count} · {s.pct}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[13px]" style={{ color: '#888' }}>Aucune donnée</div>
            )}
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div style={sectionTitleStyle}>Qualité</div>
        <div className="analytics-qualite-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          <div style={cardStyle}>
            <div style={cardLabelStyle}>Score moyen</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 700, color: ACCENT }}>{stats.avgScoreIntegres ?? '—'}</div>
                <div className="text-[12px]" style={{ color: '#999' }}>Profils intégrés</div>
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 400, color: '#999' }}>{stats.avgScoreAll ?? '—'}</div>
                <div className="text-[12px]" style={{ color: '#999' }}>Tous les profils</div>
              </div>
            </div>
          </div>
          <div style={cardStyle}>
            <div style={cardLabelStyle}>Années d'expérience moyenne</div>
            {stats.avgYearsIntegres != null ? (
              <>
                <div style={{ fontSize: 32, fontWeight: 700, color: ACCENT }}>{stats.avgYearsIntegres} ans</div>
                <div className="text-[12px] mt-1" style={{ color: '#999' }}>ans d'expérience en moyenne (profils recrutés)</div>
                <div className="text-[11px] mt-2" style={{ color: '#aaa' }}>vs {stats.avgYearsAll ?? '—'} ans (tous les profils)</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 32, fontWeight: 700, color: ACCENT }}>—</div>
                <div className="text-[13px] mt-2" style={{ color: '#aaa', fontStyle: 'italic' }}>Données insuffisantes — renseignez l'expérience sur les fiches profil</div>
              </>
            )}
          </div>
        </div>
      </section>

      {chuteModal && (
        <ChuteProfilesModal
          title={chuteModal.title}
          profiles={chuteModal.profiles}
          columns={chuteModal.columns}
          onClose={() => setChuteModal(null)}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .analytics-pipeline-grid { grid-template-columns: 1fr !important; }
          .analytics-pipeline-grid > div:last-child > div:first-child { grid-template-columns: 1fr !important; }
          .analytics-pipeline-grid > div:last-child > div:last-child { flex-direction: column !important; align-items: center !important; }
          .analytics-qualite-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
