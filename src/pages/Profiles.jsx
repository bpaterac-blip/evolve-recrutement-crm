import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import { useAuth } from '../context/AuthContext'
import { useViewMode } from '../context/ViewModeContext'
import { supabase } from '../lib/supabase'
import { STAGES, MATURITIES, SOURCES } from '../lib/data'
import InlineDropdown from '../components/InlineDropdown'

const ACCENT = '#173731'
const GOLD = '#D2AB76'

const SOURCE_STYLES = {
  'Chasse LinkedIn': { backgroundColor: '#eff6ff', color: '#1d4ed8' },
  Recommandation: { backgroundColor: '#fefce8', color: '#a16207' },
  'Chasse Mail': { backgroundColor: '#f0fdf4', color: '#15803d' },
  'Chasse externe': { backgroundColor: '#fff7ed', color: '#c2410c' },
  'Inbound Marketing': { backgroundColor: '#faf5ff', color: '#7e22ce' },
  Ads: { backgroundColor: '#fff1f2', color: '#e11d48' },
  Autre: { backgroundColor: '#f8fafc', color: '#94a3b8' },
  Inbound: { backgroundColor: '#faf5ff', color: '#7e22ce' },
  'Direct contact': { backgroundColor: '#f8fafc', color: '#94a3b8' },
}

const MATURITY_STYLES = {
  Chaud: { backgroundColor: '#fff1f2', color: '#e11d48' },
  Tiède: { backgroundColor: '#fff7ed', color: '#ea580c' },
  Froid: { backgroundColor: '#f8fafc', color: '#94a3b8' },
  Chute: { backgroundColor: '#fff1f2', color: '#e11d48', fontStyle: 'italic' },
  Archivé: { backgroundColor: '#f8fafc', color: '#cbd5e1' },
  'Très chaud': { backgroundColor: '#fff1f2', color: '#e11d48' },
}

const STAGE_STYLES = {
  R0: { backgroundColor: '#eff6ff', color: '#1d4ed8' },
  R1: { backgroundColor: '#f0fdf4', color: '#15803d' },
  "Point d'étape téléphonique": { backgroundColor: '#fefce8', color: '#a16207' },
  "Point d'étape": { backgroundColor: '#fefce8', color: '#a16207' },
  'R2 Amaury': { backgroundColor: '#fff7ed', color: '#c2410c' },
  'Point juridique': { backgroundColor: '#faf5ff', color: '#7e22ce' },
  'Démission reconversion': { backgroundColor: '#fff1f2', color: '#e11d48' },
  Intégration: { backgroundColor: '#dcfce7', color: '#15803d' },
  Recruté: { backgroundColor: ACCENT, color: GOLD },
  Démission: { backgroundColor: '#fff1f2', color: '#e11d48' },
}

function getScoreStyle(score) {
  if (score == null) return { backgroundColor: '#f8fafc', color: '#94a3b8' }
  if (score >= 70) return { backgroundColor: '#dcfce7', color: '#15803d' }
  if (score >= 50) return { backgroundColor: '#fefce8', color: '#a16207' }
  return { backgroundColor: '#f8fafc', color: '#94a3b8' }
}

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

function formatSession(p) {
  if (p?.integration_periode && p?.integration_annee) return `${p.integration_periode} ${p.integration_annee}`
  if (p?.integration_periode) return p.integration_periode
  if (p?.integration_annee) return p.integration_annee
  return null
}

function formatAddedDate(p) {
  if (p?.created_at) return new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  return p?.dt || '—'
}

export default function Profiles() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const { viewMode } = useViewMode()
  const { profiles, filteredProfiles, changeStage, changeMaturity, changeSource, loading, fetchProfiles } = useCRM()
  const isGlobalView = role === 'admin' && viewMode === 'global'
  const [srcFilter, setSrcFilter] = useState('')
  const [stgFilter, setStgFilter] = useState('')
  const [matFilter, setMatFilter] = useState('')
  const [openDropdownId, setOpenDropdownId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.source-dropdown') && !e.target.closest('.maturite-dropdown') && !e.target.closest('.stade-dropdown')) {
        setOpenDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const P = filteredProfiles.filter((p) => {
    if (srcFilter && p.src !== srcFilter) return false
    if (stgFilter && p.stg !== stgFilter) return false
    if (matFilter === 'Sans archivés' && p.mat === 'Archivé') return false
    if (matFilter && matFilter !== 'Sans archivés' && p.mat !== matFilter) return false
    return true
  })

  const ini = (a, b) => (a?.[0] || '') + (b?.[0] || '')
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

  const handleDeleteSelection = () => setDeleteModalOpen(true)

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
    a.download = toExport.length === 1 ? (namePart ? `profil_${namePart}.csv` : 'profil.csv') : `export_profils_${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const headerCellStyle = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#bbb',
    padding: '12px 20px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  }

  const rowStyle = {
    padding: '14px 20px',
    borderBottom: '1px solid rgba(0,0,0,0.04)',
    transition: 'background 0.12s',
  }

  return (
    <div style={{ padding: 22, background: '#F5F0E8' }}>
      <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', overflow: 'visible' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>Tous les profils</h1>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 20, background: ACCENT, color: GOLD, fontSize: 12, fontWeight: 600 }}>
            {P.length} profils
          </span>
          {someSelected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', borderRadius: 8, background: 'rgba(210, 171, 118, 0.15)' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: ACCENT }}>{selectedCount} profil(s) sélectionné(s)</span>
              <button type="button" onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: ACCENT, color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 500, border: 'none' }}>
                <IconDownload /> Exporter en CSV
              </button>
              <button type="button" onClick={handleDeleteSelection} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: '#dc2626', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 500, border: 'none' }}>
                <IconTrash /> Supprimer la sélection
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <select value={srcFilter} onChange={(e) => setSrcFilter(e.target.value)} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: '#1A1A1A', cursor: 'pointer', outline: 'none' }}>
              <option value="">Toutes sources</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={stgFilter} onChange={(e) => setStgFilter(e.target.value)} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: '#1A1A1A', cursor: 'pointer', outline: 'none' }}>
              <option value="">Tous stades</option>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={matFilter} onChange={(e) => setMatFilter(e.target.value)} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: '#1A1A1A', cursor: 'pointer', outline: 'none' }}>
              <option value="">Toutes maturités</option>
              <option value="Sans archivés">Sans archivés</option>
              {MATURITIES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...headerCellStyle, width: 48, textAlign: 'left' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
              </th>
              <th style={{ ...headerCellStyle, textAlign: 'left' }}>Profil</th>
              <th style={{ ...headerCellStyle, textAlign: 'left' }}>Source</th>
              <th style={{ ...headerCellStyle, textAlign: 'left' }}>Score</th>
              <th style={{ ...headerCellStyle, textAlign: 'left' }}>Maturité</th>
              <th style={{ ...headerCellStyle, textAlign: 'left' }}>Stade</th>
              <th style={{ ...headerCellStyle, textAlign: 'left' }}>Session</th>
              <th style={{ ...headerCellStyle, textAlign: 'left' }}>Ajouté</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ ...rowStyle, padding: 48, textAlign: 'center', color: '#bbb' }}>Chargement…</td>
              </tr>
            ) : P.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...rowStyle, padding: 48, textAlign: 'center', color: '#bbb' }}>Aucun profil</td>
              </tr>
            ) : (
              P.map((p) => {
                const sessionStr = formatSession(p)
                const scoreStyle = getScoreStyle(p.sc)
                const srcStyle = SOURCE_STYLES[p.src] || { backgroundColor: '#f8fafc', color: '#94a3b8' }
                return (
                  <tr
                    key={p.id}
                    style={{ ...rowStyle, cursor: 'pointer', background: selectedIds.has(p.id) ? 'rgba(210, 171, 118, 0.1)' : undefined }}
                    onMouseEnter={(e) => { if (!selectedIds.has(p.id)) e.currentTarget.style.background = '#faf9f7' }}
                    onMouseLeave={(e) => { if (!selectedIds.has(p.id)) e.currentTarget.style.background = '' }}
                    onClick={() => { setOpenDropdownId(null); navigate(`/profiles/${p.id}`) }}
                  >
                    <td style={rowStyle} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} style={{ cursor: 'pointer' }} onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td style={rowStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: ACCENT, color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                          {ini(p.fn, p.ln)}
                        </div>
                        <div style={{ minWidth: 0, maxWidth: 350 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>{p.fn} {p.ln}</div>
                          <div style={{ fontSize: 11, color: '#bbb', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[p.co, p.ti, p.city, p.region].filter(Boolean).join(' · ') || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={rowStyle} onClick={(e) => e.stopPropagation()}>
                      <div className="source-dropdown" style={{ maxWidth: 130 }}>
                        <InlineDropdown
                          options={SOURCES}
                          value={p.src}
                          onChange={(v) => { changeSource(p.id, v); setOpenDropdownId(null) }}
                          formatDisplay={(v) => ((v === 'Inbound Marketing' || v === 'Inbound') ? 'Inbound Mktg' : v)}
                          buttonClassName=""
                          buttonStyle={{ display: 'inline-block', borderRadius: 20, padding: '3px 7px', fontSize: 10, fontWeight: 600, border: 'none', cursor: 'pointer', maxWidth: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...srcStyle }}
                          open={openDropdownId?.profileId === p.id && openDropdownId?.field === 'source'}
                          onOpenChange={(v) => { if (v) setOpenDropdownId({ profileId: p.id, field: 'source' }); else setOpenDropdownId(null) }}
                          containerClassName="source-dropdown"
                        />
                      </div>
                    </td>
                    <td style={rowStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, fontSize: 12, fontWeight: 700, ...scoreStyle }}>
                        {p.sc ?? '—'}
                      </span>
                    </td>
                    <td style={rowStyle} onClick={(e) => e.stopPropagation()}>
                      <div className="maturite-dropdown">
                        <InlineDropdown
                          options={MATURITIES}
                          value={p.mat}
                          onChange={(v) => { changeMaturity(p.id, v); setOpenDropdownId(null) }}
                          buttonStyle={(v) => ({ borderRadius: 20, padding: '3px 9px', fontSize: 11, border: 'none', cursor: 'pointer', ...(MATURITY_STYLES[v] || { bg: '#f8fafc', color: '#94a3b8' }) })}
                          buttonClassName=""
                          open={openDropdownId?.profileId === p.id && openDropdownId?.field === 'mat'}
                          onOpenChange={(v) => { if (v) setOpenDropdownId({ profileId: p.id, field: 'mat' }); else setOpenDropdownId(null) }}
                          containerClassName="maturite-dropdown"
                        />
                      </div>
                    </td>
                    <td style={rowStyle} onClick={(e) => e.stopPropagation()}>
                      <div className="stade-dropdown">
                        <InlineDropdown
                          options={STAGES}
                          value={p.stg}
                          onChange={(v) => { changeStage(p.id, v); setOpenDropdownId(null) }}
                          buttonStyle={(v) => ({ borderRadius: 20, padding: '3px 9px', fontSize: 11, border: 'none', cursor: 'pointer', ...(STAGE_STYLES[v] || { backgroundColor: '#f8fafc', color: '#94a3b8' }) })}
                          buttonClassName=""
                          placeholder="—"
                          open={openDropdownId?.profileId === p.id && openDropdownId?.field === 'stade'}
                          onOpenChange={(v) => { if (v) setOpenDropdownId({ profileId: p.id, field: 'stade' }); else setOpenDropdownId(null) }}
                          containerClassName="stade-dropdown"
                        />
                      </div>
                    </td>
                    <td style={{ ...rowStyle, fontSize: 11, fontWeight: 500, color: sessionStr ? ACCENT : '#ddd' }}>
                      {sessionStr || '—'}
                    </td>
                    <td style={{ ...rowStyle, fontSize: 11, color: '#ccc' }}>
                      {formatAddedDate(p)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {deleteModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.4)' }} onClick={() => setDeleteModalOpen(false)}>
          <div style={{ background: '#F5F0E8', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: 400, padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 20 }}>
              <span style={{ marginBottom: 12 }}><IconWarning /></span>
              <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px', color: '#1A1A1A' }}>
                {selectedCount === 1 ? 'Supprimer ce profil ?' : `Supprimer ${selectedCount} profils ?`}
              </p>
              <p style={{ fontSize: 13, color: '#6B6B6B', margin: 0 }}>
                {selectedCount === 1
                  ? 'Cette action est irréversible. Le profil sera définitivement supprimé de la base.'
                  : `Cette action est irréversible. Ces ${selectedCount} profils seront définitivement supprimés de la base.`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setDeleteModalOpen(false)} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${ACCENT}`, background: 'transparent', color: ACCENT, cursor: 'pointer' }}>Annuler</button>
              <button type="button" onClick={confirmDelete} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 8, background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer' }}><IconTrash /> Confirmer la suppression</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
