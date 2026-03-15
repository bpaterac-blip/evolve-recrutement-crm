import { useState, useRef } from 'react'
import { useCRM } from '../context/CRMContext'
import { parseCSV } from '../lib/csvParser'
import { extractTextFromPDF, parseLinkedInPDFText } from '../lib/pdfExtractor'
import { calculateScore } from '../lib/scoring'
import { IconLink, IconDot, IconUpload } from '../components/Icons'

const AV = ['avg', 'avb', 'ava', 'avp', 'avr', 'avt']
const priotag = (sc) => {
  if (sc >= 70) return <span className="pp bg-[var(--rbg)] text-[var(--red)] py-0.5 px-2 rounded-md text-[11.5px] font-medium inline-flex items-center gap-1"><span className="inline-flex"><IconDot /></span>Prioritaire</span>
  if (sc >= 50) return <span className="pm bg-[var(--abg)] text-[var(--amber)] py-0.5 px-2 rounded-md text-[11.5px] font-medium inline-flex items-center gap-1"><span className="inline-flex"><IconDot /></span>À travailler</span>
  return <span className="pl bg-[var(--s2)] text-[var(--t3)] py-0.5 px-2 rounded-md text-[11.5px] font-medium inline-flex items-center gap-1"><span className="inline-flex"><IconDot /></span>À écarter</span>
}

export default function Import() {
  const { showNotif, addProfile, addProfilesBatch, useSupabase } = useCRM()
  const [tab, setTab] = useState('iu')
  const [parsedRows, setParsedRows] = useState([])
  const [importSource, setImportSource] = useState(null) // 'csv' | 'pdf'
  const [loading, setLoading] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [includeATravailler, setIncludeATravailler] = useState(false)
  const [ecarteExpanded, setEcarteExpanded] = useState(false)
  const csvInputRef = useRef(null)
  const pdfInputRef = useRef(null)

  const scpill = (s) => s >= 70 ? 'sh' : s >= 50 ? 'sm2' : 'sl'
  const ini = (a, b) => (a?.[0] || '') + (b?.[0] || '')

  const handleCSVFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const rows = await parseCSV(file)
      const withScores = rows.map((r) => {
        const sc = calculateScore(r)
        return { ...r, sc }
      })
      setParsedRows(withScores)
      setImportSource('csv')
      setTab('im')
      showNotif(`✓ ${withScores.length} profils détectés dans le CSV`)
    } catch (err) {
      showNotif(`Erreur CSV : ${err?.message}`)
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const handlePDFFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const text = await extractTextFromPDF(file)
      const parsed = parseLinkedInPDFText(text)
      const sc = calculateScore(parsed)
      setParsedRows([{ ...parsed, sc }])
      setImportSource('pdf')
      setTab('im')
      showNotif('📑 PDF analysé — 1 profil extrait ✓')
    } catch (err) {
      showNotif(`Erreur PDF : ${err?.message}`)
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const priorRows = parsedRows.filter((r) => (r.sc || 0) >= 70)
  const workRows = parsedRows.filter((r) => (r.sc || 0) >= 50 && (r.sc || 0) < 70)
  const ecarteRows = parsedRows.filter((r) => (r.sc || 0) < 50)
  const rowsToPush = includeATravailler ? [...priorRows, ...workRows] : priorRows

  const pushToCRM = async () => {
    if (!rowsToPush.length) return
    setPushing(true)
    try {
      if (useSupabase) {
        const n = await addProfilesBatch(rowsToPush)
        showNotif(`✓ ${n} profils ajoutés au CRM`)
      } else {
        for (const p of rowsToPush) {
          await addProfile(p)
        }
        showNotif(`✓ ${rowsToPush.length} profils ajoutés au CRM`)
      }
      setTab('is')
    } catch (err) {
      showNotif(`Erreur : ${err?.message}`)
    } finally {
      setPushing(false)
    }
  }

  const priorCount = priorRows.length
  const workCount = workRows.length
  const avgScore = parsedRows.length ? Math.round(parsedRows.reduce((a, r) => a + (r.sc || 0), 0) / parsedRows.length) : 0

  return (
    <div className="page h-full overflow-y-auto p-[22px]">
      <div className="font-serif text-[22px] mb-1">Import & Scoring</div>
      <div className="text-[13px] text-[var(--t3)] mb-5">CSV Sales Navigator ou PDF LinkedIn — mappe les colonnes, lance le scoring automatique</div>
      <div className="itabs flex border-b border-[var(--border)] mb-5">
        <div className={`itab py-2.5 px-4 text-[13px] font-medium cursor-pointer border-b-2 border-transparent transition-all ${tab === 'iu' ? 'active text-[var(--accent)] border-b-[var(--accent)]' : 'text-[var(--t3)]'}`} onClick={() => setTab('iu')}>① Source</div>
        <div className={`itab py-2.5 px-4 text-[13px] font-medium cursor-pointer border-b-2 border-transparent transition-all ${tab === 'im' ? 'active text-[var(--accent)] border-b-[var(--accent)]' : 'text-[var(--t3)]'}`} onClick={() => setTab('im')}>② Mapping / Extraction</div>
        <div className={`itab py-2.5 px-4 text-[13px] font-medium cursor-pointer border-b-2 border-transparent transition-all ${tab === 'is' ? 'active text-[var(--accent)] border-b-[var(--accent)]' : 'text-[var(--t3)]'}`} onClick={() => setTab('is')}>③ Résultats scoring</div>
      </div>

      {tab === 'iu' && (
        <>
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVFile} />
          <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePDFFile} />
          <div className="grid grid-cols-2 gap-3.5 mb-5">
            <div>
              <div className="font-semibold text-[13.5px] mb-2">📄 Import CSV Sales Navigator</div>
              <div
                className="dz border-2 border-dashed border-[var(--b2)] rounded-xl py-9 text-center cursor-pointer transition-all hover:border-[var(--accent)] hover:bg-[var(--accent)]/5"
                onClick={() => csvInputRef.current?.click()}
              >
                {loading ? <div className="text-3xl mb-2">…</div> : <div className="text-3xl mb-2">⇪</div>}
                <div className="text-sm font-semibold mb-1">Cliquer ou glisser-déposer un .csv</div>
                <div className="text-xs text-[var(--t3)]">Export Sales Navigator ou Waalaxy</div>
              </div>
              <div className="bg-[var(--s2)] rounded-lg py-2.5 px-3.5 text-xs text-[var(--t3)] mt-2">
                Formats supportés : <strong>Lemlist</strong> (firstName, lastName, email, linkedinUrl, companyName, jobTitle, location, campaigns, leadStatus, lastContactedDate) · <strong>Waalaxy</strong> (firstName, lastName, occupation, job_title, location, company_name, linkedinUrl) · <strong>Sales Navigator</strong> (First Name, Last Name, Job Title, Company Name)
              </div>
            </div>
            <div>
              <div className="font-semibold text-[13.5px] mb-2">📑 Import PDF LinkedIn</div>
              <div
                className="dz border-2 border-dashed border-[#AEC8F0] rounded-xl py-9 text-center cursor-pointer bg-[#F5F9FF] transition-all hover:border-[var(--accent)]"
                onClick={() => pdfInputRef.current?.click()}
              >
                {loading ? <div className="text-3xl mb-2">…</div> : <div className="text-3xl mb-2">📑</div>}
                <div className="text-sm font-semibold mb-1">Cliquer ou glisser-déposer un .pdf</div>
                <div className="text-xs text-[var(--t3)]">Profil LinkedIn exporté en PDF</div>
              </div>
              <div className="bg-[#EEF4FD] rounded-lg py-2.5 px-3.5 text-xs text-[#4A6FA0] mt-2">
                Extraction automatique : nom, employeur, poste, ville — puis scoring du profil.
              </div>
            </div>
          </div>
          <div className="bg-[var(--lbg)] border border-[#FFD5C0] rounded-[10px] py-3.5 px-4 flex items-center gap-3.5">
            <span className="inline-flex items-center justify-center text-[var(--lemlist)]"><IconLink /></span>
            <div>
              <div className="font-semibold text-[13.5px] text-[var(--lemlist)]">Intégration Lemlist</div>
              <div className="text-xs text-[var(--t2)] mt-0.5">Les profils poussés dans une séquence Lemlist apparaîtront automatiquement via webhook.</div>
            </div>
          </div>
        </>
      )}

      {tab === 'im' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div className="font-semibold text-[13.5px]">Résultats {importSource === 'pdf' ? 'PDF' : 'CSV'} — {parsedRows.length} profil(s) détecté(s)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={includeATravailler} onChange={(e) => setIncludeATravailler(e.target.checked)} />
                Inclure les À travailler (50-69 pts)
              </label>
              <button
                type="button"
                onClick={pushToCRM}
                disabled={pushing || rowsToPush.length === 0}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#173731', color: 'white', fontWeight: 500, fontSize: 13, cursor: pushing || rowsToPush.length === 0 ? 'not-allowed' : 'pointer', opacity: pushing || rowsToPush.length === 0 ? 0.6 : 1 }}
              >
                {pushing ? 'En cours…' : `+ Pousser ${rowsToPush.length} profil(s) dans le CRM`}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 16, background: '#D4EDE1', border: '1px solid #A8D5BA', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: '#1A7A4A' }}>Prioritaires ≥70 pts ({priorCount})</div>
            <table className="mt w-full border-collapse">
              <thead><tr>
                <th className="text-left py-2 px-3.5 bg-[#C5E6D0] text-[11.5px] uppercase tracking-wider text-[#1A7A4A] border-b border-[#A8D5BA]">Profil</th>
                <th className="text-left py-2 px-3.5 bg-[#C5E6D0] text-[11.5px] uppercase tracking-wider text-[#1A7A4A] border-b border-[#A8D5BA]">Employeur</th>
                <th className="text-left py-2 px-3.5 bg-[#C5E6D0] text-[11.5px] uppercase tracking-wider text-[#1A7A4A] border-b border-[#A8D5BA]">Intitulé</th>
                {importSource === 'pdf' && <th className="text-left py-2 px-3.5 bg-[#C5E6D0] text-[11.5px] uppercase tracking-wider text-[#1A7A4A] border-b border-[#A8D5BA]">Ancienneté</th>}
                <th className="text-left py-2 px-3.5 bg-[#C5E6D0] text-[11.5px] uppercase tracking-wider text-[#1A7A4A] border-b border-[#A8D5BA]">Score</th>
                <th className="text-left py-2 px-3.5 bg-[#C5E6D0] text-[11.5px] uppercase tracking-wider text-[#1A7A4A] border-b border-[#A8D5BA]">Priorité</th>
              </tr></thead>
              <tbody>
                {priorRows.map((p, i) => (
                  <tr key={`prior-${i}`} className="border-b border-[#A8D5BA]">
                    <td className="py-2 px-3.5"><div className="pc flex items-center gap-2.5"><div className="av w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: '#D4EDE1', color: '#1A7A4A' }}>{ini(p.fn, p.ln)}</div><div className="pn font-medium">{p.fn} {p.ln}</div></div></td>
                    <td className="py-2 px-3.5 text-[12.5px]">{p.co || '—'}</td>
                    <td className="py-2 px-3.5 text-[12.5px] text-[var(--t2)]">{p.ti || '—'}</td>
                    {importSource === 'pdf' && <td className="py-2 px-3.5 text-[12.5px] text-[var(--t3)]">{p.dur || '—'}</td>}
                    <td className="py-2 px-3.5"><span className={`sc inline-flex items-center justify-center w-9 h-6 rounded-md ${scpill(p.sc)}`}>{p.sc}</span></td>
                    <td className="py-2 px-3.5">{priotag(p.sc)}</td>
                  </tr>
                ))}
                {priorRows.length === 0 && <tr><td colSpan={importSource === 'pdf' ? 6 : 5} className="py-4 px-3.5 text-center text-[var(--t3)] text-[13px]">Aucun profil prioritaire</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: 16, background: '#FFF3E0', border: '1px solid #FFE0B2', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: '#E65100' }}>À travailler 50-69 pts ({workCount})</div>
            <table className="mt w-full border-collapse">
              <thead><tr>
                <th className="text-left py-2 px-3.5 bg-[#FFECB3] text-[11.5px] uppercase tracking-wider text-[#E65100] border-b border-[#FFE0B2]">Profil</th>
                <th className="text-left py-2 px-3.5 bg-[#FFECB3] text-[11.5px] uppercase tracking-wider text-[#E65100] border-b border-[#FFE0B2]">Employeur</th>
                <th className="text-left py-2 px-3.5 bg-[#FFECB3] text-[11.5px] uppercase tracking-wider text-[#E65100] border-b border-[#FFE0B2]">Intitulé</th>
                {importSource === 'pdf' && <th className="text-left py-2 px-3.5 bg-[#FFECB3] text-[11.5px] uppercase tracking-wider text-[#E65100] border-b border-[#FFE0B2]">Ancienneté</th>}
                <th className="text-left py-2 px-3.5 bg-[#FFECB3] text-[11.5px] uppercase tracking-wider text-[#E65100] border-b border-[#FFE0B2]">Score</th>
                <th className="text-left py-2 px-3.5 bg-[#FFECB3] text-[11.5px] uppercase tracking-wider text-[#E65100] border-b border-[#FFE0B2]">Priorité</th>
              </tr></thead>
              <tbody>
                {workRows.map((p, i) => (
                  <tr key={`work-${i}`} className="border-b border-[#FFE0B2]">
                    <td className="py-2 px-3.5"><div className="pc flex items-center gap-2.5"><div className="av w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: '#FDEBC8', color: '#B86B0F' }}>{ini(p.fn, p.ln)}</div><div className="pn font-medium">{p.fn} {p.ln}</div></div></td>
                    <td className="py-2 px-3.5 text-[12.5px]">{p.co || '—'}</td>
                    <td className="py-2 px-3.5 text-[12.5px] text-[var(--t2)]">{p.ti || '—'}</td>
                    {importSource === 'pdf' && <td className="py-2 px-3.5 text-[12.5px] text-[var(--t3)]">{p.dur || '—'}</td>}
                    <td className="py-2 px-3.5"><span className={`sc inline-flex items-center justify-center w-9 h-6 rounded-md ${scpill(p.sc)}`}>{p.sc}</span></td>
                    <td className="py-2 px-3.5">{priotag(p.sc)}</td>
                  </tr>
                ))}
                {workRows.length === 0 && <tr><td colSpan={importSource === 'pdf' ? 6 : 5} className="py-4 px-3.5 text-center text-[var(--t3)] text-[13px]">Aucun profil à travailler</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: 16, background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: 10, overflow: 'hidden' }}>
            <button type="button" onClick={() => setEcarteExpanded(!ecarteExpanded)} style={{ width: '100%', padding: '10px 14px', fontWeight: 600, fontSize: 13, color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>À écarter &lt;50 pts ({ecarteRows.length})</span>
              <span style={{ transition: 'transform 0.2s', transform: ecarteExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
            {ecarteExpanded && (
              <table className="mt w-full border-collapse">
                <thead><tr>
                  <th className="text-left py-2 px-3.5 bg-[#FFCDD2] text-[11.5px] uppercase tracking-wider text-[#c0392b] border-b border-[#FFCDD2]">Profil</th>
                  <th className="text-left py-2 px-3.5 bg-[#FFCDD2] text-[11.5px] uppercase tracking-wider text-[#c0392b] border-b border-[#FFCDD2]">Employeur</th>
                  <th className="text-left py-2 px-3.5 bg-[#FFCDD2] text-[11.5px] uppercase tracking-wider text-[#c0392b] border-b border-[#FFCDD2]">Intitulé</th>
                  {importSource === 'pdf' && <th className="text-left py-2 px-3.5 bg-[#FFCDD2] text-[11.5px] uppercase tracking-wider text-[#c0392b] border-b border-[#FFCDD2]">Ancienneté</th>}
                  <th className="text-left py-2 px-3.5 bg-[#FFCDD2] text-[11.5px] uppercase tracking-wider text-[#c0392b] border-b border-[#FFCDD2]">Score</th>
                  <th className="text-left py-2 px-3.5 bg-[#FFCDD2] text-[11.5px] uppercase tracking-wider text-[#c0392b] border-b border-[#FFCDD2]">Priorité</th>
                </tr></thead>
                <tbody>
                  {ecarteRows.map((p, i) => (
                    <tr key={`ecarte-${i}`} className="border-b border-[#FFCDD2]">
                      <td className="py-2 px-3.5"><div className="pc flex items-center gap-2.5"><div className="av w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: '#FDE8E8', color: '#c0392b' }}>{ini(p.fn, p.ln)}</div><div className="pn font-medium">{p.fn} {p.ln}</div></div></td>
                      <td className="py-2 px-3.5 text-[12.5px]">{p.co || '—'}</td>
                      <td className="py-2 px-3.5 text-[12.5px] text-[var(--t2)]">{p.ti || '—'}</td>
                      {importSource === 'pdf' && <td className="py-2 px-3.5 text-[12.5px] text-[var(--t3)]">{p.dur || '—'}</td>}
                      <td className="py-2 px-3.5"><span className={`sc inline-flex items-center justify-center w-9 h-6 rounded-md ${scpill(p.sc)}`}>{p.sc}</span></td>
                      <td className="py-2 px-3.5">{priotag(p.sc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'is' && parsedRows.length > 0 && (
        <>
          <div className="stats-row grid grid-cols-4 gap-3 mb-3.5">
            <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Analysés</div><div className="sval text-[26px] font-semibold">{parsedRows.length}</div></div>
            <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Prioritaires ≥70</div><div className="sval text-[26px] font-semibold">{priorCount}</div></div>
            <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">À travailler</div><div className="sval text-[26px] font-semibold">{workCount}</div></div>
            <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Score moyen</div><div className="sval text-[26px] font-semibold">{avgScore}</div></div>
          </div>
          <div className="bg-[var(--lbg)] border border-[#FFD5C0] rounded-lg py-2.5 px-4 mb-3.5 text-[12.5px] text-[var(--t2)] flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center text-[var(--lemlist)]"><IconLink /></span>
            Les profils ont été ajoutés au CRM. Chaque profil exporté vers Lemlist apparaîtra dans son historique.
          </div>
          <div className="tw bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
            <div className="thd py-3 px-4 border-b border-[var(--border)] flex items-center gap-2">
              <div className="ttl font-semibold text-sm">Résultats scoring</div>
              <button type="button" className="btn bo bsm py-1.5 px-2.5 text-xs inline-flex items-center gap-1" onClick={() => showNotif('Export CSV Lemlist — fonctionnalité à venir')}><IconUpload /> Export Lemlist CSV</button>
            </div>
            <table className="w-full border-collapse">
              <thead><tr>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Profil</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Employeur</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Intitulé</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Score</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Priorité</th>
              </tr></thead>
              <tbody>
                {parsedRows.map((p, i) => (
                  <tr key={i} className="border-b border-[var(--border)]">
                    <td className="py-2.5 px-4"><div className="pc flex items-center gap-2.5"><div className="av w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: ['#D4EDE1', '#D3E4F8', '#FDEBC8'][i % 3], color: ['#1A7A4A', '#1E5FA0', '#B86B0F'][i % 3] }}>{ini(p.fn, p.ln)}</div><div className="pn font-medium">{p.fn} {p.ln}</div></div></td>
                    <td className="py-2.5 px-4 text-[12.5px]">{p.co || '—'}</td>
                    <td className="py-2.5 px-4 text-[12.5px] text-[var(--t2)]">{p.ti || '—'}</td>
                    <td className="py-2.5 px-4"><span className={`sc inline-flex items-center justify-center w-9 h-6 rounded-md ${scpill(p.sc)}`}>{p.sc}</span></td>
                    <td className="py-2.5 px-4">{priotag(p.sc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'is' && parsedRows.length === 0 && (
        <div className="text-[var(--t3)] py-8 text-center">Importez d'abord des profils depuis l'onglet Source.</div>
      )}
    </div>
  )
}
