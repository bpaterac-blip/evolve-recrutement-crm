import { useState } from 'react'
import { useCRM } from '../context/CRMContext'
import { STAGE_COLORS } from '../lib/data'

const periods = ['Jan', 'Fév', 'Mars', '2026']
const D = {
  Mars: { c: 34, rep: '41%', r01: '53%', del: '9j', rec: 3, src: [{ l: 'Chasse LinkedIn', v: 18, m: 34, c: '#1E5FA0' }, { l: 'Recommandation', v: 5, m: 34, c: '#7B3FC4' }, { l: 'Chasse Mail', v: 8, m: 34, c: '#0E7490' }, { l: 'Inbound', v: 3, m: 34, c: '#1A7A4A' }], conv: [{ l: 'Recommandation', v: 80, c: '#7B3FC4' }, { l: 'Inbound', v: 67, c: '#1A7A4A' }, { l: 'Chasse LinkedIn', v: 47, c: '#1E5FA0' }, { l: 'Chasse Mail', v: 38, c: '#0E7490' }], canal: [{ l: 'LinkedIn', v: 18, m: 34, c: '#1E5FA0' }, { l: 'Email', v: 10, m: 34, c: '#0E7490' }, { l: 'Téléphone', v: 4, m: 34, c: '#7B3FC4' }, { l: 'Présentiel', v: 2, m: 34, c: '#1A7A4A' }], delay: [{ l: 'R0 → R1', v: 9, m: 20, c: '#1E5FA0' }, { l: 'R1 → Pt étape', v: 12, m: 20, c: '#0E7490' }, { l: 'Pt étape → R2', v: 7, m: 20, c: '#7B3FC4' }, { l: 'R2 → Démission', v: 14, m: 20, c: '#B86B0F' }, { l: 'Démission → Recruté', v: 21, m: 30, c: '#1A7A4A' }] },
  '2026': { c: 90, rep: '38%', r01: '51%', del: '11j', rec: 3 },
  Jan: { c: 22, rep: '34%', r01: '48%', del: '13j', rec: 1 },
  Fév: { c: 28, rep: '39%', r01: '50%', del: '10j', rec: 1 },
}

export default function Analytics() {
  const { filteredProfiles } = useCRM()
  const [period, setPeriod] = useState('Mars')
  const d = D[period] || D.Mars
  const integs = filteredProfiles.filter((x) => x.integ && x.integ !== '—' && x.integ !== 'Intégré')
  const fn = [{ l: 'R0 contactés', n: d.c }, { l: 'R1 — 1er RDV', n: Math.round(d.c * 0.53) }, { l: "Point d'étape", n: Math.round(d.c * 0.32) }, { l: 'R2 Amaury', n: Math.round(d.c * 0.21) }, { l: 'Démission', n: Math.round(d.c * 0.12) }, { l: 'Point juridique', n: Math.round(d.c * 0.09) }, { l: 'Recruté', n: d.rec }]
  const fc = ['#6B6158', '#1E5FA0', '#0E7490', '#7B3FC4', '#B86B0F', '#C0392B', '#1A7A4A']

  return (
    <div className="page h-full overflow-y-auto p-[22px]">
      <div className="flex items-start justify-between mb-5">
        <div><div className="font-serif text-[22px]">Analytics</div><div className="text-[13px] text-[var(--t3)]">Performance recrutement Evolve</div></div>
        <div className="pbtns flex gap-1">
          {periods.map((p) => <button key={p} type="button" className={`pb py-1 px-2.5 rounded-md text-xs font-medium border border-[var(--b2)] bg-[var(--surface)] cursor-pointer text-[var(--t2)] transition-all ${period === p ? 'active bg-[var(--accent)] text-white border-[var(--accent)]' : ''}`} onClick={() => setPeriod(p)}>{p}</button>)}
        </div>
      </div>
      <div className="stats-row grid grid-cols-5 gap-3 mb-5">
        <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Contactés</div><div className="sval text-[26px] font-semibold leading-none">{d.c}</div><div className="ssub text-xs text-[var(--t3)] mt-1">Mars 2026</div></div>
        <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Taux réponse</div><div className="sval text-[26px] font-semibold leading-none">{d.rep}</div><div className="ssub text-xs text-[var(--t3)] mt-1">LinkedIn + Mail</div></div>
        <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">R0 → R1</div><div className="sval text-[26px] font-semibold leading-none">{d.r01}</div><div className="ssub text-xs text-[var(--t3)] mt-1">Taux passage</div></div>
        <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Délai moy. R0→R1</div><div className="sval text-[26px] font-semibold leading-none">{d.del}</div><div className="ssub text-xs text-[var(--t3)] mt-1">Temps de chauffe</div></div>
        <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Recrutés</div><div className="sval text-[26px] font-semibold leading-none">{d.rec}</div><div className="ssub text-xs mt-1" style={{ color: 'var(--green)' }}>Délai moy. 8 sem.</div></div>
      </div>
      {d.src && (
        <>
          <div className="ag grid grid-cols-2 gap-3.5 mb-5">
            <div className="ac bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
              <div className="act text-[13px] font-semibold mb-3 flex items-center justify-between">Sources d'acquisition <span className="act-sub text-[11px] text-[var(--t3)] font-normal">profils entrés</span></div>
              <div>{d.src.map((x) => <div key={x.l} className="br flex items-center gap-2.5 mb-2"><span className="bl text-xs text-[var(--t2)] w-[130px] shrink-0 truncate">{x.l}</span><div className="bt flex-1 h-2 bg-[var(--s2)] rounded overflow-hidden"><div className="bf h-full rounded" style={{ width: `${Math.round((x.v / x.m) * 100)}%`, background: x.c }} /></div><span className="bv text-xs text-[var(--t3)] w-[22px] text-right font-mono shrink-0">{x.v}</span></div>)}</div>
            </div>
            <div className="ac bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
              <div className="act text-[13px] font-semibold mb-3">Taux de conversion par source <span className="act-sub text-[11px] text-[var(--t3)] font-normal">% R0→R1</span></div>
              <div>{d.conv.map((x) => <div key={x.l} className="br flex items-center gap-2.5 mb-2"><span className="bl text-xs text-[var(--t2)] w-[130px] shrink-0 truncate">{x.l}</span><div className="bt flex-1 h-2 bg-[var(--s2)] rounded overflow-hidden"><div className="bf h-full rounded" style={{ width: `${x.v}%`, background: x.c }} /></div><span className="bv text-xs text-[var(--t3)] w-[30px] text-right">{x.v}%</span></div>)}</div>
            </div>
          </div>
          <div className="ag grid grid-cols-2 gap-3.5 mb-5">
            <div className="ac bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
              <div className="act text-[13px] font-semibold mb-3">Contacts par canal <span className="act-sub text-[11px] text-[var(--t3)] font-normal">volume</span></div>
              <div>{d.canal.map((x) => <div key={x.l} className="br flex items-center gap-2.5 mb-2"><span className="bl text-xs text-[var(--t2)] w-[130px] shrink-0 truncate">{x.l}</span><div className="bt flex-1 h-2 bg-[var(--s2)] rounded overflow-hidden"><div className="bf h-full rounded" style={{ width: `${Math.round((x.v / x.m) * 100)}%`, background: x.c }} /></div><span className="bv text-xs text-[var(--t3)] w-[22px] text-right font-mono shrink-0">{x.v}</span></div>)}</div>
            </div>
            <div className="ac bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
              <div className="act text-[13px] font-semibold mb-3">Délai moyen par stade <span className="act-sub text-[11px] text-[var(--t3)] font-normal">jours</span></div>
              <div>{d.delay.map((x) => <div key={x.l} className="br flex items-center gap-2.5 mb-2"><span className="bl text-xs text-[var(--t2)] w-[130px] shrink-0 truncate">{x.l}</span><div className="bt flex-1 h-2 bg-[var(--s2)] rounded overflow-hidden"><div className="bf h-full rounded" style={{ width: `${Math.round((x.v / x.m) * 100)}%`, background: x.c }} /></div><span className="bv text-xs text-[var(--t3)] w-[28px] text-right font-mono shrink-0">{x.v}j</span></div>)}</div>
            </div>
          </div>
          <div className="ac bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 mb-5">
            <div className="act text-[13px] font-semibold mb-3">Entonnoir pipeline — pertes par étape <span className="act-sub text-[11px] text-[var(--t3)] font-normal">R0 = 100%</span></div>
            <div>{fn.map((f, i) => <div key={f.l} className="fr flex items-center gap-2.5 mb-1"><span className="fl text-xs text-[var(--t2)] w-[125px] shrink-0 truncate">{f.l}</span><div className="flex-1"><div className="fb h-[26px] rounded flex items-center px-2.5 text-xs font-medium text-white min-w-[38px]" style={{ width: `${Math.max(6, Math.round((f.n / d.c) * 100))}%`, background: fc[i] || '#888' }}>{f.n}</div></div><span className="fls text-[11px] text-[var(--red)] w-8 text-right font-mono shrink-0">{i > 0 && fn[i - 1].n > 0 ? `-${Math.round((1 - f.n / fn[i - 1].n) * 100)}%` : ''}</span></div>)}</div>
          </div>
        </>
      )}
      <div className="ag3 grid grid-cols-3 gap-3.5">
        <div className="ac bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
          <div className="act text-[13px] font-semibold mb-3">Profils par zone Evolve</div>
          <div className="text-xs text-[var(--t3)] mb-2">Occitanie 9 · PACA 7 · Nvlle-Aquitaine 6</div>
        </div>
        <div className="ac bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
          <div className="act text-[13px] font-semibold mb-3">Séquences Lemlist actives</div>
          <div className="text-xs text-[var(--t3)]">S1 Captifs 11 · S2 Semi-captifs 4</div>
        </div>
        <div className="ac bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
          <div className="act text-[13px] font-semibold mb-3">Intégrations à venir</div>
          {integrs.slice(0, 5).map((p, i) => (
            <div key={p.id} className="flex items-center gap-2.5 mb-2">
              <div className="av w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px] font-semibold" style={{ backgroundColor: Object.values(STAGE_COLORS)[i % 7]?.bg || '#eee', color: Object.values(STAGE_COLORS)[i % 7]?.text || '#666' }}>{p.fn?.[0]}{p.ln?.[0]}</div>
              <div className="flex-1"><div className="text-[12.5px] font-medium">{p.fn} {p.ln}</div><div className="text-[11px] text-[var(--t3)]"><span className="tag px-1 py-0.5 rounded text-[10px]" style={{ background: STAGE_COLORS[p.stg]?.bg, color: STAGE_COLORS[p.stg]?.text }}>{p.stg}</span></div></div>
              <span className="text-xs font-semibold text-[var(--accent)]">{p.integ}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
