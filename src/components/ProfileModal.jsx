import { useState, useEffect } from 'react'
import { useCRM } from '../context/CRMContext'
import { STAGES, MATURITIES, INTEG_OPTS, STAGE_COLORS } from '../lib/data'

const SRC_TAG = { 'Chasse LinkedIn': 'tb', 'Chasse Mail': 'tt', 'Recommandation': 'tp', 'Inbound': 'tg', 'Ads': 'ta', 'Direct contact': 'tx' }

export default function ProfileModal({ profile: initialProfile, onClose }) {
  const {
    profiles,
    changeStage,
    changeMaturity,
    changeInteg,
    saveNote,
    addEvent,
    updateProfileScore,
    today,
    loadProfileDetail,
    profileNotes,
    profileActivities,
  } = useCRM()
  const profile = initialProfile ? profiles.find((p) => p.id === initialProfile.id) || initialProfile : null
  const [note, setNote] = useState('')
  const [evType, setEvType] = useState('RDV planifié')
  const [evDate, setEvDate] = useState('')
  const [evNote, setEvNote] = useState('')
  const [ddStage, setDdStage] = useState(false)
  const [ddMat, setDdMat] = useState(false)
  const [scoreEdit, setScoreEdit] = useState(false)
  const [newScore, setNewScore] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    if (profile) {
      setNote(profileNotes[profile.id] ?? profile.notes ?? '')
      setLoadingDetail(true)
      loadProfileDetail(profile.id).then(({ notes, acts }) => {
        setNote(notes || '')
        setLoadingDetail(false)
      })
    }
  }, [profile?.id, profileNotes])

  if (!profile) return null

  const acts = profileActivities[profile.id] || profile.acts || []

  const scpill = (s) => s >= 70 ? 'bg-[var(--gbg)] text-[var(--green)]' : s >= 45 ? 'bg-[var(--abg)] text-[var(--amber)]' : 'bg-[var(--s2)] text-[var(--t3)]'
  const srctag = (s) => `tag ${SRC_TAG[s] || 'tx'}`
  const mattag = (m) => ({ Froid: 'tx', Tiède: 'ta', Chaud: 'tb', 'Très chaud': 'tg' }[m] || 'tx')

  const handleSaveScore = () => {
    const sc = parseInt(newScore, 10)
    if (!isNaN(sc) && sc >= 0 && sc <= 100) {
      updateProfileScore(profile.id, sc)
      setScoreEdit(false)
      setNewScore('')
    }
  }

  return (
    <div className="ov fixed inset-0 bg-black/35 z-[200] flex items-start justify-end" onClick={onClose}>
      <div className="modal bg-[var(--surface)] w-[540px] h-screen overflow-y-auto shadow-[-20px_0_60px_rgba(0,0,0,0.15)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="mhd py-4 px-5 border-b border-[var(--border)] flex items-center justify-between sticky top-0 bg-[var(--surface)] z-10 shrink-0">
          <div>
            <div className="mttl text-base font-semibold">{profile.fn} {profile.ln}</div>
            <div className="text-xs text-[var(--t3)] mt-0.5">{profile.co} · {profile.ti} · {profile.city}</div>
          </div>
          <button type="button" className="text-lg cursor-pointer text-[var(--t3)] bg-none border-none leading-none" onClick={onClose}>✕</button>
        </div>
        <div className="mbd p-5 flex-1">
          <div className="mstl text-[11px] uppercase tracking-wider text-[var(--t3)] mb-2.5 font-medium">Informations</div>
          <div className="dr flex items-start gap-2.5 mb-2 text-[13.5px]"><span className="dk text-[var(--t3)] w-[120px] shrink-0 pt-0.5">Email</span><span className="text-[var(--accent)]">{profile.mail}</span></div>
          <div className="dr flex items-start gap-2.5 mb-2 text-[13.5px]"><span className="dk text-[var(--t3)] w-[120px] shrink-0 pt-0.5">LinkedIn</span><span className="text-[var(--accent)] text-xs">{profile.li}</span></div>
          <div className="dr flex items-start gap-2.5 mb-2"><span className="dk text-[var(--t3)] w-[120px] shrink-0 pt-0.5">Source</span><span className={`tag ${srctag(profile.src)}`}>{profile.src}</span></div>
          <div className="dr flex items-start gap-2.5 mb-2">
            <span className="dk text-[var(--t3)] w-[120px] shrink-0 pt-0.5">Score</span>
            {scoreEdit ? (
              <div className="flex gap-2 items-center">
                <input type="number" min={0} max={100} className="inlin-input w-20 py-1 px-2" value={newScore} onChange={(e) => setNewScore(e.target.value)} placeholder={profile.sc} />
                <button type="button" className="btn bp bsm" onClick={handleSaveScore}>Valider</button>
                <button type="button" className="btn bo bsm" onClick={() => { setScoreEdit(false); setNewScore(''); }}>Annuler</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`sc inline-flex items-center justify-center w-9 h-6 rounded-md text-xs font-semibold font-mono ${scpill(profile.sc)}`}>{profile.sc}</span>
                <button type="button" className="text-xs text-[var(--t3)] hover:text-[var(--accent)]" onClick={() => { setScoreEdit(true); setNewScore(String(profile.sc)); }}>✎ Corriger</button>
              </div>
            )}
          </div>
          <div className="dr flex items-start gap-2.5 mb-2 relative">
            <span className="dk text-[var(--t3)] w-[120px] shrink-0 pt-0.5">Maturité</span>
            <div className="relative">
              <button type="button" className={`tag tag-btn ${mattag(profile.mat)}`} onClick={() => { setDdMat(!ddMat); setDdStage(false); }}>{profile.mat} ▾</button>
              {ddMat && <div className="ddrop absolute top-full left-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg z-[100] min-w-[170px] p-1">
                {MATURITIES.map((m) => <div key={m} className={`ddi py-1.5 px-2.5 rounded-md text-[13px] cursor-pointer hover:bg-[var(--s2)] ${m === profile.mat ? 'font-semibold' : ''}`} onClick={() => { changeMaturity(profile.id, m); setDdMat(false); }}>{m}</div>)}
              </div>}
            </div>
          </div>
          <div className="dr flex items-start gap-2.5 mb-2 relative">
            <span className="dk text-[var(--t3)] w-[120px] shrink-0 pt-0.5">Stade</span>
            <div className="relative">
              <button type="button" className="tag tag-btn" style={{ background: STAGE_COLORS[profile.stg]?.bg, color: STAGE_COLORS[profile.stg]?.text }} onClick={() => { setDdStage(!ddStage); setDdMat(false); }}>{profile.stg} ▾</button>
              {ddStage && <div className="ddrop absolute top-full left-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg z-[100] min-w-[170px] p-1">
                {STAGES.map((s) => <div key={s} className={`ddi py-1.5 px-2.5 rounded-md text-[13px] cursor-pointer hover:bg-[var(--s2)] ${s === profile.stg ? 'font-semibold' : ''}`} onClick={() => { changeStage(profile.id, s); setDdStage(false); }}>{s}</div>)}
              </div>}
            </div>
          </div>
          <div className="dr flex items-start gap-2.5 mb-2">
            <span className="dk text-[var(--t3)] w-[120px] shrink-0 pt-0.5">Intégration prév.</span>
            <select className="inlin-sel w-auto text-[13px] py-1 px-2" value={profile.integ} onChange={(e) => changeInteg(profile.id, e.target.value)}>
              {INTEG_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
              <option value="Intégré">Intégré</option>
            </select>
          </div>
          {profile.dur && (
            <div className="dr flex items-start gap-2.5 mb-2 text-[13.5px]">
              <span className="dk text-[var(--t3)] w-[120px] shrink-0 pt-0.5">Ancienneté</span>
              <span className="text-[var(--t2)]">{profile.dur}</span>
            </div>
          )}

          {Array.isArray(profile.experiences) && profile.experiences.length > 0 && (
            <>
              <div className="sdiv h-px bg-[var(--border)] my-4" />
              <div className="mstl text-[11px] uppercase tracking-wider text-[var(--t3)] mb-2.5 font-medium">Expériences passées</div>
              <div className="tl relative pl-5 border-l-2 border-[var(--border)] ml-0.5">
                {profile.experiences.map((exp, i) => (
                  <div key={i} className="relative pb-4 last:pb-0">
                    <div className="absolute -left-[11px] top-1 w-2.5 h-2.5 rounded-full bg-[var(--accent)] border-2 border-[var(--surface)]" />
                    <div className="text-[13px] font-semibold text-[var(--text)]">{exp.company}</div>
                    <div className="text-[12.5px] text-[var(--t2)] mt-0.5">{exp.title}</div>
                    {(exp.duration || exp.city) && (
                      <div className="text-[11.5px] text-[var(--t3)] mt-1">
                        {exp.duration}{exp.duration && exp.city ? ' · ' : ''}{exp.city}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="sdiv h-px bg-[var(--border)] my-4" />

          <div className="mstl text-[11px] uppercase tracking-wider text-[var(--t3)] mb-2.5 font-medium">Notes & récapitulatifs</div>
          <textarea className="note-box w-full py-2 px-2.5 border border-[var(--b2)] rounded-lg text-[13px] resize-none outline-none bg-[var(--bg)] leading-normal focus:border-[var(--accent)] focus:bg-white transition-colors" rows={3} placeholder="Récapitulatif d'échange…" value={note} onChange={(e) => setNote(e.target.value)} disabled={loadingDetail} />
          <button type="button" className="btn bo bsm mt-1.5 mb-4" onClick={() => saveNote(profile.id, note)}>💾 Enregistrer la note</button>

          <div className="mstl text-[11px] uppercase tracking-wider text-[var(--t3)] mb-2.5 font-medium">Ajouter un événement / rappel</div>
          <div className="grid2 grid grid-cols-2 gap-2.5 mb-2">
            <div><label className="inlin-lbl text-xs text-[var(--t3)] block mb-1">Type</label>
              <select className="inlin-sel w-full py-2 px-2.5 border border-[var(--b2)] rounded-md text-[13px] outline-none bg-[var(--surface)] cursor-pointer" value={evType} onChange={(e) => setEvType(e.target.value)}>
                <option>RDV planifié</option><option>RDV démission reconversion</option><option>Point téléphonique</option><option>Relance prévue</option><option>Point juridique</option><option>Signature contrat</option><option>Note libre</option>
              </select>
            </div>
            <div><label className="inlin-lbl text-xs text-[var(--t3)] block mb-1">Date</label>
              <input className="inlin-input w-full py-2 px-2.5 border border-[var(--b2)] rounded-md text-[13px] outline-none bg-[var(--surface)]" type="text" placeholder="ex : 21/03" value={evDate} onChange={(e) => setEvDate(e.target.value)} />
            </div>
          </div>
          <textarea className="note-box w-full py-2 px-2.5 border border-[var(--b2)] rounded-lg text-[13px] resize-none outline-none bg-[var(--bg)] leading-normal" rows={2} placeholder="Détail optionnel…" value={evNote} onChange={(e) => setEvNote(e.target.value)} />
          <button type="button" className="btn bp bsm mt-1.5 mb-4" onClick={() => { addEvent(profile.id, { type: evType, date: evDate || today(), note: evNote }); setEvNote(''); setEvDate(''); }}>+ Ajouter à l'historique</button>

          {profile.stg !== 'Recruté' && (
            <>
              <div className="mstl text-[11px] uppercase tracking-wider text-[var(--t3)] mb-2.5 font-medium">Actions rapides</div>
              <button type="button" className="ab w-full py-2 px-3 rounded-lg border border-[var(--b2)] bg-[var(--s2)] text-[13px] cursor-pointer text-left mb-1.5 flex items-center gap-2 hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] transition-all" onClick={() => {}}>📅 Planifier un RDV Google Meet</button>
              {STAGES[STAGES.indexOf(profile.stg) + 1] && <button type="button" className="ab w-full py-2 px-3 rounded-lg border border-[var(--b2)] bg-[var(--s2)] text-[13px] cursor-pointer text-left mb-1.5 flex items-center gap-2 hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] transition-all" onClick={() => changeStage(profile.id, STAGES[STAGES.indexOf(profile.stg) + 1])}>↗ Avancer vers {STAGES[STAGES.indexOf(profile.stg) + 1]}</button>}
            </>
          )}

          <div className="mstl text-[11px] uppercase tracking-wider text-[var(--t3)] mb-2.5 font-medium mt-5">Historique d'activité</div>
          <div>
            {acts.map((a, i) => (
              <div key={i} className={`ai2 flex gap-3 py-2.5 border-b border-[var(--border)] text-[13px] last:border-b-0 ${a.type === 'lem' ? 'lem-ev bg-[var(--lbg)] mx-[-4px] px-1 py-2.5 rounded-md border-none' : ''} ${a.type === 'stg' ? 'stg-ev bg-[#EDF4FF] mx-[-4px] px-1 py-2.5 rounded-md border-none' : ''} ${a.type === 'mat' ? 'mat-ev bg-[#F5F0FA] mx-[-4px] px-1 py-2.5 rounded-md border-none' : ''}`}>
                <div className="ad text-[var(--t3)] text-[11.5px] w-[78px] shrink-0 mt-0.5">{a.d}</div>
                <div><div className="at font-medium mb-0.5 flex items-center gap-1.5"><span className="act-ico text-[13px]">{a.ico || '•'}</span>{a.t}</div><div className="an text-[var(--t2)] text-[12.5px] leading-snug">{a.n}</div></div>
              </div>
            ))}
            {acts.length === 0 && !loadingDetail && <div className="text-[var(--t3)] text-sm py-4">Aucune activité</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
