import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import { useAuth } from '../context/AuthContext'
import { useViewMode } from '../context/ViewModeContext'
import { IconArrowUp, IconStar } from './Icons'

const TITLES = {
  '/': 'Tableau de bord',
  '/pipeline': 'Pipeline recrutement',
  '/profiles': 'Tous les profils',
  '/analytics': 'Analytics',
  '/import': 'Import & Scoring',
  '/chat': 'Chat IA',
  '/tickets': 'Tickets',
  '/admin/console': 'Console Administrateur',
  '/admin/tickets': 'Tickets (Admin)',
  '/admin/scoring-learning': 'Apprentissage Scoring',
}

const ACCENT = '#173731'

export default function Layout() {
  const { searchQuery, setSearchQuery } = useCRM()
  const { user, userProfile, role, signOut } = useAuth()
  const { viewMode, setViewMode } = useViewMode()
  const location = useLocation()
  const navigate = useNavigate()
  const title = TITLES[location.pathname] || 'Evolve Recruiter'
  console.log('Layout role:', role, 'role === "admin":', role === 'admin')

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 bg-[var(--accent)] flex flex-col overflow-y-auto overflow-x-hidden">
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          marginLeft: '-8px',
          padding: '24px 0'
        }}>
          <Link
            to="/"
            className="group block relative py-2 rounded-[8px] transition-all duration-200 hover:bg-[rgba(255,255,255,0.08)]"
            style={{ cursor: 'pointer' }}
          >
            <div className="relative flex flex-col items-center">
              <img src="/logo-evolve.svg" alt="Evolve Recruiter" width="120" />
              <span
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 py-1.5 px-2.5 whitespace-nowrap text-[12px] font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-10"
                style={{ background: '#fff', color: '#173731', borderRadius: 6 }}
              >
                Retour au Tableau de bord
              </span>
            </div>
          </Link>
        </div>
        <div className="nav-sec pt-3.5 px-3 pb-1.5">
          <div className="nav-lbl text-[10px] uppercase tracking-widest text-white/35 px-2 mb-1.5">Vues</div>
          <NavLink to="/" end className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] text-center shrink-0">⌂</span>Tableau de bord</NavLink>
          <NavLink to="/pipeline" className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] text-center shrink-0">◫</span>Pipeline</NavLink>
          <NavLink to="/profiles" className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] text-center shrink-0">◎</span>Tous les profils</NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] shrink-0 inline-flex items-center justify-center"><IconArrowUp /></span>Analytics</NavLink>
        </div>
        <div className="nav-sec pt-3.5 px-3 pb-1.5">
          <div className="nav-lbl text-[10px] uppercase tracking-widest text-white/35 px-2 mb-1.5">Outils</div>
          <NavLink to="/import" className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] text-center shrink-0">⇪</span>Import & Scoring</NavLink>
          <NavLink to="/chat" className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] shrink-0 inline-flex items-center justify-center"><IconStar /></span>Chat IA</NavLink>
          <NavLink to="/tickets" className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] text-center shrink-0 inline-flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9Z"/><path d="M7 9v6"/><path d="M12 9v6"/><path d="M17 9v6"/></svg></span>Tickets</NavLink>
        </div>
        {role === 'admin' && (
          <div className="nav-sec pt-3.5 px-3 pb-1.5">
            <div className="nav-lbl text-[10px] uppercase tracking-widest text-white/35 px-2 mb-1.5">Administrateur</div>
            <NavLink to="/admin/console" className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] text-center shrink-0 inline-flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>Console</NavLink>
            <NavLink to="/admin/scoring-learning" className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] text-center shrink-0 inline-flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0-.34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg></span>Apprentissage</NavLink>
            <NavLink to="/admin/tickets" className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] text-center shrink-0 inline-flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9Z"/><path d="M7 9v6"/><path d="M12 9v6"/><path d="M17 9v6"/></svg></span>Tickets</NavLink>
          </div>
        )}
        <div className="mt-auto pt-3 px-3 border-t border-white/10 pb-3 space-y-2">
          <div className="uchip flex items-center gap-2.5 py-2 px-2.5">
            <div className="uav w-[30px] h-[30px] rounded-full bg-[var(--gold)] text-[var(--accent)] text-xs font-semibold flex items-center justify-center shrink-0">
              {(userProfile?.first_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-white/80 truncate">{userProfile?.full_name?.trim() || user?.email || 'Utilisateur'}</div>
              <div className="text-[11px] text-white/40">Connecté</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-[13px] text-white/60 hover:bg-white/10 hover:text-white transition-all cursor-pointer font-[inherit] border-none bg-transparent text-left"
          >
            <span className="nico text-sm w-[18px] text-center shrink-0">↪</span>
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Topbar */}
        <div className="topbar bg-[var(--surface)] border-b border-[var(--border)] px-[22px] h-[54px] flex items-center gap-3.5 shrink-0">
          <div className="tbar-ttl font-serif text-lg">{title}</div>
          {role === 'admin' && (
            <div className="flex items-center gap-0 rounded-md border" style={{ borderColor: ACCENT }}>
              <button type="button" onClick={() => setViewMode('personal')} className="py-1 px-3 text-[12px] font-medium rounded-l-md transition-colors" style={{ backgroundColor: viewMode === 'personal' ? ACCENT : 'transparent', color: viewMode === 'personal' ? 'white' : ACCENT }}>Ma vue</button>
              <button type="button" onClick={() => setViewMode('global')} className="py-1 px-3 text-[12px] font-medium rounded-r-md transition-colors" style={{ backgroundColor: viewMode === 'global' ? ACCENT : 'transparent', color: viewMode === 'global' ? 'white' : ACCENT }}>Vue globale</button>
            </div>
          )}
          <div className="srch flex items-center gap-1.5 bg-[var(--s2)] border border-[var(--border)] rounded-lg py-1.5 px-2.5 w-[250px] transition-all">
            <span className="text-[var(--t3)] text-sm">⌕</span>
            <input type="text" placeholder="Rechercher un profil…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="border-none bg-transparent font-[inherit] text-[13px] text-[var(--text)] outline-none w-full placeholder:text-[var(--t3)]" />
          </div>
          <div className="tbar-r ml-auto flex items-center gap-2">
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-new-profile'))} className="btn bo inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg font-[inherit] text-[13px] font-medium cursor-pointer border border-[var(--b2)] bg-transparent text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--text)] transition-all">+ Profil</button>
            <button type="button" onClick={() => navigate('/import')} className="btn bp inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg font-[inherit] text-[13px] font-medium cursor-pointer bg-[var(--accent)] text-white border-none hover:bg-[var(--a2)] transition-all">⇪ Import</button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
