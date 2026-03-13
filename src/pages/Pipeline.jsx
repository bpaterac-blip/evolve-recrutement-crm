import { useCRM } from '../context/CRMContext'
import { STAGES, STAGE_COLORS } from '../lib/data'

export default function Pipeline() {
  const { filteredProfiles } = useCRM()
  const pipeline = filteredProfiles.filter((p) => p.stg !== 'Recruté')
  const all = filteredProfiles

  const ini = (a, b) => (a?.[0] || '') + (b?.[0] || '')

  return (
    <div id="pg-pipeline" className="h-full flex flex-col overflow-hidden">
      <div className="pipbar py-4 px-5 pt-4 flex items-center gap-3 shrink-0">
        <div className="font-semibold text-sm">Pipeline recrutement — vue Kanban</div>
        <span className="bdg bg-[var(--s2)] text-[var(--t2)] text-xs py-0.5 px-2 rounded-full font-medium">{pipeline.length} profils actifs</span>
        <button type="button" className="btn bp bsm py-1.5 px-2.5 text-xs ml-auto" onClick={() => window.dispatchEvent(new CustomEvent('open-new-profile'))}>+ Nouveau profil</button>
      </div>
      <div className="kb flex gap-3 py-3.5 px-5 pb-5 overflow-x-auto flex-1 items-start">
        {STAGES.map((st) => {
          const cards = all.filter((p) => p.stg === st)
          const c = STAGE_COLORS[st] || {}
          return (
            <div key={st} className="kcol w-[215px] shrink-0 flex flex-col gap-1.5">
              <div className="kch flex items-center justify-between py-2 px-3 rounded-lg text-xs font-semibold" style={{ background: c.bg, color: c.text }}>
                <span>{st}</span>
                <span className="bg-white/60 py-0.5 px-1.5 rounded-[10px] text-[11px]">{cards.length}</span>
              </div>
              <div>
                {cards.map((p) => (
                  <div key={p.id} className="kc bg-[var(--surface)] border border-[var(--border)] rounded-lg py-2.5 px-3 cursor-pointer transition-all hover:shadow-md hover:-translate-y-px" style={{ borderLeft: `3px solid ${c.text}` }} onClick={() => window.dispatchEvent(new CustomEvent('open-profile', { detail: p }))}>
                    <div className="kcn font-medium text-[13px]">{p.fn} {p.ln}</div>
                    <div className="kcc text-[11.5px] text-[var(--t3)] mt-0.5">{p.co} · {p.city}</div>
                    {p.integ && p.integ !== '—' && <div className="text-[11px] text-[var(--accent)] mt-1">📅 {p.integ}</div>}
                    <div className="kcf flex items-center justify-between mt-2">
                      <span className="kcd text-[11px] text-[var(--t3)]">{p.dt}</span>
                      {st !== 'Recruté' ? <button type="button" className="kbtn text-[11px] py-0.5 px-2 rounded-md bg-[var(--s2)] text-[var(--accent)] border-none cursor-pointer font-medium hover:bg-[var(--border)]" onClick={(e) => { e.stopPropagation(); }}>+ RDV</button> : <span className="tag tg text-[10px]">Intégré ✓</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
