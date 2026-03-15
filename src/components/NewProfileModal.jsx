import { useState } from 'react'
import { useCRM } from '../context/CRMContext'
import { IconClose } from './Icons'

export default function NewProfileModal({ onClose }) {
  const { addProfile } = useCRM()
  const [fn, setFn] = useState('')
  const [ln, setLn] = useState('')
  const [co, setCo] = useState('')
  const [ti, setTi] = useState('')
  const [city, setCity] = useState('')
  const [mail, setMail] = useState('')
  const [src, setSrc] = useState('Chasse LinkedIn')

  const handleSubmit = async () => {
    const ok = await addProfile({ fn, ln, co, ti, city, mail, src })
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
          <div className="mb-2.5"><label className="inlin-lbl text-xs text-[var(--t3)] block mb-1">Source</label>
            <select className="inlin-sel w-full py-2 px-2.5 border border-[var(--b2)] rounded-md text-[13px] outline-none bg-[var(--surface)] cursor-pointer" value={src} onChange={(e) => setSrc(e.target.value)}>
              <option>Chasse LinkedIn</option><option>Chasse Mail</option><option>Recommandation</option><option>Inbound</option><option>Ads</option><option>Direct contact</option>
            </select>
          </div>
          <button type="button" className="btn bp w-full py-2.5" onClick={handleSubmit}>Ajouter ce profil</button>
        </div>
      </div>
    </div>
  )
}
