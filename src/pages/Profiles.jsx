import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import { STAGES, MATURITIES, SOURCES, STAGE_COLORS, MATURITY_COLORS, INTEG_OPTS, INTEG_ADD_DATE } from '../lib/data'
import InlineDropdown from '../components/InlineDropdown'

const SRC_TAG = { 'Chasse LinkedIn': 'tb', 'Chasse Mail': 'tt', 'Recommandation': 'tp', 'Inbound': 'tg', 'Ads': 'ta', 'Chasse externe': 'ta', 'Direct contact': 'tx' }

const DROPDOWN_Z = 9999

function openDropdown(e, editingCell, setEditingCell, profileId, field, extra = {}) {
  e.stopPropagation()
  if (editingCell?.profileId === profileId && editingCell?.field === field && !editingCell?.integCustomMode) {
    setEditingCell(null)
    return
  }
  const r = e.currentTarget.getBoundingClientRect()
  setEditingCell({ profileId, field, rect: { left: r.left, bottom: r.bottom, width: r.width }, ...extra })
}

export default function Profiles() {
  const navigate = useNavigate()
  const { filteredProfiles, changeStage, changeMaturity, changeSource, changeInteg, loading } = useCRM()
  const [srcFilter, setSrcFilter] = useState('')
  const [stgFilter, setStgFilter] = useState('')
  const [matFilter, setMatFilter] = useState('')
  const [editingCell, setEditingCell] = useState(null) // { profileId, field, rect, integCustomMode?, integCustomValue? }

  const P = filteredProfiles.filter((p) => {
    if (srcFilter && p.src !== srcFilter) return false
    if (stgFilter && p.stg !== stgFilter) return false
    if (matFilter === 'Sans archivés' && p.mat === 'Archivé') return false
    if (matFilter && matFilter !== 'Sans archivés' && p.mat !== matFilter) return false
    return true
  })

  const ini = (a, b) => (a?.[0] || '') + (b?.[0] || '')
  const scpill = (s) => s >= 70 ? 'sh' : s >= 45 ? 'sm2' : 'sl'
  const srctag = (s) => SRC_TAG[s] || 'tx'
  const stag = (s) => STAGE_COLORS[s] ? { backgroundColor: STAGE_COLORS[s].bg, color: STAGE_COLORS[s].text } : {}
  const mattag = (m) => ({ Froid: 'tx', Tiède: 'ta', Chaud: 'tb', 'Très chaud': 'tg' }[m] || 'tx')
  const currentProfile = editingCell ? P.find((p) => p.id === editingCell.profileId) : null

  return (
    <div className="page h-full overflow-y-auto p-[22px]">
      <div className="tw bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
        <div className="thd py-3 px-4 border-b border-[var(--border)] flex items-center gap-2 flex-wrap">
          <div className="ttl font-semibold text-sm">Tous les profils</div>
          <span className="bdg bg-[var(--s2)] text-[var(--t2)] text-xs py-0.5 px-2 rounded-full font-medium">{P.length} profils</span>
          <div className="frow flex gap-1.5 ml-auto">
            <select className="fsel font-[inherit] text-xs py-1 px-2 border border-[var(--b2)] rounded-md text-[var(--text)] bg-[var(--surface)] outline-none cursor-pointer" value={srcFilter} onChange={(e) => setSrcFilter(e.target.value)}>
              <option value="">Toutes sources</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="fsel font-[inherit] text-xs py-1 px-2 border border-[var(--b2)] rounded-md text-[var(--text)] bg-[var(--surface)] outline-none cursor-pointer" value={stgFilter} onChange={(e) => setStgFilter(e.target.value)}>
              <option value="">Tous stades</option>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <table className="w-full border-collapse">
          <thead><tr>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Profil</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Ville</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Région</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Source</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Score</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Maturité</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Stade</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Intégration pot.</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Contact</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-12 text-center text-[var(--t3)]">Chargement…</td></tr>
            ) : P.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-[var(--t3)]">Aucun profil</td></tr>
            ) : P.map((p, i) => (
              <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[#F8F5F1] last:border-b-0" onClick={() => { setEditingCell(null); navigate(`/profiles/${p.id}`); }}>
                <td className="py-2.5 px-4 cursor-pointer">
                  <div className="pc flex items-center gap-2.5">
                    <div className={`av w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0`} style={{ backgroundColor: ['#D4EDE1', '#D3E4F8', '#FDEBC8', '#EAD8FA', '#FADBD8', '#CCEEF5'][i % 6], color: ['#1A7A4A', '#1E5FA0', '#B86B0F', '#7B3FC4', '#C0392B', '#0E7490'][i % 6] }}>{ini(p.fn, p.ln)}</div>
                    <div><div className="pn font-medium text-[13.5px]">{p.fn} {p.ln}</div><div className="ps text-xs text-[var(--t3)] mt-0.5">{p.co} · {p.ti}</div></div>
                  </div>
                </td>
                <td className="py-2.5 px-4 text-[var(--t2)]">{p.city}</td>
                <td className="py-2.5 px-4 text-[var(--t2)]">{p.region || '—'}</td>
                <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                  <InlineDropdown options={SOURCES} value={p.src} onChange={(v) => changeSource(p.id, v)} buttonClassName={`tag tag-btn ${srctag(p.src)}`} />
                </td>
                <td className="py-2.5 px-4"><span className={`sc inline-flex items-center justify-center w-9 h-6 rounded-md ${scpill(p.sc)}`}>{p.sc}</span></td>
                <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                  <InlineDropdown options={MATURITIES} value={p.mat} onChange={(v) => changeMaturity(p.id, v)} buttonStyle={(v) => MATURITY_COLORS[v] || {}} buttonClassName="tag tag-btn px-2 py-0.5 rounded-md text-xs" />
                </td>
                <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                  <InlineDropdown options={STAGES} value={p.stg} onChange={(v) => changeStage(p.id, v)} buttonStyle={(v) => STAGE_COLORS[v] || {}} buttonClassName="tag tag-btn px-2 py-0.5 rounded-md text-xs" placeholder="—" />
                </td>
                <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="tag tag-btn px-2 py-0.5 rounded-md text-xs" style={{ background: '#D4EDE1', color: '#1A7A4A' }} onClick={(e) => openDropdown(e, editingCell, setEditingCell, p.id, 'integ')}>{(p.integ || '—')} ▾</button>
                </td>
                <td className="py-2.5 px-4 text-[var(--t3)] text-xs">{p.dt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingCell?.rect && currentProfile && (editingCell.field === 'integ' || editingCell.integCustomMode) && (
        <div
          className="ddrop bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg p-1 min-w-[140px] max-h-[280px] overflow-y-auto"
          style={{ position: 'fixed', left: editingCell.rect.left, top: editingCell.rect.bottom + 4, zIndex: DROPDOWN_Z }}
          onClick={(e) => e.stopPropagation()}
        >
          {editingCell.field === 'integ' && !editingCell.integCustomMode && (
            <>
              {INTEG_OPTS.map((o) => (
                <div key={o} className={`ddi py-1.5 px-2.5 rounded-md text-[13px] cursor-pointer hover:bg-[var(--s2)] ${(currentProfile.integ || '—') === o ? 'font-semibold' : ''}`} onClick={() => { changeInteg(currentProfile.id, o); setEditingCell(null); }}>{o}</div>
              ))}
              <div className="ddi border-t border-[var(--border)] mt-1 pt-1 py-1.5 px-2.5 rounded-md text-[13px] cursor-pointer hover:bg-[var(--s2)] text-[var(--accent)] font-medium" onClick={() => setEditingCell((c) => ({ ...c, integCustomMode: true, integCustomValue: '' }))}>{INTEG_ADD_DATE}</div>
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
    </div>
  )
}
