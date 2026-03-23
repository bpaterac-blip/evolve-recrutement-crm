import { useState } from 'react'

const CHUTE_RAISONS = [
  'A rejoint un autre réseau',
  'Veut rester sur son poste actuel',
  'A peur de se lancer',
  'Ghosting',
  'A accepté une offre en CDI',
  'Pas le bon moment',
  'Autre',
]

const ACCENT = '#173731'
const GOLD = '#D2AB76'

export default function ChuteModal({ profile, onClose, onSaved }) {
  const [chuteType, setChuteType] = useState('')
  const [chuteDetail, setChuteDetail] = useState('')
  const [saving, setSaving] = useState(false)
  const profileName = [profile?.fn || profile?.first_name, profile?.ln || profile?.last_name].filter(Boolean).join(' ') || '—'
  const stageLabel = profile?.stg || profile?.stage || '—'

  const handleSave = async () => {
    if (!chuteType) return
    setSaving(true)
    await onSaved(chuteType, chuteDetail.trim() || null)
    setSaving(false)
  }

  return (
    <div style={{ background: '#F5F0E8', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: 400, maxWidth: 480, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
      <div style={{ background: ACCENT, padding: '20px 24px' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, color: 'white' }}>Raison de l'abandon — {profileName}</div>
        <div style={{ fontSize: 13, color: GOLD, marginTop: 4 }}>Stade actuel : {stageLabel}</div>
      </div>
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 6 }}>Type d'abandon</label>
          <select value={chuteType} onChange={(e) => setChuteType(e.target.value)} required style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6 }}>
            <option value="">Sélectionner...</option>
            {CHUTE_RAISONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 6 }}>Détail (optionnel)</label>
          <textarea value={chuteDetail} onChange={(e) => setChuteDetail(e.target.value)} placeholder="Précisez la raison..." rows={3} style={{ width: '100%', padding: 10, fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 16px', fontSize: 13, border: `1px solid ${ACCENT}`, borderRadius: 6, background: 'transparent', color: ACCENT, cursor: 'pointer' }}>Annuler</button>
          <button type="button" onClick={handleSave} disabled={saving || !chuteType} style={{ padding: '10px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: GOLD, color: ACCENT, cursor: 'pointer', fontWeight: 600, opacity: saving || !chuteType ? 0.6 : 1 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  )
}
