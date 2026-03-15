import { useEffect, useState } from 'react'
import { IconClose } from './Icons'

const PAGE_STYLE = {
  bg: 'rgba(0,0,0,0.45)',
  cardBg: '#ffffff',
  border: '#E5E0D8',
  accent: '#173731',
  gold: '#D2AB76',
  textSecondary: '#6B6B6B',
}

export default function NoteModal({ profile, note, templates, onClose, onSaved }) {
  const [templateKey, setTemplateKey] = useState('Note libre')
  const [content, setContent] = useState(note?.content || '')
  const [saving, setSaving] = useState(false)

  // Initialiser le contenu selon le template si nouvelle note
  useEffect(() => {
    if (!note && templates && templateKey && templates[templateKey] != null) {
      setContent(templates[templateKey] || '')
    }
  }, [note, templates, templateKey])

  // Escape pour fermer
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = async () => {
    if (!profile?.id) return
    setSaving(true)
    try {
      if (note) {
        // Mise à jour
        const { error } = await window.supabase
          .from('notes')
          .update({ content })
          .eq('id', note.id)
        if (error) console.error('Erreur update note', error)
      } else {
        // Création
        const { error } = await window.supabase
          .from('notes')
          .insert({ profile_id: profile.id, content })
        if (error) console.error('Erreur insert note', error)
      }
      if (onSaved) await onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: PAGE_STYLE.bg }}
    >
      <div
        className="w-full max-w-[800px] max-h-[90vh] rounded-[12px] border shadow-xl flex flex-col"
        style={{ background: PAGE_STYLE.cardBg, borderColor: PAGE_STYLE.border }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: PAGE_STYLE.border }}>
          <div>
            <div className="text-[13px] text-[var(--t3)] mb-1">
              {today}
            </div>
            <div className="font-semibold text-[15px]">
              Note · {profile.fn} {profile.ln}
            </div>
          </div>
          <button
            type="button"
            className="text-[var(--t3)] hover:text-[var(--text)] text-lg inline-flex items-center justify-center"
            onClick={onClose}
          >
            <IconClose />
          </button>
        </div>

        <div className="px-5 py-4 flex-1 overflow-y-auto">
          <div className="mb-3">
            <label className="text-[11px] text-[var(--t3)] mb-1 block">Template</label>
            <select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="w-full border rounded-md px-2 py-1.5 text-[13px]"
              style={{ borderColor: PAGE_STYLE.border }}
              disabled={!!note}
            >
              {Object.keys(templates || {}).map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            style={{
              width: '100%',
              minHeight: 400,
              padding: 12,
              fontSize: 13,
              borderRadius: 8,
              border: `1px solid ${PAGE_STYLE.border}`,
              resize: 'vertical',
            }}
            placeholder="Rédigez la note ici…"
          />
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2" style={{ borderColor: PAGE_STYLE.border }}>
          <button
            type="button"
            className="px-3 py-1.5 text-[13px] rounded-md border"
            style={{ borderColor: PAGE_STYLE.border, color: PAGE_STYLE.textSecondary }}
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            type="button"
            className="px-4 py-1.5 text-[13px] font-semibold rounded-md border"
            style={{ background: PAGE_STYLE.gold, color: PAGE_STYLE.accent, borderColor: PAGE_STYLE.gold }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

