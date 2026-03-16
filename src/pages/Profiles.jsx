import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import { useAuth } from '../context/AuthContext'
import { useViewMode } from '../context/ViewModeContext'
import { supabase } from '../lib/supabase'
import { STAGES, MATURITIES, SOURCES, STAGE_COLORS, MATURITY_COLORS, INTEG_OPTS, INTEG_ADD_DATE } from '../lib/data'
import InlineDropdown from '../components/InlineDropdown'

const ACCENT = '#173731'
const GOLD = '#D2AB76'

const IconTrash = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
)

const IconDownload = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const IconWarning = () => (
  <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#D2AB76" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

function getPriorityLabel(score) {
  if (score >= 70) return 'Prioritaire'
  if (score >= 40) return 'À travailler'
  return 'À écarter'
}

function escapeCsv(val) {
  if (val == null || val === '') return ''
  const s = String(val)
  if (s.includes(';') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

function ownerDisplay(p) {
  if (p?.owner_full_name?.trim()) return p.owner_full_name.trim()
  const email = p?.owner_email || ''
  if (!email) return '—'
  const name = email.split('@')[0]
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/[._]/g, ' ')
}

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
  const { role } = useAuth()
  const { viewMode } = useViewMode()
  const { profiles, filteredProfiles, changeStage, changeMaturity, changeSource, changeInteg, loading, fetchProfiles } = useCRM()
  const isGlobalView = role === 'admin' && viewMode === 'global'
  const [srcFilter, setSrcFilter] = useState('')
  const [stgFilter, setStgFilter] = useState('')
  const [matFilter, setMatFilter] = useState('')
  const [editingCell, setEditingCell] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

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

  const selectedCount = selectedIds.size
  const allSelected = P.length > 0 && P.every((p) => selectedIds.has(p.id))
  const someSelected = selectedCount > 0

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        P.forEach((p) => next.delete(p.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        P.forEach((p) => next.add(p.id))
        return next
      })
    }
  }

  const handleDeleteSelection = () => {
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    await supabase.from('profiles').delete().in('id', ids)
    setSelectedIds(new Set())
    setDeleteModalOpen(false)
    await fetchProfiles()
  }

  const handleExportCsv = () => {
    const toExport = profiles.filter((p) => selectedIds.has(p.id))
    if (toExport.length === 0) return

    const headers = ['Prénom', 'Nom', 'Employeur', 'Poste', 'URL LinkedIn', 'Score', 'Priorité', 'Stade', 'Maturité', "Date d'import"]
    const rows = toExport.map((p) => [
      escapeCsv(p.fn),
      escapeCsv(p.ln),
      escapeCsv(p.co),
      escapeCsv(p.ti),
      escapeCsv(p.li),
      escapeCsv(p.sc),
      escapeCsv(getPriorityLabel(p.sc)),
      escapeCsv(p.stg),
      escapeCsv(p.mat),
      escapeCsv(p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''),
    ])
    const csv = [headers, ...rows].map((r) => r.join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const today = new Date().toISOString().slice(0, 10)
    const namePart = `${(toExport[0].fn || '')}_${(toExport[0].ln || '')}`.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
    a.download = toExport.length === 1
      ? (namePart ? `profil_${namePart}.csv` : 'profil.csv')
      : `export_profils_${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page h-full overflow-y-auto p-[22px]">
      <div className="tw bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
        <div className="thd py-3 px-4 border-b border-[var(--border)] flex items-center gap-2 flex-wrap">
          <div className="ttl font-semibold text-sm">Tous les profils</div>
          <span className="bdg bg-[var(--s2)] text-[var(--t2)] text-xs py-0.5 px-2 rounded-full font-medium">{P.length} profils</span>
          {someSelected && (
            <div className="flex items-center gap-3" style={{ backgroundColor: 'rgba(210, 171, 118, 0.15)', padding: '6px 12px', borderRadius: 8 }}>
              <span className="text-[13px] font-medium" style={{ color: ACCENT }}>{selectedCount} profil(s) sélectionné(s)</span>
              <button type="button" onClick={handleExportCsv} className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-md text-[12px] font-medium hover:opacity-90" style={{ backgroundColor: ACCENT, color: 'white' }}>
                <IconDownload /> Exporter en CSV
              </button>
              <button type="button" onClick={handleDeleteSelection} className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-md text-[12px] font-medium hover:opacity-90" style={{ backgroundColor: '#dc2626', color: 'white' }}>
                <IconTrash /> Supprimer la sélection
              </button>
            </div>
          )}
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
            <th className="w-10 py-2 px-2 bg-[var(--s2)] border-b border-[var(--border)]">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="cursor-pointer" />
            </th>
            <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Profil</th>
            {isGlobalView && <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Responsable</th>}
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
              <tr><td colSpan={isGlobalView ? 11 : 10} className="py-12 text-center text-[var(--t3)]">Chargement…</td></tr>
            ) : P.length === 0 ? (
              <tr><td colSpan={isGlobalView ? 11 : 10} className="py-12 text-center text-[var(--t3)]">Aucun profil</td></tr>
            ) : P.map((p, i) => (
              <tr key={p.id} className={`border-b border-[var(--border)] hover:bg-[#F8F5F1] last:border-b-0 cursor-pointer ${selectedIds.has(p.id) ? '' : ''}`} style={selectedIds.has(p.id) ? { backgroundColor: 'rgba(210, 171, 118, 0.1)' } : {}} onClick={() => { setEditingCell(null); navigate(`/profiles/${p.id}`); }}>
                <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="cursor-pointer" onClick={(e) => e.stopPropagation()} />
                </td>
                <td className="py-2.5 px-4 cursor-pointer">
                  <div className="pc flex items-center gap-2.5">
                    <div className={`av w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0`} style={{ backgroundColor: ['#D4EDE1', '#D3E4F8', '#FDEBC8', '#EAD8FA', '#FADBD8', '#CCEEF5'][i % 6], color: ['#1A7A4A', '#1E5FA0', '#B86B0F', '#7B3FC4', '#C0392B', '#0E7490'][i % 6] }}>{ini(p.fn, p.ln)}</div>
                    <div><div className="pn font-medium text-[13.5px]">{p.fn} {p.ln}</div><div className="ps text-xs text-[var(--t3)] mt-0.5">{p.co} · {p.ti}</div></div>
                  </div>
                </td>
                {isGlobalView && <td className="py-2.5 px-4 text-[12px] text-[var(--t2)]">{ownerDisplay(p)}</td>}
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

      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setDeleteModalOpen(false)}>
          <div className="rounded-xl border shadow-xl w-full max-w-md p-5" style={{ backgroundColor: '#F5F0E8', borderColor: 'var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center mb-4">
              <span className="mb-3"><IconWarning /></span>
              <p className="text-[14px] font-medium mb-1">
                {selectedCount === 1 ? 'Supprimer ce profil ?' : `Supprimer ${selectedCount} profils ?`}
              </p>
              <p className="text-[13px] text-[var(--t2)]">
                {selectedCount === 1
                  ? 'Cette action est irréversible. Le profil sera définitivement supprimé de la base.'
                  : `Cette action est irréversible. Ces ${selectedCount} profils seront définitivement supprimés de la base.`}
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setDeleteModalOpen(false)} className="py-2 px-3 rounded-lg text-[13px] font-medium border" style={{ borderColor: ACCENT, color: ACCENT, background: 'transparent' }}>Annuler</button>
              <button type="button" onClick={confirmDelete} className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-[13px] font-medium" style={{ backgroundColor: '#dc2626', color: 'white' }}><IconTrash /> Confirmer la suppression</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
