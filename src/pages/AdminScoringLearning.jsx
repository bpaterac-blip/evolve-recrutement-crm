import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { loadScoringConfig } from '../lib/scoringConfig'
import { fetchScoringInstructions, onScoringFeedbackUpdated, notifyScoringFeedbackUpdated } from '../lib/scoringInstructions'
import { consolidateLearning } from '../lib/consolidation'

const ACCENT = '#173731'
const GOLD = '#D2AB76'

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

const IconDocumentGreen = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
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

const NEW_INSTRUCTION_PLACEHOLDER =
  'Décrivez une règle de scoring à apprendre...\nEx: Les banques régionales comme Banque Courtois doivent être notées comme des banques de réseau'

export default function AdminScoringLearning() {
  const navigate = useNavigate()
  const { user, userProfile, role } = useAuth()
  const isAdmin = role === 'admin'
  const [feedback, setFeedback] = useState([])
  const [instructionRows, setInstructionRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [applying, setApplying] = useState(false)
  const [newInstructionText, setNewInstructionText] = useState('')
  const [instructionsSaving, setInstructionsSaving] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)
  const [detailModal, setDetailModal] = useState(null)
  const [detailEditing, setDetailEditing] = useState(false)
  const [detailEditScore, setDetailEditScore] = useState('')
  const [detailEditReason, setDetailEditReason] = useState('')
  const [detailEditInstructionContent, setDetailEditInstructionContent] = useState('')
  const [detailSaving, setDetailSaving] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [consolidating, setConsolidating] = useState(false)
  const consolidationLockRef = useRef(false)
  const prevUnconsolidatedRef = useRef(-1)

  const load = async () => {
    setLoading(true)
    const { data: allFeedbacks } = await supabase
      .from('scoring_feedback')
      .select('*')
      .order('created_at', { ascending: false })
    const { data: ins } = await supabase
      .from('scoring_instructions')
      .select('id, content, updated_at, updated_by, auto_generated')
      .order('updated_at', { ascending: false })
    setFeedback(allFeedbacks || [])
    setInstructionRows(ins || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    return onScoringFeedbackUpdated(() => load())
  }, [])

  const unconsolidatedCount = useMemo(
    () => (feedback || []).filter((f) => f.consolidated !== true).length,
    [feedback],
  )

  const runConsolidation = useCallback(
    async (forceManual) => {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
      if (!apiKey) {
        if (forceManual) window.alert('Clé API Anthropic manquante (VITE_ANTHROPIC_API_KEY).')
        return
      }
      const n = (feedback || []).filter((f) => f.consolidated !== true).length
      if (forceManual) {
        if (n < 3) {
          window.alert(`Il faut au moins 3 corrections non consolidées (actuellement ${n}).`)
          return
        }
      } else if (n < 3) return
      if (consolidationLockRef.current) return
      consolidationLockRef.current = true
      setConsolidating(true)
      try {
        await consolidateLearning(supabase, apiKey)
        notifyScoringFeedbackUpdated()
        await load()
      } catch (e) {
        console.error(e)
      } finally {
        consolidationLockRef.current = false
        setConsolidating(false)
      }
    },
    [feedback],
  )

  useEffect(() => {
    if (loading) return
    const n = unconsolidatedCount
    const prev = prevUnconsolidatedRef.current
    prevUnconsolidatedRef.current = n
    if (prev === -1) {
      if (n >= 3) void runConsolidation(false)
      return
    }
    if (n >= 3 && prev < 3) void runConsolidation(false)
  }, [loading, unconsolidatedCount, runConsolidation])

  useEffect(() => {
    const ch = supabase
      .channel('admin_scoring_feedback_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scoring_feedback' },
        () => {
          void load()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [])

  const handleInsertInstruction = async () => {
    const text = newInstructionText.trim()
    if (!text || instructionsSaving) return
    setInstructionsSaving(true)
    try {
      const author = userProfile?.full_name?.trim() || user?.email || 'Baptiste'
      const { error } = await supabase.from('scoring_instructions').insert({
        content: text,
        updated_at: new Date().toISOString(),
        updated_by: author,
        auto_generated: false,
      })
      if (error) throw error
      notifyScoringFeedbackUpdated()
      setNewInstructionText('')
      await load()
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
      const instructionsContenu = (await fetchScoringInstructions()) || 'Aucune instruction enregistrée.'
      const feedbackPourResume = feedback.filter(
        (f) =>
          !(
            f.profile_id == null &&
            (f.original_score == null || f.original_score === undefined) &&
            (f.corrected_score == null || f.corrected_score === undefined)
          ),
      )
      const feedbackResume =
        feedbackPourResume.slice(0, 10).map((f) => {
          const name = getProfileName(f)
          const pd = f.profile_data || {}
          const company = pd?.company || pd?.companyName || '—'
          const orig = f.original_score ?? f.previous_score
          const corr = f.corrected_score ?? f.new_score
          return `- ${name} (${company}): ${orig} → ${corr} — ${(f.reason || f.feedback_note || '').slice(0, 100)}`
        }).join('\n') || 'Aucune correction enregistrée.'
      const systemPrompt = `Tu es un expert en scoring de prospects CGP pour Evolve, 
un réseau de conseillers en gestion de patrimoine indépendants couvrant toute la France.

GRILLE DE SCORING COMPLÈTE (100 pts max) :

EMPLOYEUR (35 pts) :
- Banque de réseau / Assurance captive = 35 pts
  (BNP, Crédit Agricole, Société Générale, LCL, CIC, Banque Populaire, 
  Caisse d'Épargne, HSBC, Allianz, AXA, Generali, CNP, Carac, MACSF, 
  Banque de Savoie, CCF, etc.)
- Réseau semi-captif = 18 pts
  (Laplace, UFF, etc.)
- Cabinet CGP indépendant = 5 pts
- Hors secteur = 0 pts
- EXCLUS (plafonné à 15 pts) : IGC, INOVEA, Stellium, Prodemial, CapFinances

POSTE (35 pts) :
- CGP / Wealth Manager / Banquier Privé / Conseiller Patrimonial = 35 pts
- Conseiller financier / Directeur agence = 22 pts
- Conseiller clientèle = 10 pts
- Indépendant / alternant = plafonné

ANCIENNETÉ (15 pts) :
- 5-10 ans = 15 pts
- 3-5 ans ou 10-15 ans = 10 pts
- 1-3 ans = 6 pts
- < 1 an = 0 pts

PARCOURS (15 pts) :
- Expérience passée en cabinet CGP indépendant = bonus

SEUILS :
- ≥ 70 = Prioritaire
- 45-69 = À travailler  
- < 45 = À écarter

INSTRUCTIONS PERSONNALISÉES ACTIVES :
${instructionsContenu}

CORRECTIONS RÉCENTES :
${feedbackResume}

Réponds en français, de façon concise et constructive. 
Tu peux suggérer des ajustements à la grille si pertinent.`
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

  const unifiedRows = useMemo(() => {
    const rows = []
    ;(feedback || []).forEach((f) => rows.push({ kind: 'scoring', data: f, sortKey: f.created_at }))
    ;(instructionRows || [])
      .filter((i) => (i.content || '').trim())
      .forEach((i) => rows.push({ kind: 'instruction', data: i, sortKey: i.updated_at }))
    return rows.sort((a, b) => new Date(b.sortKey) - new Date(a.sortKey))
  }, [feedback, instructionRows])

  const totalEntries = unifiedRows.length

  const openDetailModal = (row) => {
    if (!row?.data) return
    setDetailModal({ kind: row.kind, data: row.data })
    if (row.kind === 'scoring') {
      const item = row.data
      const score = item.corrected_score ?? item.new_score
      setDetailEditScore(String(score ?? ''))
      setDetailEditReason(item.reason || item.feedback_note || '')
    }
    if (row.kind === 'instruction') {
      setDetailEditInstructionContent(row.data.content || '')
    }
    setDetailEditing(false)
  }

  const handleEdit = (row) => {
    setConfirmModal({ type: 'edit', row, fromDetail: !!detailModal })
  }

  const handleDelete = (row) => {
    setConfirmModal({ type: 'delete', row })
    setDetailModal(null)
  }

  const closeDetailModal = () => {
    setDetailModal(null)
    setDetailEditing(false)
    setDetailSaving(false)
    setDetailEditInstructionContent('')
  }

  const handleDetailSave = async () => {
    if (!detailModal?.data || detailSaving) return
    setDetailSaving(true)
    try {
      if (detailModal.kind === 'instruction') {
        const author = userProfile?.full_name?.trim() || user?.email || 'Baptiste'
        const { error } = await supabase
          .from('scoring_instructions')
          .update({
            content: detailEditInstructionContent.trim(),
            updated_at: new Date().toISOString(),
            updated_by: author,
          })
          .eq('id', detailModal.data.id)
        if (error) throw error
        notifyScoringFeedbackUpdated()
        await load()
        closeDetailModal()
        return
      }
      if (detailModal.kind === 'scoring') {
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
      }
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
        if (confirmModal.row.kind === 'instruction') {
          await supabase.from('scoring_instructions').delete().eq('id', confirmModal.row.data.id)
        } else {
          await supabase.from('scoring_feedback').delete().eq('id', confirmModal.row.data.id)
        }
        notifyScoringFeedbackUpdated()
        await load()
        closeConfirmModal()
      } else {
        closeConfirmModal()
        const { row } = confirmModal
        if (row.kind === 'instruction') {
          setDetailModal({ kind: 'instruction', data: row.data })
          setDetailEditInstructionContent(row.data.content || '')
          setDetailEditing(true)
        } else if (row.kind === 'scoring') {
          if (confirmModal.fromDetail && detailModal?.data?.id === row.data.id) {
            setDetailEditing(true)
          } else {
            openDetailModal(row)
            setDetailEditing(true)
          }
        }
      }
    } catch (err) {
      setConfirmError('Mot de passe incorrect')
    } finally {
      setConfirmLoading(false)
    }
  }

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

  const fmt = (s) => {
    if (!s) return '—'
    const d = new Date(s)
    const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return `${date} · ${time}`
  }
  const fmtModal = (s) => (s ? new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

  const abbreviateAuthor = (a) => {
    if (!a || typeof a !== 'string') return '—'
    const trimmed = a.trim()
    if (trimmed.includes('@')) return (trimmed.split('@')[0] || trimmed).slice(0, 12)
    const parts = trimmed.split(/\s+/)
    if (parts.length >= 2) {
      const first = parts[0]
      const last = parts[parts.length - 1]
      return `${first} ${last[0]}.`
    }
    return trimmed.length > 12 ? `${trimmed.slice(0, 12)}…` : trimmed
  }

  const cardStyle = { background: '#ffffff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.07)', padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }

  return (
    <div className="page h-full overflow-y-auto" style={{ color: 'var(--text)', background: '#F5F0E8' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        <button type="button" onClick={() => navigate('/admin/console')} className="text-[13px] text-[var(--t3)] hover:text-[var(--accent)] mb-4 block">← Retour</button>
        <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 24, color: ACCENT, margin: '0 0 4px 0' }}>Apprentissage Scoring</h1>
        <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Affinez les critères de scoring au fil du temps</p>
        {consolidating && (
          <div className="text-[13px] font-medium mb-3 px-3 py-2 rounded-lg" style={{ background: '#F3E8FF', color: '#6B21A8', border: '1px solid #C4B5FD' }}>
            Consolidation en cours…
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-[12px] text-[var(--t3)]">Corrections non consolidées : {unconsolidatedCount}</span>
          <button
            type="button"
            onClick={() => runConsolidation(true)}
            disabled={consolidating || unconsolidatedCount < 3}
            className="py-1.5 px-3 rounded-lg text-[12px] font-medium disabled:opacity-50 border"
            style={{ borderColor: ACCENT, color: ACCENT, background: 'transparent' }}
          >
            Consolider maintenant
          </button>
        </div>

      {/* Instructions permanentes */}
      <div style={cardStyle}>
        <div className="flex items-center gap-3 mb-4" style={{ paddingBottom: 12, borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#D4EDE1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconDocumentGreen />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[13px]" style={{ color: 'var(--text)' }}>Instructions permanentes</div>
            <div className="text-[11px] text-[var(--t3)] mt-1">Chaque enregistrement est une règle distincte pour le scoring IA.</div>
          </div>
        </div>
        <textarea
          value={newInstructionText}
          onChange={(e) => setNewInstructionText(e.target.value)}
          placeholder={NEW_INSTRUCTION_PLACEHOLDER}
          maxLength={2000}
          rows={6}
          disabled={instructionsSaving}
          className="w-full rounded-lg border px-3 py-2.5 text-[13px] resize-y mb-4"
          style={{ borderColor: 'var(--border)', minHeight: 120 }}
        />
        <button
          type="button"
          onClick={handleInsertInstruction}
          disabled={instructionsSaving || !newInstructionText.trim()}
          className="py-2 px-4 rounded-lg text-[13px] font-medium disabled:opacity-50"
          style={{ backgroundColor: '#173731', color: '#E7E0D0', border: 'none' }}
        >
          {instructionsSaving ? 'Enregistrement…' : 'Enregistrer l\'instruction'}
        </button>
      </div>

      {/* Chat apprentissage — avant le tableau */}
      <div style={{ ...cardStyle, minHeight: 200 }}>
        <div className="flex items-center gap-2 mb-3" style={{ paddingBottom: 12, borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </div>
          <span className="font-semibold text-[13px]" style={{ color: 'var(--text)' }}>Chat apprentissage</span>
        </div>
        <div className="text-[12px] text-[var(--t3)] mb-3">Ex: « Comment améliorer la détection des banques captives ? »</div>
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          <div className="flex-1 overflow-y-auto py-4 px-0 flex flex-col gap-3" style={{ maxHeight: 280 }}>
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
          <div className="flex gap-2 items-center mt-3 shrink-0">
            <input
              type="text"
              className="flex-1 border rounded-lg py-2 px-3 text-[13px] outline-none"
              style={{ borderColor: 'var(--border)' }}
              placeholder="Question sur le scoring CGP…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleChatSend())}
              disabled={chatLoading}
            />
            <button type="button" onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()} className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-50" style={{ backgroundColor: '#173731', color: '#E7E0D0', border: 'none' }}>→</button>
          </div>
        </div>
      </div>

      {/* Historique unifié */}
      <div style={cardStyle}>
        <div className="py-3 border-b mb-0" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
          <span className="font-semibold text-sm">Historique ({totalEntries})</span>
        </div>
        {loading ? (
          <div className="py-8 text-center text-[var(--t3)]">Chargement…</div>
        ) : unifiedRows.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-[var(--t3)]">
            <IconEmpty />
            <span className="text-[13px]">Aucune instruction ni correction enregistrée</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '38%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: 88 }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: 'var(--s2)' }}>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Type</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Détail</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Date</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Auteur</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {unifiedRows.map((row) => {
                  const badgeInstruction = { backgroundColor: '#FAEEDA', color: '#BA7517', border: '1px solid #FAC775' }
                  const badgeIaConsolidated = { backgroundColor: '#F3E8FF', color: '#6B21A8', border: '1px solid #C4B5FD' }
                  const badgeScoring = { backgroundColor: '#E6F1FB', color: '#185FA5', border: '1px solid #B5D4F4' }
                  if (row.kind === 'instruction') {
                    const i = row.data
                    const detailText = (i.content || '—').trim()
                    const rowKey = `ins-${i.id}`
                    const iaRule = i.auto_generated === true
                    return (
                      <tr key={rowKey} className="border-b cursor-pointer hover:bg-[#F8F5F1]" style={{ borderColor: 'var(--border)' }} onClick={() => openDetailModal(row)}>
                        <td className="py-2.5 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold" style={iaRule ? badgeIaConsolidated : badgeInstruction}>
                            {iaRule ? 'Règle IA consolidée' : 'Instruction'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-[12px] truncate" title={detailText}>{detailText.length > 120 ? `${detailText.slice(0, 120)}…` : detailText}</td>
                        <td className="py-2.5 px-4 text-[12px]" style={{ color: 'var(--t2)' }}>{fmt(i.updated_at)}</td>
                        <td className="py-2.5 px-4 text-[12px]">{abbreviateAuthor(i.updated_by)}</td>
                        <td className="py-2.5 px-4">
                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(row); }} style={{ color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Editer">
                                <IconPencil />
                              </button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(row); }} style={{ color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Supprimer">
                                <IconTrash />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  }
                  const f = row.data
                  const orig = f.original_score ?? f.previous_score
                  const corr = f.corrected_score ?? f.new_score
                  const reason = (f.reason || f.feedback_note || '').trim()
                  const isScoringRow = f.original_score != null
                  const reasonTrunc = reason.length > 120 ? `${reason.slice(0, 120)}…` : reason
                  const detailText = isScoringRow
                    ? `Score ${orig ?? '—'} → ${corr ?? '—'}${reason ? ` · ${reasonTrunc}` : ''}`
                    : reason || '—'
                  const detailTitle = isScoringRow
                    ? `Score ${orig ?? '—'} → ${corr ?? '—'}${reason ? ` · ${reason}` : ''}`
                    : reason || '—'
                  const rowKey = `fb-${f.id}`
                  return (
                    <tr key={rowKey} className="border-b cursor-pointer hover:bg-[#F8F5F1]" style={{ borderColor: 'var(--border)' }} onClick={() => openDetailModal(row)}>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold" style={isScoringRow ? badgeScoring : badgeInstruction}>
                          {isScoringRow ? 'Scoring' : 'Instruction'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[12px] truncate" title={detailTitle}>{detailText.length > 120 ? `${detailText.slice(0, 120)}…` : detailText}</td>
                      <td className="py-2.5 px-4 text-[12px]" style={{ color: 'var(--t2)' }}>{fmt(f.created_at)}</td>
                      <td className="py-2.5 px-4 text-[12px]">{abbreviateAuthor(f.author)}</td>
                      <td className="py-2.5 px-4">
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(row); }} style={{ color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Editer">
                              <IconPencil />
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(row); }} style={{ color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Supprimer">
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
              {detailModal.kind === 'instruction' ? (() => {
                const ins = detailModal.data
                return (
                  <>
                    <div><span className="text-[11px] uppercase text-[var(--t3)]">Type</span><div className="mt-0.5"><span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold" style={ins.auto_generated ? { backgroundColor: '#F3E8FF', color: '#6B21A8', border: '1px solid #C4B5FD' } : { backgroundColor: '#FAEEDA', color: '#BA7517', border: '1px solid #FAC775' }}>{ins.auto_generated ? 'Règle IA consolidée' : 'Instruction'}</span></div></div>
                    <div><span className="text-[11px] uppercase text-[var(--t3)]">Auteur</span><div className="text-[13px] mt-0.5">{ins.updated_by || '—'}</div></div>
                    <div><span className="text-[11px] uppercase text-[var(--t3)]">Date et heure</span><div className="text-[13px] mt-0.5">{fmtModal(ins.updated_at)}</div></div>
                    <div>
                      <span className="text-[11px] uppercase text-[var(--t3)]">Contenu</span>
                      {detailEditing ? (
                        <textarea
                          value={detailEditInstructionContent}
                          onChange={(e) => setDetailEditInstructionContent(e.target.value)}
                          rows={8}
                          maxLength={2000}
                          className="mt-1 w-full rounded border px-3 py-2 text-[13px] resize-y"
                          style={{ borderColor: 'var(--border)' }}
                        />
                      ) : (
                        <div className="text-[13px] mt-0.5 whitespace-pre-wrap">{ins.content || '—'}</div>
                      )}
                    </div>
                  </>
                )
              })() : (() => {
                const f = detailModal.data
                const name = getProfileName(f)
                const orig = f.original_score ?? f.previous_score
                const corr = f.corrected_score ?? f.new_score
                return (
                  <>
                    <div><span className="text-[11px] uppercase text-[var(--t3)]">Type</span><div className="mt-0.5"><span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold" style={{ backgroundColor: '#E6F1FB', color: '#185FA5', border: '1px solid #B5D4F4' }}>Scoring</span></div></div>
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
              {isAdmin && detailModal.kind === 'instruction' && detailEditing && (
                <>
                  <button type="button" onClick={() => { setDetailEditing(false); setDetailEditInstructionContent(detailModal.data.content || '') }} className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-[13px] font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--t2)' }}><IconX /> Annuler</button>
                  <button type="button" onClick={handleDetailSave} disabled={detailSaving || !detailEditInstructionContent.trim()} className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-[13px] font-medium disabled:opacity-50" style={{ backgroundColor: GOLD, color: ACCENT }}><IconCheck /> {detailSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
                </>
              )}
              {isAdmin && detailModal.kind === 'scoring' && detailEditing && (
                <>
                  <button type="button" onClick={() => { setDetailEditing(false); setDetailEditScore(String(detailModal.data.corrected_score ?? detailModal.data.new_score ?? '')); setDetailEditReason(detailModal.data.reason || detailModal.data.feedback_note || '') }} className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-[13px] font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--t2)' }}><IconX /> Annuler</button>
                  <button type="button" onClick={handleDetailSave} disabled={detailSaving} className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-[13px] font-medium disabled:opacity-50" style={{ backgroundColor: GOLD, color: ACCENT }}><IconCheck /> {detailSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
                </>
              )}
              {isAdmin && !detailEditing && (
                <>
                  <button type="button" onClick={() => handleEdit({ kind: detailModal.kind, data: detailModal.data })} className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-[13px] font-medium" style={{ backgroundColor: 'var(--s2)', color: 'var(--t2)' }}><IconPencil /> Editer</button>
                  <button type="button" onClick={() => handleDelete({ kind: detailModal.kind, data: detailModal.data })} className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-[13px] font-medium" style={{ backgroundColor: '#FEE2E2', color: '#b91c1c' }}><IconTrash /> Supprimer</button>
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
                  ? 'Modifier cette entrée peut changer le comportement du scoring IA pour tous les futurs imports. Confirmez votre mot de passe pour continuer.'
                  : 'Supprimer cette entrée peut changer le comportement du scoring IA pour tous les futurs imports. Cette action est irréversible. Confirmez votre mot de passe pour continuer.'}
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
