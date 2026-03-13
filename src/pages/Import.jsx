import { useState } from 'react'
import { useCRM } from '../context/CRMContext'
import { SCORING_RESULTS } from '../lib/data'

const AV = ['avg', 'avb', 'ava', 'avp', 'avr', 'avt']

export default function Import() {
  const { showNotif } = useCRM()
  const [tab, setTab] = useState('iu')
  const [scoringRows, setScoringRows] = useState([])

  const scpill = (s) => s >= 70 ? 'sh' : s >= 45 ? 'sm2' : 'sl'
  const priotag = (p) => {
    if (p === 'Prioritaire') return <span className="pp bg-[var(--rbg)] text-[var(--red)] py-0.5 px-2 rounded-md text-[11.5px] font-medium">🔴 Prioritaire</span>
    if (p === 'À travailler') return <span className="pm bg-[var(--abg)] text-[var(--amber)] py-0.5 px-2 rounded-md text-[11.5px] font-medium">🟡 À travailler</span>
    return <span className="pl bg-[var(--s2)] text-[var(--t2)] py-0.5 px-2 rounded-md text-[11.5px] font-medium">⚪ À écarter</span>
  }

  const doUp = (type) => {
    setTab('im')
    showNotif(type === 'pdf' ? '📑 PDF analysé — 1 profil extrait ✓' : '✓ 24 profils détectés dans le CSV')
  }

  const doSc = () => {
    setTab('is')
    setScoringRows(SCORING_RESULTS)
    showNotif('✦ Scoring IA terminé — 5 prioritaires identifiés')
  }

  const ini = (a, b) => (a?.[0] || '') + (b?.[0] || '')

  return (
    <div className="page h-full overflow-y-auto p-[22px]">
      <div className="font-serif text-[22px] mb-1">Import & Scoring</div>
      <div className="text-[13px] text-[var(--t3)] mb-5">CSV Sales Navigator ou PDF LinkedIn — mappe les colonnes, lance le scoring IA</div>
      <div className="itabs flex border-b border-[var(--border)] mb-5">
        <div className={`itab py-2.5 px-4 text-[13px] font-medium cursor-pointer border-b-2 border-transparent transition-all ${tab === 'iu' ? 'active text-[var(--accent)] border-b-[var(--accent)]' : 'text-[var(--t3)]'}`} onClick={() => setTab('iu')}>① Source</div>
        <div className={`itab py-2.5 px-4 text-[13px] font-medium cursor-pointer border-b-2 border-transparent transition-all ${tab === 'im' ? 'active text-[var(--accent)] border-b-[var(--accent)]' : 'text-[var(--t3)]'}`} onClick={() => setTab('im')}>② Mapping / Extraction</div>
        <div className={`itab py-2.5 px-4 text-[13px] font-medium cursor-pointer border-b-2 border-transparent transition-all ${tab === 'is' ? 'active text-[var(--accent)] border-b-[var(--accent)]' : 'text-[var(--t3)]'}`} onClick={() => setTab('is')}>③ Résultats scoring</div>
      </div>

      {tab === 'iu' && (
        <>
          <div className="grid grid-cols-2 gap-3.5 mb-5">
            <div>
              <div className="font-semibold text-[13.5px] mb-2">📄 Import CSV Sales Navigator</div>
              <div className="dz border-2 border-dashed border-[var(--b2)] rounded-xl py-9 text-center cursor-pointer transition-all hover:border-[var(--accent)] hover:bg-[var(--accent)]/5" onClick={() => doUp('csv')}>
                <div className="text-3xl mb-2">⇪</div>
                <div className="text-sm font-semibold mb-1">Glisser-déposer un .csv</div>
                <div className="text-xs text-[var(--t3)]">Export Sales Navigator ou Waalaxy</div>
              </div>
              <div className="bg-[var(--s2)] rounded-lg py-2.5 px-3.5 text-xs text-[var(--t3)] mt-2">
                Colonnes attendues : <code className="font-mono text-[11.5px] bg-[var(--s2)] py-0.5 px-1.5 rounded">firstName</code> · <code className="font-mono text-[11.5px] bg-[var(--s2)] py-0.5 px-1.5 rounded">lastName</code> · <code className="font-mono text-[11.5px] bg-[var(--s2)] py-0.5 px-1.5 rounded">title</code> · <code className="font-mono text-[11.5px] bg-[var(--s2)] py-0.5 px-1.5 rounded">companyName</code>
              </div>
            </div>
            <div>
              <div className="font-semibold text-[13.5px] mb-2">📑 Import PDF LinkedIn</div>
              <div className="dz border-2 border-dashed border-[#AEC8F0] rounded-xl py-9 text-center cursor-pointer bg-[#F5F9FF] transition-all" onClick={() => doUp('pdf')}>
                <div className="text-3xl mb-2">📑</div>
                <div className="text-sm font-semibold mb-1">Glisser-déposer un .pdf</div>
                <div className="text-xs text-[var(--t3)]">Profil LinkedIn exporté en PDF</div>
              </div>
              <div className="bg-[#EEF4FD] rounded-lg py-2.5 px-3.5 text-xs text-[#4A6FA0] mt-2">
                L'IA extrait automatiquement : nom, employeur actuel, poste, ancienneté, ville — puis score le profil.
              </div>
            </div>
          </div>
          <div className="bg-[var(--lbg)] border border-[#FFD5C0] rounded-[10px] py-3.5 px-4 flex items-center gap-3.5">
            <span className="text-2xl">🔗</span>
            <div>
              <div className="font-semibold text-[13.5px] text-[var(--lemlist)]">Intégration Lemlist détectée</div>
              <div className="text-xs text-[var(--t2)] mt-0.5">Les profils poussés dans une séquence Lemlist apparaîtront automatiquement. Webhook sur <code className="font-mono bg-white/50 py-0.5 px-1 rounded">/api/lemlist-events</code>.</div>
            </div>
            <span className="ml-auto text-[11px] bg-[#FF6B35] text-white py-0.5 px-2 rounded-full font-medium shrink-0">Connecté</span>
          </div>
        </>
      )}

      {tab === 'im' && (
        <>
          <div className="font-semibold text-[13.5px] mb-3">Mapping colonnes CSV <span className="font-normal text-[var(--t3)] text-xs">— 24 profils détectés</span></div>
          <div className="tw bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden mb-3.5">
            <table className="mt w-full border-collapse">
              <thead><tr>
                <th className="text-left py-2 px-3.5 bg-[var(--s2)] text-[11.5px] uppercase tracking-wider text-[var(--t3)] border-b border-[var(--border)]">Colonne CSV</th>
                <th className="text-left py-2 px-3.5 bg-[var(--s2)] text-[11.5px] uppercase tracking-wider text-[var(--t3)] border-b border-[var(--border)]">→ Champ CRM</th>
                <th className="text-left py-2 px-3.5 bg-[var(--s2)] text-[11.5px] uppercase tracking-wider text-[var(--t3)] border-b border-[var(--border)]">Aperçu</th>
              </tr></thead>
              <tbody>
                <tr className="border-b border-[var(--border)]"><td className="py-2 px-3.5"><code className="font-mono text-[11.5px] bg-[var(--s2)] py-0.5 px-1.5 rounded">firstName</code></td><td className="py-2 px-3.5"><select className="font-[inherit] text-[13px] py-1 px-1.5 border border-[var(--b2)] rounded-md bg-[var(--surface)] outline-none"><option>Prénom</option></select></td><td className="py-2 px-3.5 text-[var(--t3)] text-xs">Thomas, Marine…</td></tr>
                <tr className="border-b border-[var(--border)]"><td className="py-2 px-3.5"><code className="font-mono text-[11.5px] bg-[var(--s2)] py-0.5 px-1.5 rounded">lastName</code></td><td className="py-2 px-3.5"><select className="font-[inherit] text-[13px] py-1 px-1.5 border border-[var(--b2)] rounded-md bg-[var(--surface)] outline-none"><option>Nom</option></select></td><td className="py-2 px-3.5 text-[var(--t3)] text-xs">Dupont, Laurent…</td></tr>
              </tbody>
            </table>
          </div>
          <button type="button" className="btn bp py-2 px-4 rounded-lg bg-[var(--accent)] text-white font-medium cursor-pointer" onClick={doSc}>✦ Lancer le scoring IA →</button>
        </>
      )}

      {tab === 'is' && (
        <>
          <div className="stats-row grid grid-cols-4 gap-3 mb-3.5">
            <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Analysés</div><div className="sval text-[26px] font-semibold">24</div></div>
            <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">🔴 Prioritaires ≥70</div><div className="sval text-[26px] font-semibold">5</div></div>
            <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">🟡 À travailler</div><div className="sval text-[26px] font-semibold">3</div></div>
            <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Score moyen</div><div className="sval text-[26px] font-semibold">61</div></div>
          </div>
          <div className="bg-[var(--lbg)] border border-[#FFD5C0] rounded-lg py-2.5 px-4 mb-3.5 text-[12.5px] text-[var(--t2)] flex items-center gap-2.5">
            <span className="text-[var(--lemlist)] text-base">🔗</span>
            Chaque profil exporté vers Lemlist apparaîtra dans son historique — synchronisés via webhook.
          </div>
          <div className="tw bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
            <div className="thd py-3 px-4 border-b border-[var(--border)] flex items-center gap-2">
              <div className="ttl font-semibold text-sm">Résultats scoring IA</div>
              <button type="button" className="btn bo bsm py-1.5 px-2.5 text-xs" onClick={() => showNotif('⬇ Export CSV Lemlist prêt — 24 lignes')}>⬇ Export Lemlist CSV</button>
              <button type="button" className="btn bp bsm py-1.5 px-2.5 text-xs" onClick={() => showNotif('✓ 5 profils prioritaires ajoutés au CRM')}>+ Pousser dans CRM</button>
            </div>
            <table className="w-full border-collapse">
              <thead><tr>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Profil</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Employeur</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Intitulé</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Ancienneté</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Score</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Priorité</th>
              </tr></thead>
              <tbody>
                {scoringRows.map((p, i) => (
                  <tr key={i} className="border-b border-[var(--border)]">
                    <td className="py-2.5 px-4"><div className="pc flex items-center gap-2.5"><div className="av w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: ['#D4EDE1', '#D3E4F8', '#FDEBC8'][i % 3], color: ['#1A7A4A', '#1E5FA0', '#B86B0F'][i % 3] }}>{ini(p.fn, p.ln)}</div><div className="pn font-medium">{p.fn} {p.ln}</div></div></td>
                    <td className="py-2.5 px-4 text-[12.5px]">{p.co}</td>
                    <td className="py-2.5 px-4 text-[12.5px] text-[var(--t2)]">{p.ti}</td>
                    <td className="py-2.5 px-4 text-[12.5px] text-[var(--t3)]">{p.dur}</td>
                    <td className="py-2.5 px-4"><span className={`sc inline-flex items-center justify-center w-9 h-6 rounded-md ${scpill(p.sc)}`}>{p.sc}</span></td>
                    <td className="py-2.5 px-4">{priotag(p.pr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
