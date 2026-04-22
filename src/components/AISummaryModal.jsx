import { useState } from 'react'

const ACCENT = '#173731'
const GOLD = '#D2AB76'
const BG = '#F5F0E8'

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

export default function AISummaryModal({ profile, onClose, onSave }) {
  const [rawNote, setRawNote] = useState('')
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('input') // 'input' | 'preview'
  const [saving, setSaving] = useState(false)

  const profileName = [profile?.fn, profile?.ln].filter(Boolean).join(' ') || '—'

  const handleGenerate = async () => {
    if (!rawNote.trim()) return
    if (!ANTHROPIC_KEY) {
      setError('Clé VITE_ANTHROPIC_API_KEY manquante dans les variables Vercel')
      return
    }
    setLoading(true)
    setError('')
    try {
      const profileContext = [
        profile?.fn && profile?.ln ? `Prénom Nom : ${profile.fn} ${profile.ln}` : null,
        profile?.co ? `Employeur : ${profile.co}` : null,
        profile?.ti ? `Poste : ${profile.ti}` : null,
        profile?.stg ? `Étape pipeline : ${profile.stg}` : null,
        profile?.mat ? `Maturité : ${profile.mat}` : null,
        profile?.region ? `Région : ${profile.region}` : null,
      ].filter(Boolean).join('\n')

      const userPrompt = `${profileContext ? `## Contexte du profil\n${profileContext}\n\n` : ''}## Note brute de l'échange\n${rawNote.trim()}\n\n---\n\nGénère un récapitulatif structuré :\n\n**📋 Résumé de l'échange**\n- [points clés]\n\n**💡 Éléments clés à retenir**\n- [infos importantes sur le profil, motivations, objections]\n\n**🎯 Points d'appui pour le prochain RDV**\n- [angles, questions à approfondir]\n\nSois factuel et direct. Pas d'introduction ni de conclusion.`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: 'Tu es un assistant expert en recrutement CGP pour Evolve Investissement. Tu synthétises les échanges avec des prospects CGP. Tu réponds toujours en français, de manière concise et professionnelle.',
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data?.error?.message || `Erreur API Anthropic (${res.status})`)
        return
      }
      setSummary(data.content?.[0]?.text || '')
      setStep('preview')
    } catch (e) {
      setError(e.message || 'Erreur réseau inattendue')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!summary.trim()) return
    setSaving(true)
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const noteContent = `✨ Récap IA — ${today}\n\n${summary}`
    await onSave(noteContent)
    setSaving(false)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        style={{ background: BG, borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', width: 600, maxWidth: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: ACCENT, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 600, color: 'white' }}>✨ Récap IA</div>
            <div style={{ fontSize: 12, color: GOLD, marginTop: 3 }}>{profileName}{profile?.co ? ` — ${profile.co}` : ''}</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18, opacity: 0.7, lineHeight: 1 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E5E0D8', background: 'white' }}>
          <button
            type="button"
            onClick={() => setStep('input')}
            style={{ flex: 1, padding: '10px 16px', fontSize: 13, border: 'none', borderBottom: step === 'input' ? `2px solid ${ACCENT}` : '2px solid transparent', background: 'transparent', color: step === 'input' ? ACCENT : '#999', cursor: 'pointer', fontWeight: step === 'input' ? 600 : 400 }}
          >
            📝 Note brute
          </button>
          <button
            type="button"
            onClick={() => summary && setStep('preview')}
            disabled={!summary}
            style={{ flex: 1, padding: '10px 16px', fontSize: 13, border: 'none', borderBottom: step === 'preview' ? `2px solid ${ACCENT}` : '2px solid transparent', background: 'transparent', color: step === 'preview' ? ACCENT : '#999', cursor: summary ? 'pointer' : 'not-allowed', fontWeight: step === 'preview' ? 600 : 400, opacity: summary ? 1 : 0.5 }}
          >
            ✨ Récap généré
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {step === 'input' ? (
            <>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 1.6 }}>
                Collez ici la note brute de votre échange (transcription Gemini, compte-rendu rapide…). L'IA va générer un récap structuré avec les points clés et les éléments à préparer pour le prochain RDV.
              </p>
              <textarea
                value={rawNote}
                onChange={(e) => setRawNote(e.target.value)}
                placeholder="Ex : Appel de 20 min avec Marie. Elle travaille chez BNP depuis 6 ans, CGP senior. Très curieuse de l'indépendance mais inquiète sur la rémunération variable. Son manager sait qu'elle cherche autre chose. Elle a un enfant de 3 ans, cherche de la flexibilité…"
                rows={10}
                style={{ width: '100%', padding: '12px 14px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 8, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box', outline: 'none', color: '#1A1A1A' }}
              />
              {error && (
                <div style={{ marginTop: 10, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 12, color: '#B91C1C' }}>
                  ⚠ {error}
                </div>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: 12, color: '#999', marginBottom: 14 }}>Vous pouvez modifier le récap avant de le sauvegarder.</p>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={14}
                style={{ width: '100%', padding: '12px 14px', fontSize: 13, border: '1px solid #E5E0D8', borderRadius: 8, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7, boxSizing: 'border-box', outline: 'none', color: '#1A1A1A' }}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E0D8', background: 'white', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 16px', fontSize: 13, border: `1px solid ${ACCENT}`, borderRadius: 8, background: 'transparent', color: ACCENT, cursor: 'pointer' }}>
            Annuler
          </button>
          {step === 'input' ? (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !rawNote.trim()}
              style={{ padding: '9px 20px', fontSize: 13, border: 'none', borderRadius: 8, background: ACCENT, color: GOLD, cursor: loading || !rawNote.trim() ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: loading || !rawNote.trim() ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {loading ? (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: `2px solid ${GOLD}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Génération…
                </>
              ) : '✨ Générer le récap'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !summary.trim()}
              style={{ padding: '9px 20px', fontSize: 13, border: 'none', borderRadius: 8, background: GOLD, color: ACCENT, cursor: saving || !summary.trim() ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: saving || !summary.trim() ? 0.6 : 1 }}
            >
              {saving ? 'Sauvegarde…' : '💾 Sauvegarder la note'}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
