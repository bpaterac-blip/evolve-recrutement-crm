import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import { useAuth } from '../context/AuthContext'
import { useViewMode } from '../context/ViewModeContext'
import { supabase } from '../lib/supabase'
import { STAGES, STAGE_COLORS } from '../lib/data'

const ACCENT = '#173731'
const GOLD = '#D2AB76'

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const IconCalendar = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const IconAssigner = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
)

const IconAddSession = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="12" y1="14" x2="12" y2="18" />
    <line x1="10" y1="16" x2="14" y2="16" />
  </svg>
)

const IconPencil = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

function formatDateFr(d) {
  if (!d) return '—'
  const s = new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatDateShort(d) {
  if (!d) return '—'
  const s = new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function ownerDisplay(p) {
  if (p?.owner_full_name?.trim()) return p.owner_full_name.trim()
  const email = p?.owner_email || ''
  if (!email) return 'Non assigné'
  const name = email.split('@')[0]
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/[._]/g, ' ')
}

export default function Dashboard() {
  const { profiles, filteredProfiles, fetchProfiles } = useCRM()
  const { user, role, userProfile } = useAuth()
  const { viewMode } = useViewMode()
  const navigate = useNavigate()
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [addSessionModal, setAddSessionModal] = useState(false)
  const [assignModal, setAssignModal] = useState(null)
  const [sessionProfilsRefresh, setSessionProfilsRefresh] = useState(0)
  const [profileModalData, setProfileModalData] = useState(null)
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [stageCounts, setStageCounts] = useState([])
  const [pointsEtapeCetteSemaine, setPointsEtapeCetteSemaine] = useState([])
  const [pointsEtapeLoading, setPointsEtapeLoading] = useState(true)
  const [contactesCeMois, setContactesCeMois] = useState(null)
  const [contactesDiff, setContactesDiff] = useState(null)
  const [recrutes2026, setRecrutes2026] = useState(null)
  const [recrutesCeMois, setRecrutesCeMois] = useState(null)

  const allProfiles = [...filteredProfiles].filter((p) => p.mat !== 'Archivé')
  const P = ownerFilter === 'all' ? allProfiles : allProfiles.filter((p) => (p.owner_email || '') === ownerFilter)
  const ownerEmails = [...new Set(allProfiles.map((p) => p.owner_email || '').filter(Boolean))].sort()
  const isGlobalView = role === 'admin' && viewMode === 'global'
  const pipeline = P.filter((p) => p.stg && p.stg !== '' && p.stg !== 'Recruté')
  const recruited = P.filter((p) => p.stg === 'Recruté')

  const today = new Date()
  const dayOfWeek = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const r1CetteSemaine = P.filter((p) => {
    if (p.stg !== 'R1') return false
    const d = p.updated_at || p.created_at
    if (!d) return false
    const dt = new Date(d)
    return dt >= monday && dt <= sunday
  }).sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))

  const ini = (a, b) => (a?.[0] || '') + (b?.[0] || '')
  const stag = (s) => (STAGE_COLORS[s] ? { backgroundColor: STAGE_COLORS[s].bg, color: STAGE_COLORS[s].text } : {})
  const sessionGoal = isGlobalView ? 6 : 3

  const pipelineDate = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  useEffect(() => {
    const loadUpcomingSessions = async () => {
      setSessionsLoading(true)
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase.from('sessions_formation').select('*').gte('date_session', today).order('date_session', { ascending: true }).limit(2)
      setUpcomingSessions(data || [])
      setSessionsLoading(false)
    }
    loadUpcomingSessions()
  }, [addSessionModal])

  useEffect(() => {
    const onSessionUpdated = () => {
      setSessionsLoading(true)
      const today = new Date().toISOString().split('T')[0]
      supabase.from('sessions_formation').select('*').gte('date_session', today).order('date_session', { ascending: true }).limit(2).then(({ data }) => {
        setUpcomingSessions(data || [])
        setSessionsLoading(false)
      })
      setSessionProfilsRefresh((k) => k + 1)
    }
    window.addEventListener('evolve:session-updated', onSessionUpdated)
    return () => window.removeEventListener('evolve:session-updated', onSessionUpdated)
  }, [])

  useEffect(() => {
    const loadPointsEtape = async () => {
      setPointsEtapeLoading(true)
      const today = new Date()
      const dayOfWeek = today.getDay()
      const monday = new Date(today)
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      monday.setHours(0, 0, 0, 0)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      sunday.setHours(23, 59, 59, 999)
      const mondayStr = monday.toISOString().split('T')[0]
      const sundayStr = sunday.toISOString().split('T')[0]
      const profileIds = P.map((p) => p.id).filter(Boolean)
      if (profileIds.length === 0) {
        setPointsEtapeCetteSemaine([])
        setPointsEtapeLoading(false)
        return
      }
      const { data: events } = await supabase
        .from('events')
        .select('id, profile_id, event_date, event_type, date')
        .eq('event_type', "Point d'étape téléphonique")
        .gte('event_date', mondayStr)
        .lte('event_date', sundayStr)
        .in('profile_id', profileIds)
      if (events && events.length > 0) {
        const withProfile = events.map((e) => {
          const p = P.find((pr) => String(pr.id) === String(e.profile_id))
          const eventDate = e.event_date || e.date
          return {
            id: e.id,
            profile_id: e.profile_id,
            fn: p?.fn ?? '',
            ln: p?.ln ?? '',
            co: p?.co ?? '—',
            event_date: eventDate,
          }
        }).filter((x) => x.profile_id)
        setPointsEtapeCetteSemaine(withProfile)
      } else {
        const fallback = P.filter((p) => {
          if (p.stg !== "Point d'étape téléphonique") return false
          const d = p.updated_at || p.created_at
          if (!d) return false
          const dt = new Date(d)
          return dt >= monday && dt <= sunday
        }).map((p) => ({
          id: `p-${p.id}`,
          profile_id: p.id,
          fn: p.fn ?? '',
          ln: p.ln ?? '',
          co: p.co ?? '—',
          event_date: p.updated_at || p.created_at,
        }))
        setPointsEtapeCetteSemaine(fallback)
      }
      setPointsEtapeLoading(false)
    }
    loadPointsEtape()
  }, [P.map((p) => p.id).filter(Boolean).join(','), ownerFilter])

  useEffect(() => {
    const loadContactesRecrutes = async () => {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

      const isGlobalView = role === 'admin' && viewMode === 'global'
      const ownerFilterForQuery = isGlobalView ? null : user?.id

      let qCeMois = supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth).lte('created_at', endOfMonth)
      let qMoisPrec = supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfLastMonth).lte('created_at', endOfLastMonth)
      if (ownerFilterForQuery) {
        qCeMois = qCeMois.eq('owner_id', ownerFilterForQuery)
        qMoisPrec = qMoisPrec.eq('owner_id', ownerFilterForQuery)
      }
      const { count: contactesCeMoisVal } = await qCeMois
      const { count: contactesMoisPrecedent } = await qMoisPrec
      const diff = (contactesCeMoisVal || 0) - (contactesMoisPrecedent || 0)
      setContactesCeMois(contactesCeMoisVal ?? 0)
      setContactesDiff(diff)

      let qRecrutes2026 = supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('stage', 'Recruté').gte('created_at', '2026-01-01T00:00:00.000Z')
      let qRecrutesCeMois = supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('stage', 'Recruté').gte('updated_at', startOfMonth)
      if (ownerFilterForQuery) {
        qRecrutes2026 = qRecrutes2026.eq('owner_id', ownerFilterForQuery)
        qRecrutesCeMois = qRecrutesCeMois.eq('owner_id', ownerFilterForQuery)
      }
      const { count: recrutes2026Val } = await qRecrutes2026
      const { count: recrutesCeMoisVal } = await qRecrutesCeMois
      setRecrutes2026(recrutes2026Val ?? 0)
      setRecrutesCeMois(recrutesCeMoisVal ?? 0)
    }
    loadContactesRecrutes()
  }, [role, viewMode, user?.id])

  useEffect(() => {
    const loadStageCounts = async () => {
      let query = supabase.from('profiles').select('stage').neq('maturity', 'Archivé')
      if (role === 'admin' && viewMode === 'global') {
        if (ownerFilter !== 'all') {
          query = query.eq('owner_email', ownerFilter)
        }
      } else if (user?.id) {
        query = query.eq('owner_id', user.id)
      }
      const { data } = await query
      const counts = {}
      STAGES.forEach((s) => { counts[s] = 0 })
      ;(data || []).filter((p) => p.stage != null && p.stage !== '').forEach((p) => {
        const s = p.stage || 'R0'
        if (counts[s] !== undefined) counts[s]++
        else counts[s] = 1
      })
      setStageCounts(STAGES.map((s) => ({ stage: s, count: counts[s] })))
    }
    loadStageCounts()
  }, [role, viewMode, ownerFilter, user?.id])

  const maxStageCount = Math.max(1, ...stageCounts.map((s) => s.count))

  const cardStyle = {
    background: '#ffffff',
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.06)',
    padding: '20px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  }
  const sectionTitleStyle = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#888',
    marginBottom: 12,
  }
  const valueStyle = { fontSize: 28, fontWeight: 600, color: ACCENT }

  return (
    <div className="page h-full overflow-y-auto p-[22px]" style={{ background: '#F5F0E8' }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: ACCENT, marginBottom: 4 }}>Bonjour {userProfile?.first_name || (user?.email || '').split('@')[0] || 'Utilisateur'} 👋</div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span className="text-[13px]" style={{ color: '#999' }}>Pipeline au {pipelineDate}</span>
        {isGlobalView && ownerEmails.length > 0 && (
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="text-[12px] py-1.5 px-2.5 rounded-md border" style={{ borderColor: 'var(--border)' }}>
            <option value="all">Tous les utilisateurs</option>
            {ownerEmails.map((em) => (
              <option key={em} value={em}>{ownerDisplay(allProfiles.find((p) => (p.owner_email || '') === em) || { owner_email: em })}</option>
            ))}
          </select>
        )}
      </div>

      <div className="stats-row grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Contactés ce mois</div>
          <div style={valueStyle}>{contactesCeMois ?? '—'}</div>
          <div
            className="text-xs mt-1"
            style={{
              color: contactesDiff != null
                ? contactesDiff > 0
                  ? '#15803d'
                  : contactesDiff < 0
                    ? '#dc2626'
                    : '#aaa'
                : '#888',
            }}
          >
            {contactesDiff != null
              ? contactesDiff > 0
                ? `+${contactesDiff} vs mois dernier`
                : contactesDiff < 0
                  ? `${contactesDiff} vs mois dernier`
                  : 'Stable vs mois dernier'
              : '—'}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>En pipeline actif</div>
          <div style={valueStyle}>{pipeline.length}</div>
          <div className="text-xs mt-1" style={{ color: '#888' }}>Tous stades</div>
        </div>
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Recrutés 2026</div>
          <div style={valueStyle}>{recrutes2026 ?? '—'}</div>
          <div
            className="text-xs mt-1"
            style={{
              color: recrutesCeMois != null
                ? recrutesCeMois > 0
                  ? '#15803d'
                  : '#aaa'
                : '#888',
            }}
          >
            {recrutesCeMois != null
              ? recrutesCeMois > 0
                ? `+${recrutesCeMois} ce mois`
                : '0 ce mois'
              : '—'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div style={{ ...cardStyle, padding: 0 }}>
            <div className="py-3 px-5 border-b flex items-center gap-2" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div style={{ ...sectionTitleStyle, marginBottom: 0 }}>Prochaines sessions</div>
            </div>
            <div className="p-5">
              {sessionsLoading ? (
                <div className="text-[13px]" style={{ color: '#888' }}>Chargement…</div>
              ) : upcomingSessions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <span style={{ color: '#888' }}><IconCalendar /></span>
                  <span className="text-[13px]" style={{ color: '#888' }}>Aucune session planifiée</span>
                  <button type="button" onClick={() => setAddSessionModal(true)} className="py-2 px-4 rounded-lg text-[13px] font-medium flex items-center gap-2" style={{ backgroundColor: ACCENT, color: 'white' }}>
                    <IconAddSession />
                    Ajouter une session
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {upcomingSessions.map((session) => (
                    <SessionFormationCard
                      key={session.id}
                      session={session}
                      goal={sessionGoal}
                      sessionProfilsRefresh={sessionProfilsRefresh}
                      onAssign={() => setAssignModal(session)}
                      onAddSession={() => setAddSessionModal(true)}
                      onProfileClick={(p) => setProfileModalData(p)}
                      stag={stag}
                      ini={ini}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4">
          <div style={cardStyle}>
            <div style={sectionTitleStyle}>Objectif 2026</div>
            <div className="text-[12px] mb-2" style={{ color: '#888' }}>{isGlobalView ? '30 recrutés (équipe)' : '15 recrutés (ma vue)'}</div>
            {(() => {
              const year2026 = 2026
              const recruited2026 = P.filter((p) => p.stg === 'Recruté' && p.created_at && new Date(p.created_at).getFullYear() === year2026)
              const count = recruited2026.length
              const goal = isGlobalView ? 30 : 15
              const pct = Math.min(100, Math.round((count / goal) * 100))
              return (
                <>
                  <div style={valueStyle} className="mb-2">{count} / {goal}</div>
                  <div className="flex items-center gap-2 mb-2">
                    <div style={{ flex: 1, height: 8, background: 'rgba(0,0,0,0.08)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#16a34a', borderRadius: 6, transition: 'width 0.3s' }} />
                    </div>
                    <span className="text-[11px] shrink-0" style={{ color: '#888' }}>{pct}%</span>
                  </div>
                  <div className="text-[12px]" style={{ color: '#666' }}>
                    {pct >= 100 ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Objectif atteint !</span> : `${pct}% de l'objectif atteint`}
                  </div>
                </>
              )
            })()}
          </div>
          <div style={cardStyle}>
            <div style={sectionTitleStyle}>R1 planifiés cette semaine</div>
            <div style={{ ...valueStyle, fontWeight: 700 }}>{r1CetteSemaine.length}</div>
            <div className="text-[12px] mt-1" style={{ color: '#888' }}>profils en R1 cette semaine</div>
            {r1CetteSemaine.length === 0 ? (
              <div className="text-[13px] mt-2" style={{ color: '#888' }}>Aucun</div>
            ) : (
              <ul className="space-y-2 mt-2">
                {r1CetteSemaine.map((p) => (
                  <li key={p.id} className="flex justify-between items-center cursor-pointer hover:opacity-80" onClick={() => navigate(`/profiles/${p.id}`)}>
                    <span className="text-[12px]" style={{ color: '#555' }}>{p.fn} {p.ln} · {p.co}</span>
                    <span className="text-[12px]" style={{ color: '#888' }}>{p.updated_at || p.created_at ? new Date(p.updated_at || p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div style={cardStyle}>
            <div style={sectionTitleStyle}>Points d'étape cette semaine</div>
            {pointsEtapeLoading ? (
              <div className="text-[13px]" style={{ color: '#888' }}>Chargement…</div>
            ) : (
              <>
                <div style={{ fontSize: 28, fontWeight: 700, color: ACCENT }}>{pointsEtapeCetteSemaine.length}</div>
                <div className="text-[12px] mt-1" style={{ color: '#888' }}>points d'étape cette semaine</div>
                {pointsEtapeCetteSemaine.length === 0 ? (
                  <div className="text-[13px] mt-2" style={{ color: '#888' }}>Aucun</div>
                ) : (
                  <ul className="space-y-2 mt-2">
                    {pointsEtapeCetteSemaine.map((item) => (
                      <li key={item.id} className="flex justify-between items-center cursor-pointer hover:opacity-80" onClick={() => navigate(`/profiles/${item.profile_id}`)}>
                        <span className="text-[12px]" style={{ color: '#555' }}>{item.fn} {item.ln} · {item.co}</span>
                        <span className="text-[12px]" style={{ color: '#888' }}>{item.event_date ? new Date(item.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-4">
          <div style={cardStyle}>
            <div style={{ ...sectionTitleStyle, marginBottom: 12 }}>Pipeline par stade</div>
            <ul className="space-y-3">
              {stageCounts.map((s) => {
                const pct = maxStageCount > 0 ? (s.count / maxStageCount) * 100 : 0
                return (
                  <li key={s.stage} className="cursor-pointer hover:opacity-80" onClick={() => navigate(`/pipeline?stage=${encodeURIComponent(s.stage)}`)}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[13px]" style={{ color: s.count === 0 ? '#bbb' : '#333' }}>{s.stage}</span>
                      <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-[12px] font-semibold" style={{ backgroundColor: ACCENT, color: 'white' }}>{s.count}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: GOLD, borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {isGlobalView && (() => {
            const year2026 = 2026
            const byOwner = {}
            allProfiles.forEach((p) => {
              const email = p.owner_email || ''
              if (!byOwner[email]) byOwner[email] = { email, count: 0 }
              if (p.stg === 'Recruté' && p.created_at && new Date(p.created_at).getFullYear() === year2026) byOwner[email].count++
            })
            const owners = Object.values(byOwner).filter((o) => o.email).sort((a, b) => b.count - a.count)
            if (owners.length === 0) return null
            return (
              <div style={cardStyle}>
                <div style={sectionTitleStyle}>Objectif par conseiller</div>
                <div className="space-y-3">
                  {owners.map((o) => {
                    const pct = Math.min(100, Math.round((o.count / 15) * 100))
                    const barColor = pct >= 100 ? '#16a34a' : pct >= 67 ? '#3b82f6' : pct >= 34 ? '#f59e0b' : '#dc2626'
                    const name = ownerDisplay(allProfiles.find((p) => (p.owner_email || '') === o.email) || { owner_email: o.email })
                    return (
                      <div key={o.email}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[13px] font-medium">{name}</span>
                          <span className="text-[12px] text-[var(--t2)]">{o.count} / 15</span>
                        </div>
                        <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {profileModalData && (
        <ProfileSessionModal
          profile={profileModalData}
          onClose={() => setProfileModalData(null)}
          onViewFull={() => { setProfileModalData(null); navigate(`/profiles/${profileModalData.id}`); }}
          stag={stag}
        />
      )}
      {addSessionModal && <AddSessionModal onClose={() => setAddSessionModal(false)} onSaved={() => { setAddSessionModal(false); fetchProfiles(); }} />}
      {assignModal && <AssignProfileModal session={assignModal} onClose={() => setAssignModal(null)} onSaved={() => { setAssignModal(null); setSessionProfilsRefresh((k) => k + 1); fetchProfiles(); }} />}
    </div>
  )
}

function getProfileCity(p) {
  return p?.city || '—'
}

function getProfileRegion(p) {
  return p?.region || '—'
}

const MATURITY_BADGE_STYLES = {
  Chaud: { bg: '#dc2626', color: 'white' },
  Tiède: { bg: '#f59e0b', color: 'white' },
  Froid: { bg: '#94a3b8', color: 'white' },
  Chute: { bg: '#fff1f2', color: '#e11d48', fontStyle: 'italic' },
  'Pas intéressé': { bg: '#f1f5f9', color: '#64748b', fontStyle: 'italic', fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 20 },
}

function formatDateDebutRange(dateDebut) {
  if (!dateDebut) return null
  const d = new Date(dateDebut + 'T12:00:00')
  const friday = new Date(d)
  friday.setDate(d.getDate() + 4)
  const lundi = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })
  const vendredi = friday.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return `Du ${lundi} au ${vendredi}`
}

function SessionFormationCard({ session, goal, sessionProfilsRefresh, onAssign, onAddSession, onProfileClick, stag, ini }) {
  const [profils, setProfils] = useState([])
  const [editDateModal, setEditDateModal] = useState(false)
  const [editDateValue, setEditDateValue] = useState('')
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name, company, city, region, stage, score, linkedin_url, title, integration_confirmed, maturity').eq('session_formation_id', session.id)
      setProfils(data || [])
    }
    load()
  }, [session.id, sessionProfilsRefresh])
  const confirmes = profils.filter((p) => p.stage === 'Recruté' || p.integration_confirmed === true)
  const potentiels = profils.filter((p) => p.stage !== 'Recruté' && p.integration_confirmed !== true)
  const total = confirmes.length + potentiels.length
  const pctConfirmes = Math.min(100, goal > 0 ? (confirmes.length / goal) * 100 : 0)
  const pctPotentiels = Math.min(100, goal > 0 ? (potentiels.length / goal) * 100 : 0)
  const statutLabel = session.statut === 'confirmée' ? 'confirmée' : 'planifiée'
  const dateDisplay = session.date_debut ? formatDateDebutRange(session.date_debut) : 'Date exacte à confirmer'
  const titleSession = [session.periode, session.annee].filter(Boolean).join(' ') || formatDateFr(session.date_session)

  const handleSaveDate = async () => {
    if (!editDateValue || !session.id) return
    await supabase.from('sessions_formation').update({ date_debut: editDateValue }).eq('id', session.id)
    setEditDateModal(false)
    setEditDateValue('')
    window.dispatchEvent(new CustomEvent('evolve:session-updated'))
  }

  return (
    <div style={{ border: '1px solid rgba(0,0,0,0.06)', borderRadius: 16, overflow: 'hidden', background: '#fff', padding: '20px 24px' }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, color: ACCENT }}>{titleSession}</div>
          <div className="text-[12px] mt-1" style={{ color: '#888' }}>{dateDisplay}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold" style={{ backgroundColor: statutLabel === 'confirmée' ? '#D4EDE1' : 'rgba(210,171,118,0.2)', color: statutLabel === 'confirmée' ? '#1A7A4A' : GOLD }}>{statutLabel}</span>
          <button type="button" onClick={() => { setEditDateModal(true); setEditDateValue(session.date_debut || ''); }} className="p-2 rounded-md hover:bg-[rgba(0,0,0,0.06)] transition-colors" title="Modifier la date exacte">
            <IconPencil />
          </button>
          <button type="button" onClick={onAssign} className="p-2 rounded-md hover:bg-[rgba(0,0,0,0.06)] transition-colors" title="Assigner un profil">
            <IconAssigner />
          </button>
          <button type="button" onClick={onAddSession} className="p-2 rounded-md hover:bg-[rgba(0,0,0,0.06)] transition-colors" title="Ajouter une session">
            <IconAddSession />
          </button>
        </div>
      </div>
      <div className="text-[12px] mb-2" style={{ color: '#444' }}>{confirmes.length} confirmés · {potentiels.length} potentiels / {goal}</div>
      <div style={{ height: 8, background: 'rgba(0,0,0,0.08)', borderRadius: 6, overflow: 'hidden', marginBottom: 12, display: 'flex' }}>
        <div style={{ width: `${pctConfirmes}%`, background: '#16a34a', borderRadius: 6, transition: 'width 0.3s', minWidth: confirmes.length > 0 ? 4 : 0 }} />
        <div style={{ width: `${pctPotentiels}%`, background: GOLD, borderRadius: 6, transition: 'width 0.3s', minWidth: potentiels.length > 0 ? 4 : 0 }} />
      </div>
      {total > 0 && (
        <ul className="space-y-2">
          {confirmes.map((p) => {
            const fn = p.first_name || ''
            const ln = p.last_name || ''
            const fullName = [fn, ln].filter(Boolean).join(' ') || '—'
            const city = getProfileCity(p)
            const region = getProfileRegion(p)
            return (
              <li key={p.id} className="flex items-center gap-2 cursor-pointer hover:opacity-80" onClick={() => onProfileClick(p)}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ backgroundColor: ACCENT, color: GOLD }}>{ini(fn, ln)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold" style={{ color: ACCENT }}>{fullName}</div>
                  <div className="text-[12px]" style={{ color: '#888' }}>{city} · {region}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-semibold shrink-0" style={{ backgroundColor: '#D4EDE1', color: '#166534' }}>Confirmé</span>
              </li>
            )
          })}
          {potentiels.map((p) => {
            const fn = p.first_name || ''
            const ln = p.last_name || ''
            const fullName = [fn, ln].filter(Boolean).join(' ') || '—'
            const city = getProfileCity(p)
            const region = getProfileRegion(p)
            const mat = p.maturity || 'Froid'
            const matStyle = MATURITY_BADGE_STYLES[mat] || MATURITY_BADGE_STYLES.Froid
            return (
              <li key={p.id} className="flex items-center gap-2 cursor-pointer hover:opacity-80" onClick={() => onProfileClick(p)}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ backgroundColor: ACCENT, color: GOLD, opacity: 0.7 }}>{ini(fn, ln)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px]" style={{ color: '#333' }}>{fullName}</div>
                  <div className="text-[12px]" style={{ color: '#888' }}>{city} · {region}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-semibold shrink-0" style={{ backgroundColor: matStyle.bg, color: matStyle.color }}>{mat}</span>
              </li>
            )
          })}
        </ul>
      )}
      {editDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setEditDateModal(false)}>
          <div className="rounded-xl border shadow-xl w-full max-w-sm p-5" style={{ backgroundColor: '#F5F0E8', borderColor: 'var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-sm mb-3" style={{ color: ACCENT }}>Modifier la date exacte</div>
            <label className="block text-[12px] font-medium text-[var(--t3)] mb-1">Lundi de la semaine de formation</label>
            <input type="date" value={editDateValue} onChange={(e) => setEditDateValue(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[13px] mb-4" style={{ borderColor: 'var(--border)' }} />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditDateModal(false)} className="py-2 px-3 rounded-lg text-[13px] font-medium border" style={{ borderColor: ACCENT, color: ACCENT }}>Annuler</button>
              <button type="button" onClick={handleSaveDate} disabled={!editDateValue} className="py-2 px-3 rounded-lg text-[13px] font-medium disabled:opacity-50" style={{ backgroundColor: ACCENT, color: 'white' }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileSessionModal({ profile, onClose, onViewFull, stag }) {
  const fn = profile?.first_name || ''
  const ln = profile?.last_name || ''
  const fullName = [fn, ln].filter(Boolean).join(' ') || '—'
  const city = getProfileCity(profile)
  const region = getProfileRegion(profile)
  const locationStr = [city, region].filter(Boolean).join(' · ') || '—'
  const li = profile?.linkedin_url || ''
  const liUrl = li && !li.startsWith('http') ? `https://${li}` : li
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="rounded-xl border shadow-xl w-full max-w-md p-5 relative" style={{ backgroundColor: '#F5F0E8', borderColor: 'var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1 rounded-md hover:bg-[rgba(0,0,0,0.08)] transition-colors" style={{ color: '#666' }}>
          <IconClose />
        </button>
        <div className="font-semibold text-base mb-4 pr-8" style={{ color: ACCENT }}>{fullName}</div>
        <div className="space-y-3 text-[13px]">
          <div><span className="text-[var(--t3)]">Employeur</span><br /><span style={{ color: '#333' }}>{profile?.company || '—'}</span></div>
          <div><span className="text-[var(--t3)]">Poste</span><br /><span style={{ color: '#333' }}>{profile?.title || '—'}</span></div>
          <div><span className="text-[var(--t3)]">Ville · Région</span><br /><span style={{ color: '#333' }}>{locationStr}</span></div>
          <div><span className="text-[var(--t3)]">Stade actuel</span><br /><span className="tag px-2 py-0.5 rounded-md text-xs" style={stag(profile?.stage)}>{profile?.stage || '—'}</span></div>
          <div><span className="text-[var(--t3)]">Score</span><br /><span style={{ color: '#333' }}>{profile?.score ?? '—'}</span></div>
          {li && <div><span className="text-[var(--t3)]">LinkedIn</span><br /><a href={liUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: ACCENT }}>{li}</a></div>}
        </div>
        <button type="button" onClick={onViewFull} className="mt-4 w-full py-2.5 px-4 rounded-lg text-[13px] font-medium" style={{ backgroundColor: ACCENT, color: 'white' }}>Voir la fiche complète</button>
      </div>
    </div>
  )
}

function SessionProfilsList({ sessionId, horizontal, compact }) {
  const [profils, setProfils] = useState([])
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name, company, city, region').eq('session_formation_id', sessionId)
      setProfils(data || [])
    }
    load()
  }, [sessionId])
  const count = profils.length
  const formatProfileLine = (p) => {
    const fn = p.first_name || ''
    const ln = p.last_name || ''
    const fullName = [fn, ln].filter(Boolean).join(' ') || '—'
    const city = getProfileCity(p)
    const region = getProfileRegion(p)
    return compact ? `${fullName} · ${city} · ${region}` : `${fullName} · ${p.company || '—'} · ${city} · ${region}`
  }
  if (horizontal) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px]" style={{ color: '#888' }}>{count} inscrit(s)</span>
        {count > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {profils.map((p) => {
              const fn = p.first_name || ''
              const ln = p.last_name || ''
              const initials = (fn[0] || '') + (ln[0] || '') || '?'
              const fullName = [fn, ln].filter(Boolean).join(' ')
              const city = getProfileCity(p)
              const region = getProfileRegion(p)
              const line = compact ? `${fullName || '—'} · ${city} · ${region}` : `${fullName || '—'}`
              return (
                <div key={p.id} className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold" style={{ backgroundColor: 'rgba(23,55,49,0.1)', color: ACCENT }}>{initials}</div>
                  <span style={{ color: '#444' }}>{line}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }
  return (
    <div className={compact ? '' : 'mt-3 pt-3 border-t'} style={compact ? {} : { borderColor: 'rgba(0,0,0,0.06)' }}>
      <div className="text-[12px] mb-2" style={{ color: '#888' }}>{count} profil(s) inscrit(s)</div>
      {count > 0 && (
        <ul>
          {profils.map((p, i) => {
            const fn = p.first_name || ''
            const ln = p.last_name || ''
            const initials = (fn[0] || '') + (ln[0] || '') || '?'
            return (
              <li key={p.id} className="flex items-center gap-2" style={{ fontSize: 12, color: '#444', padding: '4px 0', borderBottom: i < profils.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold" style={{ backgroundColor: 'rgba(23,55,49,0.1)', color: ACCENT }}>{initials}</div>
                <span>{formatProfileLine(p)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function AddSessionModal({ onClose, onSaved }) {
  const [date, setDate] = useState('')
  const [lieu, setLieu] = useState('')
  const [placesTotal, setPlacesTotal] = useState(10)
  const [statut, setStatut] = useState('planifiée')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!date) return
    setSaving(true)
    await supabase.from('sessions_formation').insert({ date_session: date, lieu: lieu || null, places_total: placesTotal, statut, notes: notes || null })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="rounded-xl border shadow-xl w-full max-w-md p-5" style={{ backgroundColor: '#F5F0E8', borderColor: 'var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold text-sm mb-4" style={{ color: ACCENT }}>Ajouter une session</div>
        <div className="space-y-3">
          <div>
            <label className="block text-[12px] font-medium text-[var(--t3)] mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: 'var(--border)' }} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--t3)] mb-1">Lieu</label>
            <input type="text" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Lieu" className="w-full rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: 'var(--border)' }} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--t3)] mb-1">Nombre de places</label>
            <input type="number" value={placesTotal} onChange={(e) => setPlacesTotal(parseInt(e.target.value, 10) || 10)} min={1} className="w-full rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: 'var(--border)' }} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--t3)] mb-1">Statut</label>
            <select value={statut} onChange={(e) => setStatut(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: 'var(--border)' }}>
              <option value="planifiée">Planifiée</option>
              <option value="confirmée">Confirmée</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--t3)] mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border px-3 py-2 text-[13px] resize-none" style={{ borderColor: 'var(--border)' }} />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={onClose} className="py-2 px-3 rounded-lg text-[13px] font-medium border" style={{ borderColor: ACCENT, color: ACCENT }}>Annuler</button>
          <button type="button" onClick={handleSave} disabled={saving || !date} className="py-2 px-3 rounded-lg text-[13px] font-medium disabled:opacity-50" style={{ backgroundColor: ACCENT, color: 'white' }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

function AssignProfileModal({ session, onClose, onSaved }) {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, company, stage')
        .neq('maturity', 'Archivé')
        .order('first_name', { ascending: true })
      setProfiles(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    if (!selectedId) return
    setSaving(true)
    await supabase.from('profiles').update({
      session_formation_id: session.id,
      integration_periode: session.periode ?? null,
      integration_annee: session.annee ?? null,
      integration_confirmed: false,
    }).eq('id', selectedId)
    setSaving(false)
    onSaved()
  }

  const formatOption = (p) => {
    const fn = p.first_name || ''
    const ln = p.last_name || ''
    const name = [fn, ln].filter(Boolean).join(' ') || '—'
    const co = p.company || '—'
    const stg = p.stage || '—'
    return `${name} · ${co} (${stg})`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="rounded-xl border shadow-xl w-full max-w-md p-5" style={{ backgroundColor: '#F5F0E8', borderColor: 'var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold text-sm mb-4" style={{ color: ACCENT }}>Assigner un profil à cette session</div>
        <div>
          <label className="block text-[12px] font-medium text-[var(--t3)] mb-1">Profil</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: 'var(--border)' }} disabled={loading}>
            <option value="">Sélectionner un profil</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{formatOption(p)}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={onClose} className="py-2 px-3 rounded-lg text-[13px] font-medium border" style={{ borderColor: ACCENT, color: ACCENT }}>Annuler</button>
          <button type="button" onClick={handleSave} disabled={saving || !selectedId || loading} className="py-2 px-3 rounded-lg text-[13px] font-medium disabled:opacity-50" style={{ backgroundColor: ACCENT, color: 'white' }}>{saving ? 'Assignation…' : 'Assigner'}</button>
        </div>
      </div>
    </div>
  )
}
