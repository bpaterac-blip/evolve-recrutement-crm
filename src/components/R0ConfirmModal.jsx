import { useState } from 'react'
import { SOURCES } from '../lib/data'

const ACCENT = '#173731'
const GOLD = '#D2AB76'

function getDefaultDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const h = 8 + Math.floor(i / 2)
  const m = (i % 2) * 30
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

export default function R0ConfirmModal({ profile, onClose, onConfirm }) {
  const [source, setSource] = useState(profile?.src || '')
  const [r0Date, setR0Date] = useState(getDefaultDate())
  const [r0Time, setR0Time] = useState('09:00')
  const [saving, setSaving] = useState(false)
  const profileName = [profile?.fn || profile?.first_name, profile?.ln || profile?.last_name].filter(Boolean).join(' ') || '—'
  const company = profile?.co || profile?.company || '—'

  const handleConfirm = async () => {
    if (!source || !r0Date) return
    setSaving(true)
    await onConfirm(source, r0Date, r0Time)
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: '#F5F0E8', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: 400, maxWidth: 480, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ background: ACCENT, padding: '20px 24px' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, color: 'white' }}>Passer en R0</div>
          <div style={{ fontSize: 13, color: GOLD, marginTop: 4 }}>{profileName} — {company}</div>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 16, lineHeight: 1.5 }}>
            Ce profil va être ajouté au pipeline de recrutement. Confirmez la source et planifiez la date du R0.
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 6 }}>Source d'origine</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, background: 'white' }}
            >
              <option value="">Sélectionner la source...</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 6 }}>Date du R0</label>
              <input
                type="date"
                value={r0Date}
                onChange={(e) => setR0Date(e.target.value)}
                required
                style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, background: 'white', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ width: 110 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 6 }}>Heure</label>
              <select
                value={r0Time}
                onChange={(e) => setR0Time(e.target.value)}
                style={{ width: '100%', padding: '10px 8px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 6, background: 'white' }}
              >
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 16px', fontSize: 13, border: `1px solid ${ACCENT}`, borderRadius: 6, background: 'transparent', color: ACCENT, cursor: 'pointer' }}>
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || !source || !r0Date}
              style={{ padding: '10px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: GOLD, color: ACCENT, cursor: 'pointer', fontWeight: 600, opacity: saving || !source || !r0Date ? 0.6 : 1 }}
            >
              {saving ? 'Envoi…' : 'Confirmer R0'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
