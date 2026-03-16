import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import { useAuth } from '../context/AuthContext'
import { useViewMode } from '../context/ViewModeContext'
import { supabase } from '../lib/supabase'
import { EVENTS_TABLE } from '../context/CRMContext'
import { STAGE_COLORS, INTEG_OPTS, INTEG_ADD_DATE } from '../lib/data'

const ACCENT = '#173731'
const GOLD = '#D2AB76'
const DROPDOWN_Z = 9999

const RELANCE_THRESHOLDS = {
  R0: 7,
  R1: 14,
  'R2 Amaury': 21,
  'R2 Baptiste': 21,
}

const IconWarning = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
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

function openDropdown(e, editingCell, setEditingCell, profileId, field, extra = {}) {
  e.stopPropagation()
  if (editingCell?.profileId === profileId && editingCell?.field === field && !editingCell?.integCustomMode) {
    setEditingCell(null)
    return
  }
  const r = e.currentTarget.getBoundingClientRect()
  setEditingCell({ profileId, field, rect: { left: r.left, bottom: r.bottom, width: r.width }, ...extra })
}

function getRelanceThreshold(stage) {
  if (RELANCE_THRESHOLDS[stage] != null) return RELANCE_THRESHOLDS[stage]
  if (stage === 'R2 Baptiste') return 21
  return 30
}

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
  const { profiles, filteredProfiles, changeStage, changeSource, changeInteg, fetchProfiles } = useCRM()
  const { user, role, userProfile } = useAuth()
  const { viewMode } = useViewMode()
  const navigate = useNavigate()
  const [editingCell, setEditingCell] = useState(null)
  const [nextSession, setNextSession] = useState(null)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [addSessionModal, setAddSessionModal] = useState(false)
  const [assignModal, setAssignModal] = useState(null)
  const [sessionProfilsRefresh, setSessionProfilsRefresh] = useState(0)
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [upcomingEvents, setUpcomingEvents] = useState([])

  const allProfiles = [...filteredProfiles].filter((p) => p.mat !== 'Archivé')
  const P = ownerFilter === 'all' ? allProfiles : allProfiles.filter((p) => (p.owner_email || '') === ownerFilter)
  const ownerEmails = [...new Set(allProfiles.map((p) => p.owner_email || '').filter(Boolean))].sort()
  const isGlobalView = role === 'admin' && viewMode === 'global'
  const pipeline = P.filter((p) => p.stg && p.stg !== 'Recruté')
  const recruited = P.filter((p) => p.stg === 'Recruté')
  const reachedR1 = P.filter((p) => p.stg && ['R1', "Point d'étape", 'R2 Amaury', 'Point juridique', 'Démission reconversion', 'Recruté'].includes(p.stg))
  const conversionRate = reachedR1.length > 0 ? ((recruited.length / reachedR1.length) * 100).toFixed(1) : '0'

  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  const profilsARelancer = P.filter((p) => {
    if (!p.stg || p.stg === 'Recruté') return false
    const lastUpdate = p.updated_at || p.created_at
    if (!lastUpdate) return false
    const daysSince = Math.floor((now - new Date(lastUpdate).getTime()) / dayMs)
    const threshold = getRelanceThreshold(p.stg)
    return daysSince > threshold
  })
    .map((p) => {
      const lastUpdate = p.updated_at || p.created_at
      const daysSince = lastUpdate ? Math.floor((now - new Date(lastUpdate).getTime()) / dayMs) : 0
      return { ...p, daysSince }
    })
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 8)

  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const r1CeMois = P.filter((p) => {
    if (p.stg !== 'R1') return false
    const d = p.updated_at || p.created_at
    if (!d) return false
    const dt = new Date(d)
    return dt.getMonth() === currentMonth && dt.getFullYear() === currentYear
  }).sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))

  const bloques30 = P.filter((p) => {
    if (!p.stg || p.stg === 'Recruté') return false
    const lastUpdate = p.updated_at || p.created_at
    if (!lastUpdate) return false
    const daysSince = Math.floor((now - new Date(lastUpdate).getTime()) / dayMs)
    return daysSince > 30
  }).map((p) => {
    const lastUpdate = p.updated_at || p.created_at
    const daysSince = lastUpdate ? Math.floor((now - new Date(lastUpdate).getTime()) / dayMs) : 0
    return { ...p, daysBloques: daysSince }
  })

  const ini = (a, b) => (a?.[0] || '') + (b?.[0] || '')
  const stag = (s) => (STAGE_COLORS[s] ? { backgroundColor: STAGE_COLORS[s].bg, color: STAGE_COLORS[s].text } : {})
  const currentProfile = editingCell ? profilsARelancer.find((p) => p.id === editingCell.profileId) : null

  const pipelineDate = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  useEffect(() => {
    const loadNextSession = async () => {
      setSessionsLoading(true)
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase.from('sessions_formation').select('*').gte('date_session', today).order('date_session', { ascending: true }).limit(1).maybeSingle()
      setNextSession(data)
      setSessionsLoading(false)
    }
    loadNextSession()
  }, [addSessionModal])

  const fetchUpcomingEvents = async () => {
    const today = new Date().toISOString()
    const { data: eventsData } = await supabase
      .from(EVENTS_TABLE)
      .select('id, event_date, event_type, description, profile_id')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(5)
    const events = eventsData || []
    const profileIds = [...new Set(events.map((e) => e.profile_id).filter(Boolean))]
    let profilesMap = {}
    if (profileIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, company, stage, city, region')
        .in('id', profileIds)
      if (profilesData) {
        profilesData.forEach((p) => { profilesMap[p.id] = p })
      }
    }
    const enrichedEvents = events.map((e) => ({
      ...e,
      profile: profilesMap[e.profile_id] || null,
    }))
    setUpcomingEvents(enrichedEvents)
  }

  useEffect(() => {
    fetchUpcomingEvents()
    const interval = setInterval(fetchUpcomingEvents, 30000)
    const handleRefresh = () => fetchUpcomingEvents()
    window.addEventListener('evolve:event-added', handleRefresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener('evolve:event-added', handleRefresh)
    }
  }, [])

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

      <div className="stats-row grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Contactés (mois en cours)</div>
          <div style={valueStyle}>34</div>
          <div className="text-xs mt-1" style={{ color: '#888' }}>+12 vs février</div>
        </div>
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>En pipeline actif</div>
          <div style={valueStyle}>{pipeline.length}</div>
          <div className="text-xs mt-1" style={{ color: '#888' }}>Tous stades</div>
        </div>
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Recrutés 2026</div>
          <div style={valueStyle}>{recruited.length}</div>
          <div className="text-xs mt-1" style={{ color: '#16a34a' }}>+1 ce mois</div>
        </div>
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Taux conversion</div>
          <div style={valueStyle}>{conversionRate}%</div>
          <div className="text-xs mt-1" style={{ color: '#888' }}>R1 → Recruté</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="tw overflow-hidden" style={{ ...cardStyle, padding: 0 }}>
            <div className="thd py-3 px-5 border-b flex items-center gap-2" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div style={{ ...sectionTitleStyle, marginBottom: 0 }}>Profils à relancer</div>
              <span className="text-xs py-0.5 px-2 rounded-full font-medium ml-auto" style={{ background: 'rgba(0,0,0,0.06)', color: '#666' }}>{profilsARelancer.length} profils</span>
              <button type="button" className="py-1.5 px-2.5 text-xs rounded-md border ml-auto" onClick={() => navigate('/profiles')} style={{ borderColor: ACCENT, color: ACCENT, background: 'none' }}>Voir tous</button>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ backgroundColor: 'rgba(0,0,0,0.03)' }}>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider py-2 px-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)', color: '#888' }}>Profil</th>
                  {isGlobalView && <th className="text-left text-[11px] font-medium uppercase tracking-wider py-2 px-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)', color: '#888' }}>Responsable</th>}
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider py-2 px-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)', color: '#888' }}>Stade actuel</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider py-2 px-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)', color: '#888' }}>Dernière action</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider py-2 px-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)', color: '#888' }}>Jours sans action</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider py-2 px-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)', color: '#888' }}>Intégration pot.</th>
                </tr>
              </thead>
              <tbody>
                {profilsARelancer.length === 0 ? (
                  <tr><td colSpan={isGlobalView ? 6 : 5} className="py-8 text-center text-[var(--t3)] text-[13px]">Aucun profil à relancer</td></tr>
                ) : (
                  profilsARelancer.map((p, i) => (
                    <tr key={p.id} className="border-b hover:bg-[rgba(0,0,0,0.02)] cursor-pointer last:border-b-0" style={{ borderColor: 'rgba(0,0,0,0.06)' }} onClick={() => { setEditingCell(null); navigate(`/profiles/${p.id}`); }}>
                      <td className="py-2.5 px-4">
                        <div className="pc flex items-center gap-2.5">
                          <div className="av w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: ['#D4EDE1', '#D3E4F8', '#FDEBC8'][i % 3], color: ['#1A7A4A', '#1E5FA0', '#B86B0F'][i % 3] }}>{ini(p.fn, p.ln)}</div>
                          <div><div className="pn font-medium text-[13.5px]">{p.fn} {p.ln}</div><div className="ps text-xs text-[var(--t3)] mt-0.5">{p.co}</div></div>
                        </div>
                      </td>
                      {isGlobalView && <td className="py-2.5 px-4 text-[12px] text-[var(--t2)]">{ownerDisplay(p)}</td>}
                      <td className="py-2.5 px-4"><span className="tag px-2 py-0.5 rounded-md text-xs" style={stag(p.stg)}>{p.stg}</span></td>
                      <td className="py-2.5 px-4 text-[var(--t2)] text-[13px]">{p.updated_at || p.created_at ? new Date(p.updated_at || p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                      <td className="py-2.5 px-4 text-[13px] font-medium" style={{ color: p.daysSince > 30 ? '#dc2626' : ACCENT }}>{p.daysSince} j</td>
                      <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="tag tag-btn px-2 py-0.5 rounded-md text-xs" style={{ background: '#D4EDE1', color: '#1A7A4A' }} onClick={(e) => openDropdown(e, editingCell, setEditingCell, p.id, 'integ')}>{(p.integ || '—')} ▾</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={cardStyle}>
            <div className="flex items-center gap-2" style={{ ...sectionTitleStyle, marginBottom: 12 }}>
              <span style={{ color: ACCENT }}><IconCalendar /></span>
              <span>Prochaine session de formation</span>
            </div>
            {sessionsLoading ? (
              <div className="text-[13px]" style={{ color: '#888' }}>Chargement…</div>
            ) : !nextSession ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <span className="text-[13px]" style={{ color: '#888' }}>Aucune session planifiée</span>
                <button type="button" onClick={() => setAddSessionModal(true)} className="py-2 px-4 rounded-lg text-[13px] font-medium" style={{ backgroundColor: ACCENT, color: 'white' }}>+ Ajouter une session</button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[13px]" style={{ color: ACCENT }}>{formatDateFr(nextSession.date_session)}</span>
                  <span style={{ color: '#888' }}>·</span>
                  <span className="text-[13px]" style={{ color: '#666' }}>{nextSession.lieu || '—'}</span>
                  <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold" style={{ backgroundColor: nextSession.statut === 'confirmée' ? '#D4EDE1' : 'rgba(210,171,118,0.2)', color: nextSession.statut === 'confirmée' ? '#1A7A4A' : GOLD }}>{nextSession.statut}</span>
                </div>
                <SessionProfilsList key={sessionProfilsRefresh} sessionId={nextSession.id} horizontal={false} compact />
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setAssignModal(nextSession)} className="p-2 rounded-md hover:bg-[rgba(0,0,0,0.06)] transition-colors" title="Assigner un profil">
                    <IconAssigner />
                  </button>
                  <button type="button" onClick={() => setAddSessionModal(true)} className="p-2 rounded-md hover:bg-[rgba(0,0,0,0.06)] transition-colors" title="Ajouter une session">
                    <IconAddSession />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4">
          <div style={cardStyle}>
            <div style={sectionTitleStyle}>Objectif {new Date().getFullYear()}</div>
            <div className="text-[12px] mb-2" style={{ color: '#888' }}>15 recrutés par conseiller</div>
            {(() => {
              const currentYear = new Date().getFullYear()
              const myProfiles = isGlobalView ? allProfiles.filter((p) => p.owner_id === user?.id || p.owner_email === user?.email) : P
              const recruitedThisYear = myProfiles.filter((p) => p.stg === 'Recruté' && p.created_at && new Date(p.created_at).getFullYear() === currentYear)
              const count = recruitedThisYear.length
              const pct = Math.min(100, Math.round((count / 15) * 100))
              const barColor = pct >= 100 ? '#16a34a' : pct >= 67 ? '#3b82f6' : pct >= 34 ? '#f59e0b' : '#dc2626'
              return (
                <>
                  <div style={valueStyle} className="mb-2">{count} / 15</div>
                  <div className="flex items-center gap-2 mb-2">
                    <div style={{ flex: 1, height: 8, background: 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.3s' }} />
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
            <div style={sectionTitleStyle}>R1 planifiés ce mois</div>
            <div style={valueStyle}>{r1CeMois.length}</div>
            <div className="text-[12px] mt-1" style={{ color: '#888' }}>profils en R1 ce mois</div>
            {r1CeMois.length === 0 ? (
              <div className="text-[13px] mt-2" style={{ color: '#888' }}>Aucun</div>
            ) : (
              <ul className="space-y-2 mt-2">
                {r1CeMois.map((p) => (
                  <li key={p.id} className="flex justify-between items-center cursor-pointer hover:opacity-80" onClick={() => navigate(`/profiles/${p.id}`)}>
                    <span className="text-[13px]">{p.fn} {p.ln} · {p.co}</span>
                    <span className="text-[12px]" style={{ color: '#888' }}>{p.updated_at || p.created_at ? new Date(p.updated_at || p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-4">
          <div style={cardStyle}>
            <div className="flex items-center gap-2" style={{ ...sectionTitleStyle, marginBottom: 8 }}>
              <span style={{ color: '#dc2626' }}><IconWarning /></span>
              <span>Profils bloqués +30 jours</span>
              {bloques30.length > 0 && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: '#dc2626', color: 'white' }}>{bloques30.length}</span>}
            </div>
            {bloques30.length === 0 ? (
              <div className="text-[13px]" style={{ color: '#888' }}>Aucun</div>
            ) : (
              <ul className="space-y-2">
                {bloques30.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex justify-between items-center cursor-pointer hover:opacity-80" onClick={() => navigate(`/profiles/${p.id}`)}>
                    <span className="text-[13px]">{p.fn} {p.ln} · <span className="tag px-1.5 py-0.5 rounded text-[11px]" style={stag(p.stg)}>{p.stg}</span></span>
                    <span className="text-[12px] font-medium" style={{ color: '#dc2626' }}>{p.daysBloques} j</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={cardStyle}>
            <div className="flex items-center gap-2" style={{ ...sectionTitleStyle, marginBottom: 12 }}>
              <span style={{ color: ACCENT }}><IconCalendar /></span>
              <span>Événements à venir</span>
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <span className="mb-2" style={{ color: '#888' }}>
                  <IconCalendar />
                </span>
                <span className="text-[13px]" style={{ color: '#888' }}>Aucun événement à venir</span>
              </div>
            ) : (
              <ul className="space-y-2">
                {upcomingEvents.map((ev, i) => {
                  const p = ev.profile
                  const fn = p?.first_name ?? ''
                  const ln = p?.last_name ?? ''
                  const initials = (fn?.[0] || '') + (ln?.[0] || '') || '?'
                  const fullName = [fn, ln].filter(Boolean).join(' ') || '—'
                  const city = p?.city || ''
                  const region = p?.region || ''
                  const locationStr = (city && region) ? `${city} · ${region}` : (city || region || p?.company || '—')
                  const eventDateFormatted = ev.event_date ? (() => {
                    const d = new Date(ev.event_date)
                    const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                    return s.charAt(0).toUpperCase() + s.slice(1)
                  })() : '—'
                  const badgeColors = ['#D4EDE1', '#D3E4F8', '#FDEBC8', 'rgba(210,171,118,0.3)', 'rgba(23,55,49,0.15)']
                  const badgeTextColors = ['#1A7A4A', '#1E5FA0', '#B86B0F', GOLD, ACCENT]
                  const badgeStyle = { backgroundColor: badgeColors[i % badgeColors.length], color: badgeTextColors[i % badgeTextColors.length] }
                  return (
                    <li key={ev.id} className="flex items-center gap-2 cursor-pointer hover:opacity-80" onClick={() => navigate(`/profiles/${ev.profile_id}`)}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={badgeStyle}>{initials}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium">{fullName}</div>
                        <div className="text-[12px]" style={{ color: '#888' }}>{locationStr}</div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="tag px-1.5 py-0.5 rounded text-[11px]" style={{ backgroundColor: 'rgba(210,171,118,0.25)', color: ACCENT }}>{ev.event_type || 'Événement'}</span>
                        <span className="text-[12px] mt-0.5" style={{ color: '#888' }}>{eventDateFormatted}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {isGlobalView && (() => {
            const currentYear = new Date().getFullYear()
            const byOwner = {}
            allProfiles.forEach((p) => {
              const email = p.owner_email || ''
              if (!byOwner[email]) byOwner[email] = { email, count: 0 }
              if (p.stg === 'Recruté' && p.created_at && new Date(p.created_at).getFullYear() === currentYear) byOwner[email].count++
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

      {editingCell?.rect && currentProfile && (editingCell.field === 'integ' || editingCell.integCustomMode) && (
        <div className="ddrop rounded-lg shadow-lg p-1 min-w-[140px] max-h-[280px] overflow-y-auto" style={{ position: 'fixed', left: editingCell.rect.left, top: editingCell.rect.bottom + 4, zIndex: DROPDOWN_Z, background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
          {editingCell.field === 'integ' && !editingCell.integCustomMode && (
            <>
              {INTEG_OPTS.map((o) => (
                <div key={o} className={`ddi py-1.5 px-2.5 rounded-md text-[13px] cursor-pointer hover:bg-[var(--s2)] ${(currentProfile.integ || '—') === o ? 'font-semibold' : ''}`} onClick={() => { changeInteg(currentProfile.id, o); setEditingCell(null); }}>{o}</div>
              ))}
              <div className="ddi border-t mt-1 pt-1 py-1.5 px-2.5 rounded-md text-[13px] cursor-pointer hover:bg-[var(--s2)] font-medium" style={{ color: ACCENT }} onClick={() => setEditingCell((c) => ({ ...c, integCustomMode: true, integCustomValue: '' }))}>{INTEG_ADD_DATE}</div>
            </>
          )}
          {editingCell.field === 'integ' && editingCell.integCustomMode && (
            <div className="p-2 space-y-2 min-w-[200px]">
              <input type="text" className="inlin-input w-full py-1.5 px-2 text-[13px]" placeholder="ex: Mars 2027" value={editingCell.integCustomValue ?? ''} onChange={(e) => setEditingCell((c) => ({ ...c, integCustomValue: e.target.value }))} autoFocus />
              <div className="flex gap-1.5">
                <button type="button" className="btn bp bsm flex-1" onClick={() => { const v = (editingCell.integCustomValue || '').trim(); if (v) { changeInteg(currentProfile.id, v); setEditingCell(null); } }}>Valider</button>
                <button type="button" className="btn bo bsm" onClick={() => setEditingCell((c) => ({ ...c, integCustomMode: false, integCustomValue: '' }))}>Annuler</button>
              </div>
            </div>
          )}
        </div>
      )}

      {addSessionModal && <AddSessionModal onClose={() => setAddSessionModal(false)} onSaved={() => { setAddSessionModal(false); fetchProfiles(); }} />}
      {assignModal && <AssignProfileModal session={assignModal} profiles={profiles} onClose={() => setAssignModal(null)} onSaved={() => { setAssignModal(null); setSessionProfilsRefresh((k) => k + 1); fetchProfiles(); }} />}
    </div>
  )
}

function getProfileCity(p) {
  return p.city || '—'
}

function getProfileRegion(p) {
  return p.region || '—'
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

function AssignProfileModal({ session, profiles, onClose, onSaved }) {
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!selectedId) return
    setSaving(true)
    await supabase.from('profiles').update({ session_formation_id: session.id }).eq('id', selectedId)
    setSaving(false)
    onSaved()
  }

  const available = profiles.filter((p) => p.mat !== 'Archivé')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="rounded-xl border shadow-xl w-full max-w-md p-5" style={{ backgroundColor: '#F5F0E8', borderColor: 'var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold text-sm mb-4" style={{ color: ACCENT }}>Assigner un profil à la session</div>
        <div>
          <label className="block text-[12px] font-medium text-[var(--t3)] mb-1">Profil</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: 'var(--border)' }}>
            <option value="">Sélectionner un profil</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>{p.fn} {p.ln} · {p.co}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={onClose} className="py-2 px-3 rounded-lg text-[13px] font-medium border" style={{ borderColor: ACCENT, color: ACCENT }}>Annuler</button>
          <button type="button" onClick={handleSave} disabled={saving || !selectedId} className="py-2 px-3 rounded-lg text-[13px] font-medium disabled:opacity-50" style={{ backgroundColor: ACCENT, color: 'white' }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}
