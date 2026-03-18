import { useState } from 'react'
import { PAS_INTERESSE_TYPES } from '../lib/data'

const ACCENT = '#173731'
const GOLD = '#D2AB76'

export default function PasInteresseModal({ profile, onClose, onSaved }) {
  const [raison, setRaison] = useState('')
  const [detail, setDetail] = useState('')
  const [saving, setSaving] = useState(false)
  const profileName = [profile?.fn || profile?.first_name, profile?.ln || profile?.last_name].filter(Boolean).join(' ') || '—'
  const stageLabel = profile?.stg || profile?.stage || 'Avant pipeline'

  const handleSave = async () => {
    if (!raison) return
    setSaving(true)
    await onSaved(raison, detail.trim() || null)
    setSaving(false)
  }

  return (
    <div style={{ background: '#F5F0E8', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: 400, maxWidth: 480, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
      <div style={{ background: ACCENT, padding: '20px 24px' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, color: 'white' }}>Profil pas intéressé — {profileName}</div>
        <div style={{ fontSize: 13, color: GOLD, marginTop: 4 }}>Stade actuel : {stageLabel}</div>
      </div>
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 6 }}>Raison</label>
          <select value={raison} onChange={(e) => setRaison(e.target.value)} required style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6 }}>
            <option value="">Sélectionner...</option>
            {PAS_INTERESSE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 6 }}>Détail (optionnel)</label>
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Précisez la raison..." rows={3} style={{ width: '100%', padding: 10, fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 16px', fontSize: 13, border: `1px solid ${ACCENT}`, borderRadius: 6, background: 'transparent', color: ACCENT, cursor: 'pointer' }}>Annuler</button>
          <button type="button" onClick={handleSave} disabled={saving || !raison} style={{ padding: '10px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: GOLD, color: ACCENT, cursor: 'pointer', fontWeight: 600, opacity: saving || !raison ? 0.6 : 1 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  )
}
