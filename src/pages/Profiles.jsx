import { useState } from 'react'
import { useCRM } from '../context/CRMContext'
import { STAGES, MATURITIES, STAGE_COLORS } from '../lib/data'

const SRC_TAG = { 'Chasse LinkedIn': 'tb', 'Chasse Mail': 'tt', 'Recommandation': 'tp', 'Inbound': 'tg', 'Ads': 'ta', 'Direct contact': 'tx' }

export default function Profiles() {
  const { filteredProfiles, changeStage, changeMaturity, loading } = useCRM()
  const [srcFilter, setSrcFilter] = useState('')
  const [stgFilter, setStgFilter] = useState('')

  const P = filteredProfiles.filter((p) => (!srcFilter || p.src === srcFilter) && (!stgFilter || p.stg === stgFilter))

  const ini = (a, b) => (a?.[0] || '') + (b?.[0] || '')
  const scpill = (s) => s >= 70 ? 'sh' : s >= 45 ? 'sm2' : 'sl'
  const srctag = (s) => SRC_TAG[s] || 'tx'
  const stag = (s) => STAGE_COLORS[s] ? { backgroundColor: STAGE_COLORS[s].bg, color: STAGE_COLORS[s].text } : {}

  return (
    <div className="page h-full overflow-y-auto p-[22px]">
      <div className="tw bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
        <div className="thd py-3 px-4 border-b border-[var(--border)] flex items-center gap-2 flex-wrap">
          <div className="ttl font-semibold text-sm">Tous les profils</div>
          <span className="bdg bg-[var(--s2)] text-[var(--t2)] text-xs py-0.5 px-2 rounded-full font-medium">{P.length} profils</span>
          <div className="frow flex gap-1.5 ml-auto">
            <select className="fsel font-[inherit] text-xs py-1 px-2 border border-[var(--b2)] rounded-md text-[var(--text)] bg-[var(--surface)] outline-none cursor-pointer" value={srcFilter} onChange={(e) => setSrcFilter(e.target.value)}>
              <option value="">Toutes sources</option>
              <option>Chasse LinkedIn</option><option>Chasse Mail</option><option>Recommandation</option><option>Inbound</option>
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
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Source</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Score</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Maturité</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Stade</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Intégration prév.</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Contact</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-12 text-center text-[var(--t3)]">Chargement…</td></tr>
            ) : P.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-[var(--t3)]">Aucun profil</td></tr>
            ) : P.map((p, i) => (
              <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[#F8F5F1] last:border-b-0">
                <td className="py-2.5 px-4 cursor-pointer" onClick={() => window.dispatchEvent(new CustomEvent('open-profile', { detail: p }))}>
                  <div className="pc flex items-center gap-2.5">
                    <div className={`av w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0`} style={{ backgroundColor: ['#D4EDE1', '#D3E4F8', '#FDEBC8', '#EAD8FA', '#FADBD8', '#CCEEF5'][i % 6], color: ['#1A7A4A', '#1E5FA0', '#B86B0F', '#7B3FC4', '#C0392B', '#0E7490'][i % 6] }}>{ini(p.fn, p.ln)}</div>
                    <div><div className="pn font-medium text-[13.5px]">{p.fn} {p.ln}</div><div className="ps text-xs text-[var(--t3)] mt-0.5">{p.co} · {p.ti}</div></div>
                  </div>
                </td>
                <td className="py-2.5 px-4 text-[var(--t2)]">{p.city}</td>
                <td className="py-2.5 px-4"><span className={`tag ${srctag(p.src)}`}>{p.src}</span></td>
                <td className="py-2.5 px-4"><span className={`sc inline-flex items-center justify-center w-9 h-6 rounded-md ${scpill(p.sc)}`}>{p.sc}</span></td>
                <td className="py-2.5 px-4">
                  <select className="border border-[var(--b2)] rounded-md text-[13px] py-0.5 px-1 bg-[var(--surface)] outline-none cursor-pointer" value={p.mat} onChange={(e) => changeMaturity(p.id, e.target.value)}>
                    {MATURITIES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
                <td className="py-2.5 px-4">
                  <select className="border border-[var(--b2)] rounded-md text-[13px] py-0.5 px-1 bg-[var(--surface)] outline-none cursor-pointer" value={p.stg} onChange={(e) => changeStage(p.id, e.target.value)}>
                    {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="py-2.5 px-4 text-[12.5px]" style={{ color: p.integ && p.integ !== '—' && p.integ !== 'Intégré' ? 'var(--accent)' : 'var(--t3)' }}>{p.integ || '—'}</td>
                <td className="py-2.5 px-4 text-[var(--t3)] text-xs">{p.dt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
