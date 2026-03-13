import { useState, useMemo } from 'react'
import { useCRM } from '../context/CRMContext'
import { STAGES, STAGE_COLORS } from '../lib/data'

const SOURCE_LABELS = {
  'Chasse LinkedIn': { l: 'Chasse LinkedIn', c: '#1E5FA0' },
  'Chasse Mail': { l: 'Chasse Mail', c: '#0E7490' },
  'Recommandation': { l: 'Recommandation', c: '#7B3FC4' },
  'Inbound': { l: 'Inbound', c: '#1A7A4A' },
  'Ads': { l: 'Ads', c: '#B86B0F' },
  'Direct contact': { l: 'Direct contact', c: '#6B6158' },
}

export default function Analytics() {
  const { filteredProfiles } = useCRM()
  const [period, setPeriod] = useState('all')

  const stats = useMemo(() => {
    const all = filteredProfiles
    const total = all.length
    const r0 = all.filter((p) => p.stg === 'R0').length
    const r1 = all.filter((p) => p.stg === 'R1').length
    const ptEtape = all.filter((p) => p.stg === "Point d'étape").length
    const r2 = all.filter((p) => p.stg === 'R2 Amaury').length
    const demission = all.filter((p) => p.stg === 'Démission').length
    const ptJuridique = all.filter((p) => p.stg === 'Point juridique').length
    const recrutes = all.filter((p) => p.stg === 'Recruté').length

    const contactes = total
    const tauxRep = contactes > 0 ? Math.round(((contactes - r0) / contactes) * 100) : 0
    const tauxR0R1 = r0 > 0 ? Math.round((r1 / (r0 + r1 || 1)) * 100) : 0

    const bySource = {}
    all.forEach((p) => {
      const s = p.src || 'Chasse LinkedIn'
      bySource[s] = (bySource[s] || 0) + 1
    })
    const srcData = Object.entries(bySource).map(([k, v]) => ({
      l: SOURCE_LABELS[k]?.l || k,
      v,
      m: total || 1,
      c: SOURCE_LABELS[k]?.c || '#888',
    })).sort((a, b) => b.v - a.v)

    const fn = [
      { l: 'R0 contactés', n: r0 },
      { l: 'R1 — 1er RDV', n: r1 },
      { l: "Point d'étape", n: ptEtape },
      { l: 'R2 Amaury', n: r2 },
      { l: 'Démission', n: demission },
      { l: 'Point juridique', n: ptJuridique },
      { l: 'Recruté', n: recrutes },
    ]
    const fc = ['#6B6158', '#1E5FA0', '#0E7490', '#7B3FC4', '#B86B0F', '#C0392B', '#1A7A4A']

    return {
      contactes,
      tauxRep: `${tauxRep}%`,
      tauxR0R1: `${tauxR0R1}%`,
      recrutes,
      src: srcData,
      fn,
      fc,
      total,
    }
  }, [filteredProfiles])

  const integs = filteredProfiles.filter((x) => x.integ && x.integ !== '—' && x.integ !== 'Intégré')

  return (
    <div className="page h-full overflow-y-auto p-[22px]">
      <div className="flex items-start justify-between mb-5">
        <div><div className="font-serif text-[22px]">Analytics</div><div className="text-[13px] text-[var(--t3)]">Performance recrutement Evolve — données Supabase</div></div>
        <div className="pbtns flex gap-1">
          <button type="button" className={`pb py-1 px-2.5 rounded-md text-xs font-medium border border-[var(--b2)] bg-[var(--surface)] cursor-pointer text-[var(--t2)] transition-all ${period === 'all' ? 'active bg-[var(--accent)] text-white border-[var(--accent)]' : ''}`} onClick={() => setPeriod('all')}>Tous</button>
        </div>
      </div>
      <div className="stats-row grid grid-cols-5 gap-3 mb-5">
        <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Profils totaux</div><div className="sval text-[26px] font-semibold leading-none">{stats.contactes}</div><div className="ssub text-xs text-[var(--t3)] mt-1">Pipeline actif</div></div>
        <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Taux réponse</div><div className="sval text-[26px] font-semibold leading-none">{stats.tauxRep}</div><div className="ssub text-xs text-[var(--t3)] mt-1">R0 → R1</div></div>
        <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">R0 → R1</div><div className="sval text-[26px] font-semibold leading-none">{stats.tauxR0R1}</div><div className="ssub text-xs text-[var(--t3)] mt-1">Taux passage</div></div>
        <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">En R1+</div><div className="sval text-[26px] font-semibold leading-none">{stats.fn[1].n + stats.fn[2].n + stats.fn[3].n + stats.fn[4].n + stats.fn[5].n + stats.fn[6].n}</div><div className="ssub text-xs text-[var(--t3)] mt-1">Progression</div></div>
        <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Recrutés</div><div className="sval text-[26px] font-semibold leading-none">{stats.recrutes}</div><div className="ssub text-xs mt-1" style={{ color: 'var(--green)' }}>Pipeline</div></div>
      </div>
      {stats.src.length > 0 && (
        <>
          <div className="ag grid grid-cols-2 gap-3.5 mb-5">
            <div className="ac bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
              <div className="act text-[13px] font-semibold mb-3 flex items-center justify-between">Sources d'acquisition <span className="act-sub text-[11px] text-[var(--t3)] font-normal">profils</span></div>
              <div>{stats.src.map((x) => <div key={x.l} className="br flex items-center gap-2.5 mb-2"><span className="bl text-xs text-[var(--t2)] w-[130px] shrink-0 truncate">{x.l}</span><div className="bt flex-1 h-2 bg-[var(--s2)] rounded overflow-hidden"><div className="bf h-full rounded" style={{ width: `${Math.round((x.v / x.m) * 100)}%`, background: x.c }} /></div><span className="bv text-xs text-[var(--t3)] w-[22px] text-right font-mono shrink-0">{x.v}</span></div>)}</div>
            </div>
            <div className="ac bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
              <div className="act text-[13px] font-semibold mb-3">Profils par stade</div>
              <div>{stats.fn.filter((f) => f.n > 0).map((f, i) => <div key={f.l} className="br flex items-center gap-2.5 mb-2"><span className="bl text-xs text-[var(--t2)] w-[130px] shrink-0 truncate">{f.l}</span><div className="bt flex-1 h-2 bg-[var(--s2)] rounded overflow-hidden"><div className="bf h-full rounded" style={{ width: `${stats.contactes > 0 ? Math.round((f.n / stats.contactes) * 100) : 0}%`, background: stats.fc[i] }} /></div><span className="bv text-xs text-[var(--t3)] w-[22px] text-right font-mono shrink-0">{f.n}</span></div>)}</div>
            </div>
          </div>
          <div className="ac bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 mb-5">
            <div className="act text-[13px] font-semibold mb-3">Entonnoir pipeline — répartition par étape</div>
            <div>{stats.fn.map((f, i) => <div key={f.l} className="fr flex items-center gap-2.5 mb-1"><span className="fl text-xs text-[var(--t2)] w-[125px] shrink-0 truncate">{f.l}</span><div className="flex-1"><div className="fb h-[26px] rounded flex items-center px-2.5 text-xs font-medium text-white min-w-[38px]" style={{ width: `${stats.contactes > 0 ? Math.max(6, Math.round((f.n / stats.contactes) * 100)) : 6}%`, background: stats.fc[i] || '#888' }}>{f.n}</div></div><span className="fls text-[11px] text-[var(--red)] w-8 text-right font-mono shrink-0">{i > 0 && stats.fn[i - 1].n > 0 ? `-${Math.round((1 - f.n / stats.fn[i - 1].n) * 100)}%` : ''}</span></div>)}</div>
          </div>
        </>
      )}
      <div className="ag3 grid grid-cols-3 gap-3.5">
        <div className="ac bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
          <div className="act text-[13px] font-semibold mb-3">Profils par zone</div>
          <div className="text-xs text-[var(--t3)] mb-2">Données ville — filtrage à venir</div>
        </div>
        <div className="ac bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
          <div className="act text-[13px] font-semibold mb-3">Séquences Lemlist</div>
          <div className="text-xs text-[var(--t3)]">Synchronisation via webhook — à configurer</div>
        </div>
        <div className="ac bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
          <div className="act text-[13px] font-semibold mb-3">Intégrations à venir</div>
          {integs.slice(0, 5).map((p, i) => (
            <div key={p.id} className="flex items-center gap-2.5 mb-2">
              <div className="av w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px] font-semibold" style={{ backgroundColor: STAGE_COLORS[p.stg]?.bg || '#eee', color: STAGE_COLORS[p.stg]?.text || '#666' }}>{p.fn?.[0]}{p.ln?.[0]}</div>
              <div className="flex-1"><div className="text-[12.5px] font-medium">{p.fn} {p.ln}</div><div className="text-[11px] text-[var(--t3)]"><span className="tag px-1 py-0.5 rounded text-[10px]" style={{ background: STAGE_COLORS[p.stg]?.bg, color: STAGE_COLORS[p.stg]?.text }}>{p.stg}</span></div></div>
              <span className="text-xs font-semibold text-[var(--accent)]">{p.integ}</span>
            </div>
          ))}
          {integs.length === 0 && <div className="text-xs text-[var(--t3)]">Aucune intégration prévue</div>}
        </div>
      </div>
    </div>
  )
}
