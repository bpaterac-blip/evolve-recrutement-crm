import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import { STAGES, SOURCES, STAGE_COLORS, INTEG_OPTS, INTEG_ADD_DATE } from '../lib/data'
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

export default function Dashboard() {
  const { filteredProfiles, changeStage, changeSource, changeInteg } = useCRM()
  const navigate = useNavigate()
  const [editingCell, setEditingCell] = useState(null) // { profileId, field, rect, integCustomMode?, integCustomValue? }
  const P = [...filteredProfiles].sort((a, b) => {
    if (a.created_at && b.created_at) return new Date(b.created_at) - new Date(a.created_at)
    if (typeof a.id === 'number' && typeof b.id === 'number') return b.id - a.id
    return String(b.id || '').localeCompare(String(a.id || ''))
  })
  const recent = P.slice(0, 7)
  const currentProfile = editingCell ? recent.find((p) => p.id === editingCell.profileId) : null
  const INTEG_STAGES = ['R2 Amaury', 'Point juridique', 'Démission reconversion', 'Recruté']
  const integrs = P.filter((x) => x.integ && x.integ !== '—' && x.integ !== 'Intégré' && INTEG_STAGES.includes(x.stg))
  const pipeline = P.filter((p) => p.stg !== 'Recruté')
  const recruited = P.filter((p) => p.stg === 'Recruté')

  const ini = (a, b) => (a?.[0] || '') + (b?.[0] || '')
  const scpill = (s) => s >= 70 ? 'sh' : s >= 45 ? 'sm2' : 'sl'
  const srctag = (s) => SRC_TAG[s] || 'tx'
  const stag = (s) => STAGE_COLORS[s] ? { backgroundColor: STAGE_COLORS[s].bg, color: STAGE_COLORS[s].text } : {}

  return (
    <div className="page h-full overflow-y-auto p-[22px]">
      <div className="font-serif text-[22px] mb-1">Bonjour Baptiste 👋</div>
      <div className="text-[13px] text-[var(--t3)] mb-5">Pipeline au 13 mars 2026</div>
      <div className="stats-row grid grid-cols-4 gap-3 mb-5">
        <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
          <div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Contactés (mars)</div>
          <div className="sval text-[26px] font-semibold leading-none">34</div>
          <div className="ssub text-xs text-[var(--t3)] mt-1">+12 vs février</div>
        </div>
        <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
          <div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">En pipeline actif</div>
          <div className="sval text-[26px] font-semibold leading-none">{pipeline.length}</div>
          <div className="ssub text-xs text-[var(--t3)] mt-1">Tous stades</div>
        </div>
        <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
          <div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Recrutés 2026</div>
          <div className="sval text-[26px] font-semibold leading-none">{recruited.length}</div>
          <div className="ssub text-xs mt-1" style={{ color: 'var(--green)' }}>↑ +1 ce mois</div>
        </div>
        <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
          <div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Taux conversion</div>
          <div className="sval text-[26px] font-semibold leading-none">8,8%</div>
          <div className="ssub text-xs text-[var(--t3)] mt-1">R0 → Recruté</div>
        </div>
      </div>
      <div className="tw bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden mb-5">
        <div className="thd py-3 px-4 border-b border-[var(--border)] flex items-center gap-2 flex-wrap">
          <div className="ttl font-semibold text-sm">Activité récente</div>
          <span className="bdg bg-[var(--s2)] text-[var(--t2)] text-xs py-0.5 px-2 rounded-full font-medium">{recent.length} actions</span>
          <button type="button" className="btn bo bsm py-1.5 px-2.5 text-xs ml-auto" onClick={() => navigate('/profiles')}>Voir tous →</button>
        </div>
        <table className="w-full border-collapse">
          <thead><tr>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Profil</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Dernière action</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Source</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Score</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Stade</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Intégration pot.</th>
          </tr></thead>
          <tbody>
            {recent.map((p, i) => (
              <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[#F8F5F1] cursor-pointer last:border-b-0" onClick={() => { setEditingCell(null); navigate(`/profiles/${p.id}`); }}>
                <td className="py-2.5 px-4 align-middle text-[13.5px]">
                  <div className="pc flex items-center gap-2.5">
                    <div className={`av w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${i % 2 ? 'avb bg-[#D3E4F8] text-[#1E5FA0]' : 'avg bg-[#D4EDE1] text-[#1A7A4A]'}`}>{ini(p.fn, p.ln)}</div>
                    <div><div className="pn font-medium text-[13.5px]">{p.fn} {p.ln}</div><div className="ps text-xs text-[var(--t3)] mt-0.5">{p.co}</div></div>
                  </div>
                </td>
                <td className="py-2.5 px-4 text-[var(--t2)] text-[13px]">{p.acts?.[0]?.t || (p.dt ? `Ajouté le ${p.dt}` : '—')}</td>
                <td className="py-2.5 px-4 align-middle" onClick={(e) => e.stopPropagation()}>
                  <InlineDropdown options={SOURCES} value={p.src} onChange={(v) => changeSource(p.id, v)} buttonClassName={`tag tag-btn ${srctag(p.src)}`} />
                </td>
                <td className="py-2.5 px-4"><span className={`sc inline-flex items-center justify-center w-9 h-6 rounded-md ${scpill(p.sc)}`}>{p.sc}</span></td>
                <td className="py-2.5 px-4 align-middle" onClick={(e) => e.stopPropagation()}>
                  <InlineDropdown options={STAGES} value={p.stg} onChange={(v) => changeStage(p.id, v)} buttonStyle={(v) => stag(v)} buttonClassName="tag tag-btn px-2 py-0.5 rounded-md text-xs" />
                </td>
                <td className="py-2.5 px-4 align-middle" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="tag tag-btn px-2 py-0.5 rounded-md text-xs" style={{ background: '#D4EDE1', color: '#1A7A4A' }} onClick={(e) => openDropdown(e, editingCell, setEditingCell, p.id, 'integ')}>{(p.integ || '—')} ▾</button>
                </td>
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

      <div className="tw bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden mb-0">
        <div className="thd py-3 px-4 border-b border-[var(--border)] flex items-center gap-2">
          <div className="ttl font-semibold text-sm">Intégrations potentielles</div>
          <span className="bdg bg-[var(--s2)] text-[var(--t2)] text-xs py-0.5 px-2 rounded-full font-medium">{integrs.length} profils</span>
        </div>
        <table className="w-full border-collapse">
          <thead><tr>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Profil</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Stade actuel</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Date d'intégration potentielle</th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Ville</th>
          </tr></thead>
          <tbody>
            {integrs.map((p, i) => (
              <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[#F8F5F1] cursor-pointer last:border-b-0" onClick={() => navigate(`/profiles/${p.id}`)}>
                <td className="py-2.5 px-4"><div className="pc flex items-center gap-2.5"><div className={`av w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${i % 2 ? 'avb' : 'avg'}`} style={{ backgroundColor: i % 2 ? '#D3E4F8' : '#D4EDE1', color: i % 2 ? '#1E5FA0' : '#1A7A4A' }}>{ini(p.fn, p.ln)}</div><div className="pn font-medium">{p.fn} {p.ln}</div></div></td>
                <td className="py-2.5 px-4"><span className="tag px-2 py-0.5 rounded-md text-xs" style={stag(p.stg)}>{p.stg}</span></td>
                <td className="py-2.5 px-4 font-semibold text-[var(--accent)]">{p.integ}</td>
                <td className="py-2.5 px-4 text-[var(--t3)]">{p.city}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
