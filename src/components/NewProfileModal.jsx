import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import { IconClose } from './Icons'
import { detectDoublon } from '../lib/detectDoublon'

const IconWarning = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

export default function NewProfileModal({ onClose }) {
  const navigate = useNavigate()
  const { addProfile } = useCRM()
  const [fn, setFn] = useState('')
  const [ln, setLn] = useState('')
  const [co, setCo] = useState('')
  const [ti, setTi] = useState('')
  const [city, setCity] = useState('')
  const [mail, setMail] = useState('')
  const [li, setLi] = useState('')
  const [src, setSrc] = useState('Chasse LinkedIn')
  const [doublon, setDoublon] = useState(null)

  const handleLinkedInBlur = async () => {
    const url = li.trim()
    if (!url || (!url.startsWith('http') && !url.includes('linkedin.com'))) {
      setDoublon(null)
      return
    }
    const existing = await detectDoublon({ li: url, fn, ln, co, mail })
    setDoublon(existing)
  }

  const handleSubmit = async () => {
    if (doublon) return
    const ok = await addProfile({ fn, ln, co, ti, city, mail, li, src })
    if (ok) onClose()
  }

  return (
    <div className="ov fixed inset-0 bg-black/35 z-[200] flex items-start justify-end" onClick={onClose}>
      <div className="modal bg-[var(--surface)] w-[460px] h-screen overflow-y-auto shadow-[-20px_0_60px_rgba(0,0,0,0.15)]" onClick={(e) => e.stopPropagation()}>
        <div className="mhd py-4 px-5 border-b border-[var(--border)] flex items-center justify-between">
          <div className="mttl text-base font-semibold">Nouveau profil</div>
          <button type="button" className="text-lg cursor-pointer text-[var(--t3)] bg-none border-none inline-flex items-center justify-center" onClick={onClose}><IconClose /></button>
        </div>
        <div className="mbd p-5">
          <div className="grid2 grid grid-cols-2 gap-2.5 mb-2.5">
            <div><label className="inlin-lbl text-xs text-[var(--t3)] block mb-1">Prénom</label><input className="inlin-input w-full py-2 px-2.5 border border-[var(--b2)] rounded-md text-[13px] outline-none bg-[var(--surface)]" placeholder="Thomas" value={fn} onChange={(e) => setFn(e.target.value)} /></div>
            <div><label className="inlin-lbl text-xs text-[var(--t3)] block mb-1">Nom</label><input className="inlin-input w-full py-2 px-2.5 border border-[var(--b2)] rounded-md text-[13px] outline-none bg-[var(--surface)]" placeholder="Dupont" value={ln} onChange={(e) => setLn(e.target.value)} /></div>
          </div>
          <div className="mb-2.5"><label className="inlin-lbl text-xs text-[var(--t3)] block mb-1">Employeur</label><input className="inlin-input w-full py-2 px-2.5 border border-[var(--b2)] rounded-md text-[13px] outline-none bg-[var(--surface)]" placeholder="Crédit Agricole" value={co} onChange={(e) => setCo(e.target.value)} /></div>
          <div className="mb-2.5"><label className="inlin-lbl text-xs text-[var(--t3)] block mb-1">Intitulé de poste</label><input className="inlin-input w-full py-2 px-2.5 border border-[var(--b2)] rounded-md text-[13px] outline-none bg-[var(--surface)]" placeholder="CGP" value={ti} onChange={(e) => setTi(e.target.value)} /></div>
          <div className="grid2 grid grid-cols-2 gap-2.5 mb-2.5">
            <div><label className="inlin-lbl text-xs text-[var(--t3)] block mb-1">Ville</label><input className="inlin-input w-full py-2 px-2.5 border border-[var(--b2)] rounded-md text-[13px] outline-none bg-[var(--surface)]" placeholder="Toulouse" value={city} onChange={(e) => setCity(e.target.value)} /></div>
            <div><label className="inlin-lbl text-xs text-[var(--t3)] block mb-1">Email</label><input className="inlin-input w-full py-2 px-2.5 border border-[var(--b2)] rounded-md text-[13px] outline-none bg-[var(--surface)]" placeholder="t.dupont@ca.fr" value={mail} onChange={(e) => setMail(e.target.value)} /></div>
          </div>
          <div className="mb-2.5">
            <label className="inlin-lbl text-xs text-[var(--t3)] block mb-1">URL LinkedIn</label>
            <input
              className="inlin-input w-full py-2 px-2.5 border border-[var(--b2)] rounded-md text-[13px] outline-none bg-[var(--surface)]"
              placeholder="https://linkedin.com/in/..."
              value={li}
              onChange={(e) => { setLi(e.target.value); setDoublon(null) }}
              onBlur={handleLinkedInBlur}
            />
            {doublon && (
              <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8, background: '#FFF7ED', border: '1px solid #f59e0b', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }}><IconWarning /></span>
                <div style={{ fontSize: 12, color: '#92400e' }}>
                  Ce profil existe déjà : {doublon.first_name} {doublon.last_name} · {doublon.company || '—'} · Stade : {doublon.stage || '—'}
                  <button type="button" onClick={() => { onClose(); navigate(`/profiles/${doublon.id}`) }} style={{ marginLeft: 8, color: '#173731', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>Voir le profil existant</button>
                </div>
              </div>
            )}
          </div>
          <div className="mb-2.5"><label className="inlin-lbl text-xs text-[var(--t3)] block mb-1">Source</label>
            <select className="inlin-sel w-full py-2 px-2.5 border border-[var(--b2)] rounded-md text-[13px] outline-none bg-[var(--surface)] cursor-pointer" value={src} onChange={(e) => setSrc(e.target.value)}>
              <option>Chasse LinkedIn</option><option>Chasse Mail</option><option>Recommandation</option><option>Inbound</option><option>Ads</option><option>Direct contact</option>
            </select>
          </div>
          <button type="button" className="btn bp w-full py-2.5" onClick={handleSubmit} disabled={!!doublon}>Enregistrer</button>
        </div>
      </div>
    </div>
  )
}
