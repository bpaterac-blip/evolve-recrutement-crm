import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { loadScoringConfig } from '../lib/scoringConfig'
import { fetchScoringInstructions, fetchScoringInstructionsWithMeta, saveScoringInstructions, onScoringFeedbackUpdated, notifyScoringFeedbackUpdated } from '../lib/scoringInstructions'

const ACCENT = '#173731'
const GOLD = '#D2AB76'

const IconChevronUp = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
)

const IconChevronDown = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const IconPencil = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const IconTrash = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
)

const IconX = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const IconCheck = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const IconWarning = () => (
  <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#D2AB76" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const IconEmpty = () => (
  <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
)

function getProfileName(entry) {
  if (!entry?.profile_id) return '—'
  const pd = entry?.profile_data
  if (!pd || typeof pd !== 'object') return `Profil #${entry.profile_id}`
  const name = pd.name || pd.fullName || pd.full_name
  if (name && String(name).trim()) return String(name).trim()
  const fn = pd.firstName || pd.first_name || ''
  const ln = pd.lastName || pd.last_name || ''
  const combined = [fn, ln].filter(Boolean).join(' ').trim()
  if (combined) return combined
  return `Profil #${entry.profile_id}`
}

const INSTRUCTIONS_PLACEHOLDER = `Écrivez ici vos règles métier pour affiner le scoring...
Ex: Banque Courtois est une banque captive importante dans le Sud-Ouest. Un profil avec 5+ ans chez eux est toujours prioritaire.
Ex: Les gérants de cabinets indépendants ne sont pas notre cible — ils sont déjà indépendants.
Ex: Un titre 'Inspecteur commercial' chez une assurance captive vaut autant qu'un CGP.`

export default function AdminScoringLearning() {
  const navigate = useNavigate()
  const { user, userProfile, role } = useAuth()
  const isAdmin = role === 'admin'
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [applying, setApplying] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [instructionsSaving, setInstructionsSaving] = useState(false)
  const [instructionsLoaded, setInstructionsLoaded] = useState(false)
  const [instructionsUpdatedAt, setInstructionsUpdatedAt] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)
  const [sortBy, setSortBy] = useState({ col: 'created_at', asc: false })
  const [detailModal, setDetailModal] = useState(null)
  const [detailEditing, setDetailEditing] = useState(false)
  const [detailEditScore, setDetailEditScore] = useState('')
  const [detailEditReason, setDetailEditReason] = useState('')
  const [detailSaving, setDetailSaving] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data: fb } = await supabase.from('scoring_feedback').select('id, profile_id, original_score, corrected_score, reason, author, created_at, priority_label, profile_data').order('created_at', { ascending: false })
    setFeedback(fb || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const loadInstructions = async () => {
      const { content, updated_at } = await fetchScoringInstructionsWithMeta()
      setInstructions(content)
      setInstructionsUpdatedAt(updated_at)
      setInstructionsLoaded(true)
    }
    loadInstructions()
  }, [])

  useEffect(() => {
    return onScoringFeedbackUpdated(() => load())
  }, [])

  const handleSaveInstructions = async () => {
    setInstructionsSaving(true)
    setSaveSuccess(false)
    try {
      const updatedAt = await saveScoringInstructions(instructions)
      setInstructionsUpdatedAt(updatedAt)
      await supabase.from('scoring_feedback').insert({
        profile_id: null,
        original_score: null,
        corrected_score: null,
        reason: instructions.trim() || null,
        author: (userProfile?.full_name?.trim() || user?.email) ?? null,
        priority_label: null,
        profile_data: null,
      })
      notifyScoringFeedbackUpdated()
      await load()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (err) {
      console.error(err)
    } finally {
      setInstructionsSaving(false)
    }
  }

  const handleChatSend = async () => {
    const msg = chatInput.trim()
    if (!msg || chatLoading) return
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      setChatMessages((prev) => [...prev, { role: 'u', content: msg }, { role: 'ai', content: 'Clé API Anthropic manquante.' }])
      setChatInput('')
      return
    }
    setChatInput('')
    setChatMessages((prev) => [...prev, { role: 'u', content: msg }])
    setChatLoading(true)
    try {
      const instructionsText = await fetchScoringInstructions()
      const config = await loadScoringConfig()
      const correctionsText = feedback.slice(0, 50).map((f) => {
        const name = getProfileName(f)
        const pd = f.profile_data || {}
        const company = pd?.company || pd?.companyName || '—'
        const orig = f.original_score ?? f.previous_score
        const corr = f.corrected_score ?? f.new_score
        return `- ${name} (${company}): ${orig} → ${corr} — ${(f.reason || f.feedback_note || '').slice(0, 100)}`
      }).join('\n')
      let systemPrompt = `Tu es l'assistant APPRENTISSAGE SCORING CGP. Tu ne réponds QU'aux questions sur le scoring, les critères CGP et l'affinement des règles. Si la question ne porte pas sur le scoring CGP, réponds poliment que tu es spécialisé uniquement sur ce sujet.

CONTEXTE :
- Instructions permanentes : ${instructionsText || 'Aucune'}
- Config scoring actuelle : employeur=${config?.weight_employer ?? 50}pts, titre=${config?.weight_title ?? 30}pts, ancienneté=${config?.weight_seniority ?? 20}pts, bonus CGP=${config?.bonus_cgp_experience ?? 20}pts
- Corrections récentes :\n${correctionsText || 'Aucune'}

Réponds en français, de façon concise.`
      const history = chatMessages.map((m) => ({ role: m.role === 'u' ? 'user' : 'assistant', content: m.content }))
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [...history, { role: 'user', content: msg }].slice(-20),
        }),
      })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const data = await res.json()
      const text = (data.content?.[0]?.text || '').replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')
      setChatMessages((prev) => [...prev, { role: 'ai', content: text }])
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: 'ai', content: `Erreur : ${err?.message}` }])
    } finally {
      setChatLoading(false)
    }
  }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const totalEntries = feedback.length

  const sortedFeedback = [...feedback].sort((a, b) => {
    if (sortBy.col === 'created_at') {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return sortBy.asc ? ta - tb : tb - ta
    }
    return 0
  })

  const openDetailModal = (item) => {
    setDetailModal({ data: item })
    const score = item.corrected_score ?? item.new_score
    setDetailEditScore(String(score ?? ''))
    setDetailEditReason(item.reason || item.feedback_note || '')
    setDetailEditing(false)
  }

  const handleEdit = (item) => {
    setConfirmModal({ type: 'edit', item, fromDetail: !!detailModal })
  }

  const handleDelete = (item) => {
    setConfirmModal({ type: 'delete', item })
    setDetailModal(null)
  }

  const closeDetailModal = () => {
    setDetailModal(null)
    setDetailEditing(false)
    setDetailSaving(false)
  }

  const handleDetailSave = async () => {
    if (!detailModal?.data || detailSaving) return
    setDetailSaving(true)
    try {
      const score = parseInt(detailEditScore, 10)
      const payload = { reason: detailEditReason.trim() || null }
      if (!isNaN(score)) {
        payload.corrected_score = score
        payload.new_score = score
      }
      await supabase.from('scoring_feedback').update(payload).eq('id', detailModal.data.id)
      notifyScoringFeedbackUpdated()
      await load()
      closeDetailModal()
    } catch (err) {
      console.error(err)
    } finally {
      setDetailSaving(false)
    }
  }

  const closeConfirmModal = () => {
    setConfirmModal(null)
    setConfirmPassword('')
    setConfirmError('')
    setConfirmLoading(false)
  }

  const handleConfirmAction = async () => {
    if (!confirmModal || !user?.email || confirmLoading) return
    setConfirmError('')
    setConfirmLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: confirmPassword })
      if (error) {
        setConfirmError('Mot de passe incorrect')
        return
      }
      if (confirmModal.type === 'delete') {
        await supabase.from('scoring_feedback').delete().eq('id', confirmModal.item.id)
        notifyScoringFeedbackUpdated()
        await load()
        closeConfirmModal()
      } else {
        closeConfirmModal()
        if (confirmModal.fromDetail && detailModal?.data?.id === confirmModal.item.id) {
          setDetailEditing(true)
        } else {
          openDetailModal(confirmModal.item)
          setDetailEditing(true)
        }
      }
    } catch (err) {
      setConfirmError('Mot de passe incorrect')
    } finally {
      setConfirmLoading(false)
    }
  }

  const reasonCounts = {}
  feedback.forEach((f) => {
    const r = (f.reason || f.feedback_note || 'Autre').slice(0, 50)
    reasonCounts[r] = (reasonCounts[r] || 0) + 1
  })
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const handleAnalyze = async () => {
    if (!feedback.length) return
    setAnalyzing(true)
    setAnalysis(null)
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      setAnalysis({ error: 'Clé API Anthropic manquante' })
      setAnalyzing(false)
      return
    }
    const instructionsText = await fetchScoringInstructions()
    const correctionsText = feedback.slice(0, 50).map((f) => {
      const name = getProfileName(f)
      const pd = f.profile_data || {}
      const company = pd?.company || pd?.companyName || '—'
      const orig = f.original_score ?? f.previous_score
      const corr = f.corrected_score ?? f.new_score
      return `- ${name} (${company}): ${orig} → ${corr} — ${(f.reason || f.feedback_note || '').slice(0, 150)}`
    }).join('\n')

    let systemPrompt = `Tu es un expert en scoring de prospects CGP.`
    if (instructionsText) systemPrompt += `\n\nINSTRUCTIONS PERMANENTES (règles métier) :\n${instructionsText}`
    systemPrompt += `\n\nVoici les corrections manuelles apportées au scoring :
${correctionsText}

Analyse ces corrections et réponds UNIQUEMENT en JSON valide (pas de markdown, pas de \`\`\`), avec cette structure exacte :
{
  "patterns": [
    { "signal": "description du signal manqué", "frequency": nombre, "suggestion": "comment améliorer le scoring" }
  ],
  "newWeights": {
    "employeur": 50,
    "titre": 30,
    "anciennete": 20,
    "bonusCGP": 20
  },
  "summary": "résumé en 2-3 phrases"
}`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: 'Analyse les corrections et retourne le JSON.' }],
        }),
      })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Réponse invalide' }
      setAnalysis(parsed)
    } catch (err) {
      setAnalysis({ error: err?.message })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleApply = async () => {
    if (!analysis?.newWeights) return
    setApplying(true)
    try {
      const { data: config } = await supabase.from('scoring_config').select('id').limit(1).single()
      if (config?.id) {
        await supabase.from('scoring_config').update({
          weight_employer: analysis.newWeights.employeur ?? 50,
          weight_title: analysis.newWeights.titre ?? 30,
          weight_seniority: analysis.newWeights.anciennete ?? 20,
          bonus_cgp_experience: analysis.newWeights.bonusCGP ?? 20,
          updated_at: new Date().toISOString(),
          updated_by: 'Baptiste',
        }).eq('id', config.id)
        await loadScoringConfig()
      }
      setAnalysis((prev) => ({ ...prev, applied: true }))
    } catch (err) {
      setAnalysis((prev) => ({ ...prev, error: err?.message }))
    } finally {
      setApplying(false)
    }
  }

  const fmt = (s) => (s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
  const fmtModal = (s) => (s ? new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

  const cardStyle = { background: '#ffffff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.07)', padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }

  return (
    <div className="page h-full overflow-y-auto" style={{ color: 'var(--text)', background: '#F5F0E8' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>
        <button type="button" onClick={() => navigate('/admin/console')} className="text-[13px] text-[var(--t3)] hover:text-[var(--accent)] mb-4 block">← Retour</button>
        <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 24, color: ACCENT, margin: '0 0 4px 0' }}>Apprentissage Scoring</h1>
        <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Affinez les critères de scoring au fil du temps</p>

      {/* Instructions permanentes */}
      <div style={cardStyle}>
        <div className="text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-2">Instructions permanentes pour le scoring</div>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={INSTRUCTIONS_PLACEHOLDER}
          disabled={!instructionsLoaded}
          maxLength={2000}
          rows={4}
          className="w-full mb-3 resize-y"
          style={{ maxWidth: '100%', minHeight: 96, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', padding: '12px 14px', fontSize: 14 }}
        />
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <button
            type="button"
            onClick={handleSaveInstructions}
            disabled={instructionsSaving || !instructionsLoaded}
            className="py-2 px-4 rounded-lg text-[13px] font-medium disabled:opacity-50"
            style={{ backgroundColor: GOLD, color: ACCENT }}
          >
            {instructionsSaving ? 'Enregistrement…' : 'Enregistrer les instructions'}
          </button>
          {saveSuccess && (
            <span className="text-[13px] font-medium" style={{ color: '#15803d' }}>Instructions enregistrées</span>
          )}
          {instructionsUpdatedAt && (
            <span className="text-[12px] text-[var(--t3)]">Dernière modification : {fmt(instructionsUpdatedAt)}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[12px]">
          {instructions.trim() ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ backgroundColor: '#D4EDE1', color: '#1A7A4A', fontWeight: 600 }}>Actif</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--s2)', color: 'var(--t3)' }}>Aucune instruction</span>
          )}
          <span className="text-[var(--t3)]">Ces instructions sont injectées dans tous les appels IA du scoring</span>
          <span className="text-[var(--t3)]">{instructions.length} / 2000 caractères max</span>
        </div>
      </div>

      {topReasons.length > 0 && (
        <div style={cardStyle}>
          <div className="text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-2">Top 3 raisons de correction</div>
          <ol className="list-decimal list-inside space-y-1 text-[13px]">
            {topReasons.map(([r, n], i) => (
              <li key={i}>{r}… <span className="text-[var(--t3)]">({n}x)</span></li>
            ))}
          </ol>
        </div>
      )}

      {/* Instructions & corrections actives */}
      <div style={cardStyle}>
        <div className="py-3 border-b mb-0" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
          <span className="font-semibold text-sm">Instructions & corrections actives ({totalEntries})</span>
        </div>
        {loading ? (
          <div className="py-8 text-center text-[var(--t3)]">Chargement…</div>
        ) : feedback.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-[var(--t3)]">
            <IconEmpty />
            <span className="text-[13px]">Aucune instruction ni correction enregistrée</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[500px]">
              <thead>
                <tr style={{ backgroundColor: 'var(--s2)' }}>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Type</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Profil</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Détail</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>
                    <button type="button" onClick={() => setSortBy((s) => ({ col: 'created_at', asc: s.col === 'created_at' ? !s.asc : false }))} className="flex items-center gap-1 hover:text-[var(--accent)]">
                      Date {sortBy.col === 'created_at' && (sortBy.asc ? <IconChevronUp /> : <IconChevronDown />)}
                    </button>
                  </th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Auteur</th>
                  <th className="w-20 py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedFeedback.map((f) => {
                  const name = getProfileName(f)
                  const reason = f.reason || f.feedback_note || '—'
                  const typeLabel = f.profile_id == null ? 'Instruction' : 'Correction profil'
                  return (
                    <tr key={f.id} className="border-b cursor-pointer hover:bg-[#F8F5F1]" style={{ borderColor: 'var(--border)' }} onClick={() => openDetailModal(f)}>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold" style={{ backgroundColor: f.profile_id == null ? 'rgba(210,171,118,0.2)' : 'rgba(23,55,49,0.1)', color: f.profile_id == null ? GOLD : ACCENT }}>{typeLabel}</span>
                      </td>
                      <td className="py-2.5 px-4 text-[13.5px]">{name}</td>
                      <td className="py-2.5 px-4 text-[12px] max-w-[320px] truncate" title={reason}>{reason.length > 80 ? `${reason.slice(0, 80)}...` : reason}</td>
                      <td className="py-2.5 px-4 text-[12px]" style={{ color: 'var(--t2)' }}>{fmt(f.created_at)}</td>
                      <td className="py-2.5 px-4 text-[12px]">{f.author || '—'}</td>
                      <td className="py-2.5 px-4">
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(f); }} style={{ color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Editer">
                              <IconPencil />
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(f); }} style={{ color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Supprimer">
                              <IconTrash />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Analysis results */}
      {analysis && (
        <div style={cardStyle}>
          <h3 className="font-semibold text-sm mb-4" style={{ color: ACCENT }}>Résultats de l'analyse</h3>
          {analysis.error ? (
            <div className="text-[13px]" style={{ color: '#b91c1c' }}>{analysis.error}</div>
          ) : (
            <>
              {analysis.summary && <p className="text-[13px] mb-4">{analysis.summary}</p>}
              {analysis.patterns?.length > 0 && (
                <div className="mb-4">
                  <div className="text-[12px] font-medium text-[var(--t3)] mb-2">Patterns détectés</div>
                  <ul className="space-y-2">
                    {analysis.patterns.map((pat, i) => (
                      <li key={i} className="text-[13px] flex gap-2">
                        <span className="font-medium">({pat.frequency}x)</span>
                        <span>{pat.signal}</span>
                        {pat.suggestion && <span className="text-[var(--t3)]">— {pat.suggestion}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.newWeights && (
                <div className="mb-4">
                  <div className="text-[12px] font-medium text-[var(--t3)] mb-2">Poids suggérés</div>
                  <div className="flex gap-4 text-[13px]">
                    <span>Employeur: {analysis.newWeights.employeur}</span>
                    <span>Titre: {analysis.newWeights.titre}</span>
                    <span>Ancienneté: {analysis.newWeights.anciennete}</span>
                    <span>Bonus CGP: {analysis.newWeights.bonusCGP}</span>
                  </div>
                </div>
              )}
              {analysis.applied ? (
                <div className="text-[13px]" style={{ color: '#15803d' }}>✓ Suggestions appliquées à la config</div>
              ) : analysis.newWeights && (
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={applying}
                  className="py-2 px-4 rounded-lg text-[13px] font-medium disabled:opacity-50"
                  style={{ backgroundColor: GOLD, color: ACCENT }}
                >
                  {applying ? 'Application…' : 'Appliquer ces suggestions'}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Chat Apprentissage */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div className="py-3 px-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
          <span className="font-semibold text-sm" style={{ color: ACCENT }}>Chat Apprentissage</span>
          <span className="text-[var(--t3)] text-[12px] ml-2">— Questions uniquement sur le scoring et les critères CGP</span>
        </div>
        <div className="flex flex-col" style={{ maxHeight: 400 }}>
          <div className="flex-1 overflow-y-auto py-4 px-4 flex flex-col gap-3" style={{ maxHeight: 400 }}>
            {chatMessages.length === 0 && (
              <div className="text-[13px] text-[var(--t3)]">Posez une question sur le scoring, les critères CGP et l'affinement des règles. Ex: « Comment améliorer la détection des banques captives ? »</div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex gap-2.5 max-w-[85%] items-start ${m.role === 'u' ? 'flex-row-reverse self-end' : ''}`}>
                <div className={`w-[28px] h-[28px] rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${m.role === 'ai' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--s2)] text-[var(--t2)]'}`}>{m.role === 'ai' ? 'IA' : 'Vous'}</div>
                <div className={`py-2 px-3 rounded-xl text-[13px] ${m.role === 'ai' ? 'bg-[var(--s2)] border' : 'bg-[var(--accent)] text-white'}`} style={m.role === 'ai' ? { borderColor: 'var(--border)' } : {}}>
                  {typeof m.content === 'string' && m.content.includes('<') ? <span dangerouslySetInnerHTML={{ __html: m.content }} /> : m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-2.5 items-start">
                <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-[var(--accent)] text-white">IA</div>
                <div className="py-2 px-3 rounded-xl text-[13px] text-[var(--t3)]">…</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="py-3 px-4 border-t flex gap-2 items-end shrink-0" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}>
            <textarea
              className="flex-1 border rounded-lg py-2 px-3 text-[13px] resize-none outline-none max-h-[100px]"
              style={{ borderColor: 'var(--border)' }}
              placeholder="Question sur le scoring CGP…"
              rows={2}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleChatSend())}
              disabled={chatLoading}
            />
            <button type="button" onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()} className="py-2 px-4 rounded-lg text-[13px] font-medium shrink-0" style={{ backgroundColor: ACCENT, color: 'white' }}>Envoyer</button>
          </div>
        </div>
      </div>

      </div>

      {/* Modale détail / édition */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={closeDetailModal}>
          <div className="rounded-xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" style={{ backgroundColor: '#F5F0E8', borderColor: 'var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between py-3 px-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
              <span className="font-semibold text-sm" style={{ color: ACCENT }}>Détail</span>
              <button type="button" onClick={closeDetailModal} className="p-1.5 rounded-lg hover:bg-[var(--s2)]" style={{ color: 'var(--t2)' }}><IconX /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(() => {
                const f = detailModal.data
                const name = getProfileName(f)
                const typeLabel = f.profile_id == null ? 'Instruction' : 'Correction profil'
                const orig = f.original_score ?? f.previous_score
                const corr = f.corrected_score ?? f.new_score
                return (
                  <>
                    <div><span className="text-[11px] uppercase text-[var(--t3)]">Type</span><div className="mt-0.5"><span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold" style={{ backgroundColor: f.profile_id == null ? 'rgba(210,171,118,0.2)' : 'rgba(23,55,49,0.1)', color: f.profile_id == null ? GOLD : ACCENT }}>{typeLabel}</span></div></div>
                    <div><span className="text-[11px] uppercase text-[var(--t3)]">Profil</span><div className="text-[13px] mt-0.5">{name}</div></div>
                    <div><span className="text-[11px] uppercase text-[var(--t3)]">Auteur</span><div className="text-[13px] mt-0.5">{f.author || '—'}</div></div>
                    <div><span className="text-[11px] uppercase text-[var(--t3)]">Date et heure</span><div className="text-[13px] mt-0.5">{fmtModal(f.created_at)}</div></div>
                    <div>
                      <span className="text-[11px] uppercase text-[var(--t3)]">Détail complet</span>
                      {detailEditing ? (
                        <textarea value={detailEditReason} onChange={(e) => setDetailEditReason(e.target.value)} rows={4} className="mt-1 w-full rounded border px-3 py-2 text-[13px] resize-none" style={{ borderColor: 'var(--border)' }} />
                      ) : (
                        <div className="text-[13px] mt-0.5 whitespace-pre-wrap">{(f.reason || f.feedback_note || '—')}</div>
                      )}
                    </div>
                    {orig != null && <div><span className="text-[11px] uppercase text-[var(--t3)]">Score initial</span><div className="text-[13px] mt-0.5">{orig}</div></div>}
                    {corr != null && (
                      <div>
                        <span className="text-[11px] uppercase text-[var(--t3)]">Score corrigé</span>
                        {detailEditing ? (
                          <input type="number" value={detailEditScore} onChange={(e) => setDetailEditScore(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-[13px]" style={{ borderColor: 'var(--border)' }} />
                        ) : (
                          <div className="text-[13px] mt-0.5 font-medium" style={{ color: ACCENT }}>{corr}</div>
                        )}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
            <div className="py-3 px-4 border-t flex items-center justify-end gap-2 shrink-0" style={{ borderColor: 'var(--border)' }}>
              {isAdmin && detailEditing && (
                <>
                  <button type="button" onClick={() => { setDetailEditing(false); setDetailEditScore(String(detailModal.data.corrected_score ?? detailModal.data.new_score ?? '')); setDetailEditReason(detailModal.data.reason || detailModal.data.feedback_note || '') }} className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-[13px] font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--t2)' }}><IconX /> Annuler</button>
                  <button type="button" onClick={handleDetailSave} disabled={detailSaving} className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-[13px] font-medium disabled:opacity-50" style={{ backgroundColor: GOLD, color: ACCENT }}><IconCheck /> {detailSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
                </>
              )}
              {isAdmin && !detailEditing && (
                <>
                  <button type="button" onClick={() => handleEdit(detailModal.data)} className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-[13px] font-medium" style={{ backgroundColor: 'var(--s2)', color: 'var(--t2)' }}><IconPencil /> Editer</button>
                  <button type="button" onClick={() => handleDelete(detailModal.data)} className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-[13px] font-medium" style={{ backgroundColor: '#FEE2E2', color: '#b91c1c' }}><IconTrash /> Supprimer</button>
                </>
              )}
              {!isAdmin && (
                <button type="button" onClick={closeDetailModal} className="py-2 px-3 rounded-lg text-[13px] font-medium" style={{ backgroundColor: 'var(--s2)', color: 'var(--t2)' }}>Fermer</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modale confirmation action (éditer / supprimer) */}
      {confirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={closeConfirmModal}>
          <div className="rounded-xl border shadow-xl w-full max-w-md p-5" style={{ backgroundColor: '#F5F0E8', borderColor: 'var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center mb-4">
              <span className="mb-3"><IconWarning /></span>
              <p className="text-[14px] font-medium mb-1">Action irréversible</p>
              <p className="text-[13px] text-[var(--t2)]">
                {confirmModal.type === 'edit'
                  ? 'Modifier cette instruction peut changer le comportement du scoring IA pour tous les futurs imports. Confirmez votre mot de passe pour continuer.'
                  : 'Supprimer cette instruction peut changer le comportement du scoring IA pour tous les futurs imports. Cette action est irréversible. Confirmez votre mot de passe pour continuer.'}
              </p>
            </div>
            <label className="block text-[12px] font-medium text-[var(--t3)] mb-1">Votre mot de passe</label>
            <input type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError('') }} placeholder="Mot de passe" className="w-full rounded-lg border px-3 py-2.5 text-[13px] mb-3" style={{ borderColor: 'var(--border)' }} />
            {confirmError && <p className="text-[13px] mb-3" style={{ color: '#b91c1c' }}>{confirmError}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={closeConfirmModal} className="py-2 px-3 rounded-lg text-[13px] font-medium" style={{ backgroundColor: 'var(--s2)', color: 'var(--t2)' }}>Annuler</button>
              <button type="button" onClick={handleConfirmAction} disabled={confirmLoading || !confirmPassword} className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-[13px] font-medium disabled:opacity-50" style={{ backgroundColor: ACCENT, color: 'white' }}>{confirmLoading ? 'Vérification…' : 'Confirmer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
