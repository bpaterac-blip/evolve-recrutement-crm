import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'

const TITLES = {
  '/': 'Tableau de bord',
  '/pipeline': 'Pipeline recrutement',
  '/profiles': 'Tous les profils',
  '/analytics': 'Analytics',
  '/import': 'Import & Scoring',
  '/chat': 'Chat IA',
}

export default function Layout() {
  const { searchQuery, setSearchQuery, showNotif } = useCRM()
  const location = useLocation()
  const navigate = useNavigate()
  const title = TITLES[location.pathname] || 'Evolve Recruiter'

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 bg-[var(--accent)] flex flex-col overflow-y-auto overflow-x-hidden">
        <div className="logo px-5 pt-[22px] pb-[18px] border-b border-white/10">
          <div className="logo-word font-serif text-xl text-white">Evolve</div>
          <div className="logo-sub text-[10.5px] text-white/40 mt-0.5 uppercase tracking-wider">CRM Recrutement</div>
        </div>
        <div className="nav-sec pt-3.5 px-3 pb-1.5">
          <div className="nav-lbl text-[10px] uppercase tracking-widest text-white/35 px-2 mb-1.5">Vues</div>
          <NavLink to="/" end className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] text-center shrink-0">⌂</span>Tableau de bord</NavLink>
          <NavLink to="/pipeline" className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] text-center shrink-0">◫</span>Pipeline</NavLink>
          <NavLink to="/profiles" className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] text-center shrink-0">◎</span>Tous les profils</NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] text-center shrink-0">↗</span>Analytics</NavLink>
        </div>
        <div className="nav-sec pt-3.5 px-3 pb-1.5">
          <div className="nav-lbl text-[10px] uppercase tracking-widest text-white/35 px-2 mb-1.5">Outils</div>
          <NavLink to="/import" className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] text-center shrink-0">⇪</span>Import & Scoring</NavLink>
          <NavLink to="/chat" className={({ isActive }) => `nitem flex items-center gap-2.5 py-2 px-2.5 rounded-lg cursor-pointer text-[13.5px] transition-all duration-[0.13s] mb-0.5 select-none ${isActive ? 'active bg-white/15 text-white font-medium' : 'text-white/60 hover:bg-white/[0.08] hover:text-white'}`}><span className="nico text-sm w-[18px] text-center shrink-0">✦</span>Chat IA</NavLink>
        </div>
        <div className="mt-auto pt-3 px-3 border-t border-white/10 pb-3">
          <div className="uchip flex items-center gap-2.5 py-2 px-2.5">
            <div className="uav w-[30px] h-[30px] rounded-full bg-[var(--gold)] text-[var(--accent)] text-xs font-semibold flex items-center justify-center shrink-0">B</div>
            <div><div className="text-[13px] text-white/80">Baptiste</div><div className="text-[11px] text-white/40">Responsable réseau</div></div>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Topbar */}
        <div className="topbar bg-[var(--surface)] border-b border-[var(--border)] px-[22px] h-[54px] flex items-center gap-3.5 shrink-0">
          <div className="tbar-ttl font-serif text-lg">{title}</div>
          <div className="srch flex items-center gap-1.5 bg-[var(--s2)] border border-[var(--border)] rounded-lg py-1.5 px-2.5 w-[250px] transition-all">
            <span className="text-[var(--t3)] text-sm">⌕</span>
            <input type="text" placeholder="Rechercher un profil…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="border-none bg-transparent font-[inherit] text-[13px] text-[var(--text)] outline-none w-full placeholder:text-[var(--t3)]" />
          </div>
          <div className="tbar-r ml-auto flex items-center gap-2">
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-new-profile'))} className="btn bo inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg font-[inherit] text-[13px] font-medium cursor-pointer border border-[var(--b2)] bg-transparent text-[var(--t2)] hover:bg-[var(--s2)] hover:text-[var(--text)] transition-all">+ Profil</button>
            <button type="button" onClick={() => navigate('/import')} className="btn bp inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg font-[inherit] text-[13px] font-medium cursor-pointer bg-[var(--accent)] text-white border-none hover:bg-[var(--a2)] transition-all">⇪ Importer CSV</button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
