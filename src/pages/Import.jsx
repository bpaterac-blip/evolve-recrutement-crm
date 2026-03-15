import { useState, useRef, Fragment, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import { parseCSV } from '../lib/csvParser'
import { extractTextFromPDF, parseLinkedInPDFText } from '../lib/pdfExtractor'
import { calculateScore, scoreProfile, getExperienceBadge } from '../lib/scoring'
import { enrichProfileWithNetrows } from '../lib/netrows'
import { supabase } from '../lib/supabase'
import { IconLink, IconDot, IconUpload } from '../components/Icons'

const IMPORT_STORAGE_KEYS = {
  profiles: 'import_profiles',
  step: 'import_step',
  filename: 'import_filename',
  enriched: 'import_enriched',
  source: 'import_source',
  enrichSummary: 'import_enrich_summary',
  includeATravailler: 'import_include_atravailler',
}

const clearImportStorage = () => {
  Object.values(IMPORT_STORAGE_KEYS).forEach((k) => sessionStorage.removeItem(k))
}

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']
const formatExperiencePeriod = (exp) => {
  const sy = exp.startYear
  const sm = exp.startMonth
  const ey = exp.endYear
  const em = exp.endMonth
  const startStr = sm ? `${MOIS[Math.min(sm - 1, 11)]} ${sy}` : String(sy || '')
  if (exp.isCurrent || !ey) {
    const years = sy ? new Date().getFullYear() - sy : 0
    return `Depuis ${startStr} (${years} an${years > 1 ? 's' : ''})`
  }
  const endStr = em ? `${MOIS[Math.min(em - 1, 11)]} ${ey}` : String(ey || '')
  const years = sy && ey ? ey - sy : 0
  return `${startStr} - ${endStr} (${years} an${years > 1 ? 's' : ''})`
}

const getCategory = (sc) => (sc >= 70 ? 'prioritaire' : sc >= 50 ? 'travailler' : 'ecarter')
const getPriorityLabel = (sc) => (sc >= 70 ? 'Prioritaire' : sc >= 50 ? 'À travailler' : 'À écarter')
const PRIORITY_OPTS = ['Contact immédiat', 'Prioritaire', 'À travailler', 'À écarter']

const CorrectedBadge = () => (
  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#F5E6C8', color: '#B8860B', fontWeight: 600 }}>✓ Corrigé par Baptiste</span>
)

const ScoreImprovementBadge = ({ p }) => {
  if (p._enrichStatus !== 'enriched' || p._scoreBeforeEnrich == null) return null
  const beforeCat = getCategory(p._scoreBeforeEnrich)
  const afterCat = getCategory(p.sc ?? 0)
  const delta = (p.sc ?? 0) - p._scoreBeforeEnrich

  if (beforeCat === 'ecarter' && afterCat === 'travailler') return <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#FFF3E0', color: '#E65100', fontWeight: 600 }}>↑ À travailler</span>
  if (beforeCat === 'ecarter' && afterCat === 'prioritaire') return <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#D4EDE1', color: '#1A7A4A', fontWeight: 600 }}>↑ Prioritaire</span>
  if (beforeCat === 'travailler' && afterCat === 'prioritaire') return <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#D4EDE1', color: '#1A7A4A', fontWeight: 600 }}>↑ Prioritaire</span>
  if (delta > 0) return <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#E5E7EB', color: '#6B7280', fontWeight: 500 }}>+{delta} pts</span>
  return null
}

const SYSTEM_PROMPT = `Tu es un expert en recrutement CGP pour Evolve Investissement. Tu analyses des profils de Conseillers en Gestion de Patrimoine captifs (banque/assurance) pour identifier les meilleurs candidats à rejoindre un réseau indépendant.

Critères de scoring :
- Employeur captif (banque/assurance) = jusqu'à 50pts
- Intitulé de poste CGP/patrimoine = jusqu'à 30pts
- Ancienneté idéale 3-7 ans = jusqu'à 20pts
- Bonus expérience passée cabinet CGP = +20pts

Réponds toujours en français, de manière concise et professionnelle.`

const buildInitialUserMessage = (p) => {
  const exps = Array.isArray(p.experiences) ? p.experiences : []
  const { score, priority, signals } = scoreProfile(p, exps)
  const expList = exps.length
    ? exps.map((e) => `  - ${e.company || '—'} : ${e.title || '—'} ${e.isCurrent ? '(actuel)' : ''}`).join('\n')
    : '  Aucune'
  const signaux = (signals && signals.length) ? signals.join(', ') : 'Aucun'
  return `Analyse ce profil et explique son score de ${score}/100 (${priority}) :
- Prénom Nom : ${p.fn || ''} ${p.ln || ''}
- Employeur actuel : ${p.co || p.company || '—'}
- Intitulé : ${p.ti || p.title || '—'}
- Expériences passées :
${expList}
- Signaux détectés : ${signaux}

Explique pourquoi ce score, ce qui joue en sa faveur, ce qui lui manque pour être prioritaire, et si tu recommandes de le contacter.`
}

const fetchLearningContext = async () => {
  const { data } = await supabase.from('scoring_feedback').select('*').order('created_at', { ascending: false }).limit(20)
  return (data || []).filter((f) => (f.reason || f.feedback_note || '').trim())
}

const buildLearningContextPrompt = (feedbacks) => {
  if (!feedbacks.length) return ''
  const lines = feedbacks.map((f) => {
    const pd = f.profile_data || {}
    const co = pd.company || pd.name || '—'
    const ti = pd.title || '—'
    return `- Profil : ${co} - ${ti}\n  Score initial : ${f.previous_score ?? '?'} → Corrigé : ${f.new_score ?? '?'}\n  Raison : ${(f.reason || f.feedback_note || '').slice(0, 200)}`
  })
  return `\n\nAPPRENTISSAGES DE TES ANALYSES PRÉCÉDENTES :\n${lines.join('\n\n')}\n\nTiens compte de ces apprentissages pour affiner ton analyse.`
}

const generateConversationSummary = async (messages, apiKey) => {
  const convText = (messages || []).filter((m) => m.content).map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Claude'}: ${m.content}`).join('\n\n')
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
      max_tokens: 150,
      messages: [{ role: 'user', content: `Résume en 2-3 phrases les points clés de cette analyse scoring CGP :\n\n${convText}\n\nFocus sur : pourquoi ce score, signaux détectés, recommandation finale.` }],
    }),
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json()
  return (data.content?.[0]?.text || '').trim().slice(0, 500)
}

const ScoringChat = ({ profile, rowKey, isExpanded, onClose, messages, onMessagesChange, showNotif, useSupabase, onProfileCorrection }) => {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [correctedScore, setCorrectedScore] = useState(profile?.sc ?? 0)
  const [priorityLabel, setPriorityLabel] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const messagesEndRef = useRef(null)
  const initialCalledRef = useRef(false)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  const callAnthropic = async (userMsg, isInitial = false) => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      showNotif('Clé API Anthropic manquante')
      return
    }
    setLoading(true)
    try {
      let systemPrompt = SYSTEM_PROMPT
      if (useSupabase) {
        const feedbacks = await fetchLearningContext()
        systemPrompt += buildLearningContextPrompt(feedbacks)
      }

      const history = (messages || []).filter((m) => m.role && m.content).map((m) => ({ role: m.role, content: m.content }))
      const allMessages = [...history, { role: 'user', content: userMsg }]

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
          max_tokens: isInitial ? 500 : 1024,
          system: systemPrompt,
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      onMessagesChange(rowKey, [...(messages || []), { role: 'user', content: userMsg }, { role: 'assistant', content: text }])
    } catch (err) {
      showNotif(`Erreur : ${err?.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return
    setInput('')
    callAnthropic(trimmed, false)
  }

  const handleSaveCorrection = async () => {
    if (!useSupabase) {
      showNotif('Supabase requis pour enregistrer')
      return
    }
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    setSaving(true)
    try {
      let reason = correctionReason.trim()
      if (apiKey && (messages || []).length > 0) {
        reason = await generateConversationSummary(messages, apiKey) || reason
      }
      if (!reason) reason = 'Correction manuelle'

      const priority = priorityLabel || getPriorityLabel(profile?.sc ?? 0)
      const profileData = !profile?.id ? { name: `${profile?.fn || ''} ${profile?.ln || ''}`.trim(), company: profile?.co, title: profile?.ti, score: profile?.sc, priority } : null

      await supabase.from('scoring_feedback').insert({
        profile_id: profile?.id || null,
        profile_data: profileData,
        previous_score: profile?.sc ?? 0,
        new_score: correctedScore,
        feedback_note: reason,
        reason,
        priority_label: priority,
        author: 'Baptiste',
      })

      onProfileCorrection?.(profile, { sc: correctedScore, _correctedByUser: true, _correctedAt: Date.now() })
      showNotif('✓ Correction enregistrée')
      setCorrectionReason('')
    } catch (err) {
      showNotif(`Erreur : ${err?.message}`)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!isExpanded) {
      initialCalledRef.current = false
      return
    }
    if (initialCalledRef.current || (messages && messages.length > 0)) return
    initialCalledRef.current = true
    callAnthropic(buildInitialUserMessage(profile), true)
  }, [isExpanded, rowKey])

  useEffect(() => {
    if (messages?.length) scrollToBottom()
  }, [messages])

  useEffect(() => {
    const lastAssistant = [...(messages || [])].reverse().find((m) => m.role === 'assistant')
    if (lastAssistant?.content && !correctionReason) {
      setCorrectionReason(lastAssistant.content.slice(0, 300))
    }
  }, [messages])

  if (!isExpanded) return null

  return (
    <div style={{ background: '#F8F5F1', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#173731' }}>💬 Explication du scoring</span>
        <button type="button" onClick={onClose} style={{ fontSize: 12, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}>Fermer</button>
      </div>
      <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 12 }}>
        {loading && (!messages || messages.length === 0) && <div style={{ fontSize: 12, color: '#6B7280' }}>Analyse en cours…</div>}
        {(messages || []).map((m, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{m.role === 'user' ? 'Vous' : 'Claude'}</div>
            <div style={{ fontSize: 13, color: '#1A1A1A', whiteSpace: 'pre-wrap' }}>{m.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Poser une question…"
          disabled={loading}
          style={{ flex: 1, minWidth: 120, padding: '8px 12px', borderRadius: 6, border: '1px solid #E5E0D8', fontSize: 12 }}
        />
        <button type="button" onClick={handleSend} disabled={loading || !input.trim()} style={{ padding: '8px 14px', borderRadius: 6, background: '#173731', color: 'white', fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer' }}>Envoyer</button>
      </div>

      <div style={{ borderTop: '1px solid #E5E0D8', paddingTop: 12, marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#173731' }}>Corriger le scoring</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <label style={{ fontSize: 11, color: '#6B7280' }}>Score que j'aurais donné (0-100)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" min={0} max={100} value={correctedScore} onChange={(e) => setCorrectedScore(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={0} max={100} value={correctedScore} onChange={(e) => setCorrectedScore(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} style={{ width: 50, padding: '4px 8px', borderRadius: 4, border: '1px solid #E5E0D8', fontSize: 12 }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#6B7280' }}>Catégorie réelle</label>
            <select value={priorityLabel} onChange={(e) => setPriorityLabel(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #E5E0D8', fontSize: 12 }}>
              <option value="">—</option>
              {PRIORITY_OPTS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#6B7280' }}>Raison</label>
            <textarea value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} rows={3} placeholder="Pourquoi ce score est inexact…" style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #E5E0D8', fontSize: 12, resize: 'vertical' }} />
          </div>
          <button type="button" onClick={handleSaveCorrection} disabled={saving} style={{ padding: '8px 16px', borderRadius: 6, background: '#D2AB76', color: '#173731', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}>{saving ? '…' : 'Enregistrer ma correction'}</button>
        </div>
      </div>
    </div>
  )
}

const ExperienceExpandBlock = ({ experiences }) => {
  const exps = Array.isArray(experiences) ? experiences : []
  if (!exps.length) return <div style={{ padding: '12px 16px', color: '#6B7280', fontSize: 12 }}>Aucune expérience</div>
  return (
    <div style={{ background: '#F5F3EF', padding: '12px 16px', borderLeft: '3px solid #173731', transition: 'opacity 0.2s ease' }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, color: '#173731' }}>Parcours professionnel</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {exps.map((exp, i) => {
          const badge = getExperienceBadge(exp)
          return (
            <div key={i} style={{ paddingBottom: 12, borderBottom: i < exps.length - 1 ? '1px solid #E5E0D8' : 'none' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{exp.company || '—'}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{exp.title || '—'}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{formatExperiencePeriod(exp)}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {badge === 'cabinet' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#D4EDE1', color: '#1A7A4A', fontWeight: 500 }}>Cabinet CGP</span>}
                {badge === 'captif' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#DBEAFE', color: '#1D4ED8', fontWeight: 500 }}>Captif</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const AV = ['avg', 'avb', 'ava', 'avp', 'avr', 'avt']
const priotag = (sc) => {
  if (sc >= 70) return <span className="pp bg-[var(--rbg)] text-[var(--red)] py-0.5 px-2 rounded-md text-[11.5px] font-medium inline-flex items-center gap-1"><span className="inline-flex"><IconDot /></span>Prioritaire</span>
  if (sc >= 50) return <span className="pm bg-[var(--abg)] text-[var(--amber)] py-0.5 px-2 rounded-md text-[11.5px] font-medium inline-flex items-center gap-1"><span className="inline-flex"><IconDot /></span>À travailler</span>
  return <span className="pl bg-[var(--s2)] text-[var(--t3)] py-0.5 px-2 rounded-md text-[11.5px] font-medium inline-flex items-center gap-1"><span className="inline-flex"><IconDot /></span>À écarter</span>
}

export default function Import() {
  const navigate = useNavigate()
  const { showNotif, addProfile, addProfilesBatch, useSupabase } = useCRM()
  const [tab, setTab] = useState('iu')
  const [parsedRows, setParsedRows] = useState([])
  const [importSource, setImportSource] = useState(null) // 'csv' | 'pdf'
  const [importFilename, setImportFilename] = useState('')
  const [restoredFromSession, setRestoredFromSession] = useState(false)
  const hasClearedAfterPushRef = useRef(false)
  const [loading, setLoading] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [includeATravailler, setIncludeATravailler] = useState(false)
  const [ecarteExpanded, setEcarteExpanded] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [enrichedCount, setEnrichedCount] = useState(0)
  const [enrichTotal, setEnrichTotal] = useState(0)
  const [enrichSummary, setEnrichSummary] = useState(null) // { enriched, failed, noLinkedIn }
  const [expandedRowKey, setExpandedRowKey] = useState(null) // 'prior-0' | 'work-1' | 'ecarte-2'
  const [expandedChatKey, setExpandedChatKey] = useState(null)
  const [chatHistory, setChatHistory] = useState({}) // { [rowKey]: [{ role, content }] }
  const csvInputRef = useRef(null)
  const pdfInputRef = useRef(null)

  const scpill = (s) => s >= 70 ? 'sh' : s >= 50 ? 'sm2' : 'sl'
  const ini = (a, b) => (a?.[0] || '') + (b?.[0] || '')

  useEffect(() => {
    const saved = sessionStorage.getItem(IMPORT_STORAGE_KEYS.profiles)
    const savedStep = sessionStorage.getItem(IMPORT_STORAGE_KEYS.step)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        setParsedRows(Array.isArray(data) ? data : [])
        setTab(savedStep || 'im')
        setImportSource(sessionStorage.getItem(IMPORT_STORAGE_KEYS.source) || 'csv')
        setImportFilename(sessionStorage.getItem(IMPORT_STORAGE_KEYS.filename) || '')
        const inc = sessionStorage.getItem(IMPORT_STORAGE_KEYS.includeATravailler)
        setIncludeATravailler(inc === 'true')
        const sum = sessionStorage.getItem(IMPORT_STORAGE_KEYS.enrichSummary)
        setEnrichSummary(sum ? JSON.parse(sum) : null)
        setRestoredFromSession(true)
      } catch {
        clearImportStorage()
      }
    }
  }, [])

  useEffect(() => {
    if (!useSupabase || tab !== 'im') return
    const load = async () => {
      const { data: fb } = await supabase.from('scoring_feedback').select('profile_data, previous_score').limit(500)
      const companies = {}
      ;(fb || []).forEach((f) => {
        const co = ((f.profile_data?.company || f.profile_data?.name || '')?.trim() || 'Inconnu').slice(0, 50)
        companies[co] = (companies[co] || 0) + 1
      })
      const topCompanies = Object.entries(companies).sort((a, b) => b[1] - a[1]).slice(0, 3)
      const { data: cfg } = await supabase.from('scoring_config').select('updated_at').limit(1).single()
      setLearningStats({ total: (fb || []).length, topCompanies, configUpdatedAt: cfg?.updated_at })
    }
    load()
  }, [useSupabase, tab, learningRefresh])

  useEffect(() => {
    if (parsedRows.length === 0 || hasClearedAfterPushRef.current) return
    sessionStorage.setItem(IMPORT_STORAGE_KEYS.profiles, JSON.stringify(parsedRows))
    sessionStorage.setItem(IMPORT_STORAGE_KEYS.step, tab)
    sessionStorage.setItem(IMPORT_STORAGE_KEYS.filename, importFilename)
    sessionStorage.setItem(IMPORT_STORAGE_KEYS.source, importSource || '')
    sessionStorage.setItem(IMPORT_STORAGE_KEYS.enriched, enrichSummary ? 'true' : 'false')
    sessionStorage.setItem(IMPORT_STORAGE_KEYS.includeATravailler, String(includeATravailler))
    if (enrichSummary) sessionStorage.setItem(IMPORT_STORAGE_KEYS.enrichSummary, JSON.stringify(enrichSummary))
  }, [parsedRows, tab, importFilename, importSource, enrichSummary, includeATravailler])

  const handleClearAndRestart = () => {
    clearImportStorage()
    setParsedRows([])
    setTab('iu')
    setImportSource(null)
    setImportFilename('')
    setEnrichSummary(null)
    setRestoredFromSession(false)
    setExpandedRowKey(null)
    setExpandedChatKey(null)
    setChatHistory({})
    showNotif('Import effacé — vous pouvez recommencer')
  }

  const handleCSVFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setRestoredFromSession(false)
    hasClearedAfterPushRef.current = false
    try {
      const rows = await parseCSV(file)
      const withScores = rows.map((r) => {
        const sc = calculateScore(r)
        return { ...r, sc }
      })
      setParsedRows(withScores)
      setImportSource('csv')
      setImportFilename(file.name || '')
      setTab('im')
      showNotif(`✓ ${withScores.length} profils détectés dans le CSV`)
    } catch (err) {
      showNotif(`Erreur CSV : ${err?.message}`)
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const handlePDFFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setRestoredFromSession(false)
    hasClearedAfterPushRef.current = false
    try {
      const text = await extractTextFromPDF(file)
      const parsed = parseLinkedInPDFText(text)
      const sc = calculateScore(parsed)
      setParsedRows([{ ...parsed, sc }])
      setImportSource('pdf')
      setImportFilename(file.name || '')
      setTab('im')
      showNotif('📑 PDF analysé — 1 profil extrait ✓')
    } catch (err) {
      showNotif(`Erreur PDF : ${err?.message}`)
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const priorRows = parsedRows.filter((r) => (r.sc || 0) >= 70)
  const workRows = parsedRows.filter((r) => (r.sc || 0) >= 50 && (r.sc || 0) < 70)
  const ecarteRows = parsedRows.filter((r) => (r.sc || 0) < 50)
  const rowsToPush = includeATravailler ? [...priorRows, ...workRows] : priorRows

  const pushToCRM = async () => {
    if (!rowsToPush.length) return
    setPushing(true)
    try {
      if (useSupabase) {
        const n = await addProfilesBatch(rowsToPush)
        showNotif(`✓ ${n} profils ajoutés au CRM`)
      } else {
        for (const p of rowsToPush) {
          await addProfile(p)
        }
        showNotif(`✓ ${rowsToPush.length} profils ajoutés au CRM`)
      }
      hasClearedAfterPushRef.current = true
      clearImportStorage()
      setTab('is')
    } catch (err) {
      showNotif(`Erreur : ${err?.message}`)
    } finally {
      setPushing(false)
    }
  }

  const hasValidLinkedIn = (p) => {
    const li = (p.li || p.linkedinUrl || '').trim()
    return li && li !== '—' && (li.startsWith('http') || li.includes('linkedin.com'))
  }

  const profilesWithLinkedIn = parsedRows.filter(hasValidLinkedIn)
  const netrowsCount = profilesWithLinkedIn.length

  const handleEnrichWithNetrows = async () => {
    if (!netrowsCount) return
    if (!useSupabase) {
      showNotif('Enrichissement Netrows nécessite Supabase (Edge Function)')
      return
    }
    setEnriching(true)
    setEnrichedCount(0)
    setEnrichTotal(netrowsCount)
    setEnrichSummary(null)
    let enriched = 0
    let failed = 0
    let noLinkedIn = parsedRows.length - netrowsCount
    const updatedRows = [...parsedRows]

    for (let i = 0; i < parsedRows.length; i++) {
      const p = parsedRows[i]
      const li = (p.li || p.linkedinUrl || '').trim()
      if (!li || li === '—' || !li.includes('linkedin')) {
        if (updatedRows[i]) updatedRows[i] = { ...updatedRows[i], _enrichStatus: 'Sans LinkedIn' }
        continue
      }
      try {
        const data = await enrichProfileWithNetrows(li)
        const experiences = data.experiences || []
        const prevScore = p.sc ?? calculateScore(p)
        const { score: newScore } = scoreProfile(updatedRows[i], experiences)
        updatedRows[i] = {
          ...updatedRows[i],
          experiences,
          sc: newScore,
          _enrichStatus: 'enriched',
          _scoreBeforeEnrich: prevScore,
        }
        enriched++
      } catch (err) {
        if (updatedRows[i]) updatedRows[i] = { ...updatedRows[i], _enrichStatus: 'Enrichissement échoué' }
        failed++
      }
      setEnrichedCount(enriched + failed)
      await new Promise((r) => setTimeout(r, 500))
    }

    setParsedRows(updatedRows)
    setEnrichSummary({ enriched, failed, noLinkedIn })
    setEnriching(false)
    showNotif(`✓ Enrichissement terminé : ${enriched} enrichis, ${failed} échoués`)
  }

  const handleChatMessagesChange = (key, newMessages) => {
    setChatHistory((prev) => ({ ...prev, [key]: newMessages }))
  }

  const [learningRefresh, setLearningRefresh] = useState(0)
  const handleProfileCorrection = (profile, updates) => {
    setParsedRows((prev) => prev.map((p) => {
      const match = p.fn === profile?.fn && p.ln === profile?.ln && (p.co === profile?.co || p.company === profile?.co)
      return match ? { ...p, ...updates } : p
    }))
    setLearningRefresh((r) => r + 1)
  }

  const priorCount = priorRows.length
  const workCount = workRows.length
  const avgScore = parsedRows.length ? Math.round(parsedRows.reduce((a, r) => a + (r.sc || 0), 0) / parsedRows.length) : 0

  return (
    <div className="page h-full overflow-y-auto p-[22px]">
      <div className="font-serif text-[22px] mb-1">Import & Scoring</div>
      <div className="text-[13px] text-[var(--t3)] mb-5">CSV Sales Navigator ou PDF LinkedIn — mappe les colonnes, lance le scoring automatique</div>
      <div className="itabs flex border-b border-[var(--border)] mb-5">
        <div className={`itab py-2.5 px-4 text-[13px] font-medium cursor-pointer border-b-2 border-transparent transition-all ${tab === 'iu' ? 'active text-[var(--accent)] border-b-[var(--accent)]' : 'text-[var(--t3)]'}`} onClick={() => setTab('iu')}>① Source</div>
        <div className={`itab py-2.5 px-4 text-[13px] font-medium cursor-pointer border-b-2 border-transparent transition-all ${tab === 'im' ? 'active text-[var(--accent)] border-b-[var(--accent)]' : 'text-[var(--t3)]'}`} onClick={() => setTab('im')}>② Résultat scoring</div>
        <div className={`itab py-2.5 px-4 text-[13px] font-medium cursor-pointer border-b-2 border-transparent transition-all ${tab === 'is' ? 'active text-[var(--accent)] border-b-[var(--accent)]' : 'text-[var(--t3)]'}`} onClick={() => setTab('is')}>③ Profils intégrés au CRM</div>
      </div>

      {restoredFromSession && parsedRows.length > 0 && (
        <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#2E7D32' }}>
            Import précédent restauré — {parsedRows.length} profil{parsedRows.length > 1 ? 's' : ''} chargé{parsedRows.length > 1 ? 's' : ''} depuis votre dernière session
          </span>
          <button
            type="button"
            onClick={handleClearAndRestart}
            style={{ padding: '6px 12px', borderRadius: 6, background: 'white', border: '1px solid #173731', color: '#173731', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
          >
            Effacer et recommencer
          </button>
        </div>
      )}

      {tab === 'iu' && (
        <>
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVFile} />
          <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePDFFile} />
          <div className="grid grid-cols-2 gap-3.5 mb-5">
            <div>
              <div className="font-semibold text-[13.5px] mb-2">📄 Import CSV Sales Navigator</div>
              <div
                className="dz border-2 border-dashed border-[var(--b2)] rounded-xl py-9 text-center cursor-pointer transition-all hover:border-[var(--accent)] hover:bg-[var(--accent)]/5"
                onClick={() => csvInputRef.current?.click()}
              >
                {loading ? <div className="text-3xl mb-2">…</div> : <div className="text-3xl mb-2">⇪</div>}
                <div className="text-sm font-semibold mb-1">Cliquer ou glisser-déposer un .csv</div>
                <div className="text-xs text-[var(--t3)]">Export Sales Navigator ou Waalaxy</div>
              </div>
              <div className="bg-[var(--s2)] rounded-lg py-2.5 px-3.5 text-xs text-[var(--t3)] mt-2">
                Formats supportés : <strong>Lemlist</strong> (firstName, lastName, email, linkedinUrl, companyName, jobTitle, location, campaigns, leadStatus, lastContactedDate) · <strong>Waalaxy</strong> (firstName, lastName, occupation, job_title, location, company_name, linkedinUrl) · <strong>Sales Navigator</strong> (First Name, Last Name, Job Title, Company Name)
              </div>
            </div>
            <div>
              <div className="font-semibold text-[13.5px] mb-2">📑 Import PDF LinkedIn</div>
              <div
                className="dz border-2 border-dashed border-[#AEC8F0] rounded-xl py-9 text-center cursor-pointer bg-[#F5F9FF] transition-all hover:border-[var(--accent)]"
                onClick={() => pdfInputRef.current?.click()}
              >
                {loading ? <div className="text-3xl mb-2">…</div> : <div className="text-3xl mb-2">📑</div>}
                <div className="text-sm font-semibold mb-1">Cliquer ou glisser-déposer un .pdf</div>
                <div className="text-xs text-[var(--t3)]">Profil LinkedIn exporté en PDF</div>
              </div>
              <div className="bg-[#EEF4FD] rounded-lg py-2.5 px-3.5 text-xs text-[#4A6FA0] mt-2">
                Extraction automatique : nom, employeur, poste, ville — puis scoring du profil.
              </div>
            </div>
          </div>
          <div className="bg-[var(--lbg)] border border-[#FFD5C0] rounded-[10px] py-3.5 px-4 flex items-center gap-3.5">
            <span className="inline-flex items-center justify-center text-[var(--lemlist)]"><IconLink /></span>
            <div>
              <div className="font-semibold text-[13.5px] text-[var(--lemlist)]">Intégration Lemlist</div>
              <div className="text-xs text-[var(--t2)] mt-0.5">Les profils poussés dans une séquence Lemlist apparaîtront automatiquement via webhook.</div>
            </div>
          </div>
        </>
      )}

      {tab === 'im' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div className="font-semibold text-[13.5px]">Résultats {importSource === 'pdf' ? 'PDF' : 'CSV'} — {parsedRows.length} profil(s) détecté(s)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={includeATravailler} onChange={(e) => setIncludeATravailler(e.target.checked)} />
                Inclure les À travailler (50-69 pts)
              </label>
              {netrowsCount > 0 && (
                <button
                  type="button"
                  onClick={handleEnrichWithNetrows}
                  disabled={enriching}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'white', color: '#173731', fontWeight: 500, fontSize: 13, border: '1px solid #173731', cursor: enriching ? 'not-allowed' : 'pointer', opacity: enriching ? 0.6 : 1 }}
                >
                  {enriching ? 'Enrichissement…' : `Enrichir via Netrows (${netrowsCount} profils)`}
                </button>
              )}
              <button
                type="button"
                onClick={pushToCRM}
                disabled={pushing || rowsToPush.length === 0}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#173731', color: 'white', fontWeight: 500, fontSize: 13, cursor: pushing || rowsToPush.length === 0 ? 'not-allowed' : 'pointer', opacity: pushing || rowsToPush.length === 0 ? 0.6 : 1 }}
              >
                {pushing ? 'En cours…' : `+ Pousser ${rowsToPush.length} profil(s) dans le CRM`}
              </button>
            </div>
          </div>

          {enriching && (
            <div style={{ background: '#F5F3EF', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>Enrichissement Netrows en cours...</span>
                <span>{enrichedCount}/{enrichTotal} profils</span>
              </div>
              <div style={{ background: '#E5E0D8', borderRadius: 4, height: 6 }}>
                <div style={{ background: '#173731', borderRadius: 4, height: 6, width: `${enrichTotal ? (enrichedCount / enrichTotal) * 100 : 0}%`, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>
                Coût estimé : {enrichTotal} × €0.005 = €{(enrichTotal * 0.005).toFixed(2)}
              </div>
            </div>
          )}

          {enrichSummary && !enriching && (
            <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 16 }}>
              {enrichSummary.enriched} profils enrichis / {enrichSummary.failed} échoués / {enrichSummary.noLinkedIn} sans LinkedIn
            </div>
          )}

          <div style={{ marginBottom: 16, background: '#D4EDE1', border: '1px solid #A8D5BA', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: '#1A7A4A' }}>Prioritaires ≥70 pts ({priorCount})</div>
            <table className="mt w-full border-collapse">
              <thead><tr>
                <th className="text-left py-2 px-3.5 bg-[#C5E6D0] text-[11.5px] uppercase tracking-wider text-[#1A7A4A] border-b border-[#A8D5BA]">Profil</th>
                <th className="text-left py-2 px-3.5 bg-[#C5E6D0] text-[11.5px] uppercase tracking-wider text-[#1A7A4A] border-b border-[#A8D5BA]">Employeur</th>
                <th className="text-left py-2 px-3.5 bg-[#C5E6D0] text-[11.5px] uppercase tracking-wider text-[#1A7A4A] border-b border-[#A8D5BA]">Intitulé</th>
                {importSource === 'pdf' && <th className="text-left py-2 px-3.5 bg-[#C5E6D0] text-[11.5px] uppercase tracking-wider text-[#1A7A4A] border-b border-[#A8D5BA]">Ancienneté</th>}
                <th className="text-left py-2 px-3.5 bg-[#C5E6D0] text-[11.5px] uppercase tracking-wider text-[#1A7A4A] border-b border-[#A8D5BA]">Score</th>
                <th className="text-left py-2 px-3.5 bg-[#C5E6D0] text-[11.5px] uppercase tracking-wider text-[#1A7A4A] border-b border-[#A8D5BA]">Priorité</th>
              </tr></thead>
              <tbody>
                {priorRows.map((p, i) => {
                  const rowKey = `prior-${i}`
                  const isExpanded = expandedRowKey === rowKey
                  const isChatExpanded = expandedChatKey === rowKey
                  const colSpan = importSource === 'pdf' ? 6 : 5
                  return (
                    <Fragment key={rowKey}>
                      <tr
                        className="border-b border-[#A8D5BA] cursor-pointer hover:bg-[#C5E6D0]/50 transition-colors"
                        onClick={() => setExpandedRowKey(isExpanded ? null : rowKey)}
                      >
                        <td className="py-2 px-3.5"><div className="pc flex items-center gap-2.5"><div className="av w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: '#D4EDE1', color: '#1A7A4A' }}>{ini(p.fn, p.ln)}</div><div className="pn font-medium">{p.fn} {p.ln}</div></div></td>
                        <td className="py-2 px-3.5 text-[12.5px]">{p.co || '—'}</td>
                        <td className="py-2 px-3.5 text-[12.5px] text-[var(--t2)]">{p.ti || '—'}</td>
                        {importSource === 'pdf' && <td className="py-2 px-3.5 text-[12.5px] text-[var(--t3)]">{p.dur || '—'}</td>}
                        <td className="py-2 px-3.5">
                          <div className="flex items-center gap-2">
                            <span className={`sc inline-flex items-center justify-center w-9 h-6 rounded-md ${scpill(p.sc)}`}>{p.sc}</span>
                            {p._correctedByUser && <CorrectedBadge />}
                            <ScoreImprovementBadge p={p} />
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setExpandedChatKey(isChatExpanded ? null : rowKey) }}
                              style={{ padding: '4px 8px', borderRadius: 6, background: 'white', border: '1px solid #173731', color: '#173731', fontSize: 12, cursor: 'pointer' }}
                            >
                              💬 Expliquer
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3.5 flex items-center gap-2">
                          {priotag(p.sc)}
                          <span style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none', fontSize: 12 }}>▾</span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={colSpan} className="p-0 align-top" style={{ borderBottom: '1px solid #A8D5BA', verticalAlign: 'top' }}>
                            <ExperienceExpandBlock experiences={p.experiences} />
                          </td>
                        </tr>
                      )}
                      {isChatExpanded && (
                        <tr>
                          <td colSpan={colSpan} className="p-0 align-top" style={{ borderBottom: '1px solid #A8D5BA', verticalAlign: 'top' }}>
                            <ScoringChat
                              profile={p}
                              rowKey={rowKey}
                              isExpanded={isChatExpanded}
                              onClose={() => setExpandedChatKey(null)}
                              messages={chatHistory[rowKey]}
                              onMessagesChange={handleChatMessagesChange}
                              showNotif={showNotif}
                              useSupabase={useSupabase}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {priorRows.length === 0 && <tr><td colSpan={importSource === 'pdf' ? 6 : 5} className="py-4 px-3.5 text-center text-[var(--t3)] text-[13px]">Aucun profil prioritaire</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: 16, background: '#FFF3E0', border: '1px solid #FFE0B2', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: '#E65100' }}>À travailler 50-69 pts ({workCount})</div>
            <table className="mt w-full border-collapse">
              <thead><tr>
                <th className="text-left py-2 px-3.5 bg-[#FFECB3] text-[11.5px] uppercase tracking-wider text-[#E65100] border-b border-[#FFE0B2]">Profil</th>
                <th className="text-left py-2 px-3.5 bg-[#FFECB3] text-[11.5px] uppercase tracking-wider text-[#E65100] border-b border-[#FFE0B2]">Employeur</th>
                <th className="text-left py-2 px-3.5 bg-[#FFECB3] text-[11.5px] uppercase tracking-wider text-[#E65100] border-b border-[#FFE0B2]">Intitulé</th>
                {importSource === 'pdf' && <th className="text-left py-2 px-3.5 bg-[#FFECB3] text-[11.5px] uppercase tracking-wider text-[#E65100] border-b border-[#FFE0B2]">Ancienneté</th>}
                <th className="text-left py-2 px-3.5 bg-[#FFECB3] text-[11.5px] uppercase tracking-wider text-[#E65100] border-b border-[#FFE0B2]">Score</th>
                <th className="text-left py-2 px-3.5 bg-[#FFECB3] text-[11.5px] uppercase tracking-wider text-[#E65100] border-b border-[#FFE0B2]">Priorité</th>
              </tr></thead>
              <tbody>
                {workRows.map((p, i) => {
                  const rowKey = `work-${i}`
                  const isExpanded = expandedRowKey === rowKey
                  const isChatExpanded = expandedChatKey === rowKey
                  const colSpan = importSource === 'pdf' ? 6 : 5
                  return (
                    <Fragment key={rowKey}>
                      <tr
                        className="border-b border-[#FFE0B2] cursor-pointer hover:bg-[#FFECB3]/50 transition-colors"
                        onClick={() => setExpandedRowKey(isExpanded ? null : rowKey)}
                      >
                        <td className="py-2 px-3.5"><div className="pc flex items-center gap-2.5"><div className="av w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: '#FDEBC8', color: '#B86B0F' }}>{ini(p.fn, p.ln)}</div><div className="pn font-medium">{p.fn} {p.ln}</div></div></td>
                        <td className="py-2 px-3.5 text-[12.5px]">{p.co || '—'}</td>
                        <td className="py-2 px-3.5 text-[12.5px] text-[var(--t2)]">{p.ti || '—'}</td>
                        {importSource === 'pdf' && <td className="py-2 px-3.5 text-[12.5px] text-[var(--t3)]">{p.dur || '—'}</td>}
                        <td className="py-2 px-3.5">
                          <div className="flex items-center gap-2">
                            <span className={`sc inline-flex items-center justify-center w-9 h-6 rounded-md ${scpill(p.sc)}`}>{p.sc}</span>
                            {p._correctedByUser && <CorrectedBadge />}
                            <ScoreImprovementBadge p={p} />
                            <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedChatKey(isChatExpanded ? null : rowKey) }} style={{ padding: '4px 8px', borderRadius: 6, background: 'white', border: '1px solid #173731', color: '#173731', fontSize: 12, cursor: 'pointer' }}>💬 Expliquer</button>
                          </div>
                        </td>
                        <td className="py-2 px-3.5 flex items-center gap-2">
                          {priotag(p.sc)}
                          <span style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none', fontSize: 12 }}>▾</span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={colSpan} className="p-0 align-top" style={{ borderBottom: '1px solid #FFE0B2', verticalAlign: 'top' }}>
                            <ExperienceExpandBlock experiences={p.experiences} />
                          </td>
                        </tr>
                      )}
                      {isChatExpanded && (
                        <tr>
                          <td colSpan={colSpan} className="p-0 align-top" style={{ borderBottom: '1px solid #FFE0B2', verticalAlign: 'top' }}>
                            <ScoringChat profile={p} rowKey={rowKey} isExpanded={isChatExpanded} onClose={() => setExpandedChatKey(null)} messages={chatHistory[rowKey]} onMessagesChange={handleChatMessagesChange} onProfileCorrection={handleProfileCorrection} showNotif={showNotif} useSupabase={useSupabase} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {workRows.length === 0 && <tr><td colSpan={importSource === 'pdf' ? 6 : 5} className="py-4 px-3.5 text-center text-[var(--t3)] text-[13px]">Aucun profil à travailler</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: 16, background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: 10, overflow: 'hidden' }}>
            <button type="button" onClick={() => setEcarteExpanded(!ecarteExpanded)} style={{ width: '100%', padding: '10px 14px', fontWeight: 600, fontSize: 13, color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>À écarter &lt;50 pts ({ecarteRows.length})</span>
              <span style={{ transition: 'transform 0.2s', transform: ecarteExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
            {ecarteExpanded && (
              <table className="mt w-full border-collapse">
                <thead><tr>
                  <th className="text-left py-2 px-3.5 bg-[#FFCDD2] text-[11.5px] uppercase tracking-wider text-[#c0392b] border-b border-[#FFCDD2]">Profil</th>
                  <th className="text-left py-2 px-3.5 bg-[#FFCDD2] text-[11.5px] uppercase tracking-wider text-[#c0392b] border-b border-[#FFCDD2]">Employeur</th>
                  <th className="text-left py-2 px-3.5 bg-[#FFCDD2] text-[11.5px] uppercase tracking-wider text-[#c0392b] border-b border-[#FFCDD2]">Intitulé</th>
                  {importSource === 'pdf' && <th className="text-left py-2 px-3.5 bg-[#FFCDD2] text-[11.5px] uppercase tracking-wider text-[#c0392b] border-b border-[#FFCDD2]">Ancienneté</th>}
                  <th className="text-left py-2 px-3.5 bg-[#FFCDD2] text-[11.5px] uppercase tracking-wider text-[#c0392b] border-b border-[#FFCDD2]">Score</th>
                  <th className="text-left py-2 px-3.5 bg-[#FFCDD2] text-[11.5px] uppercase tracking-wider text-[#c0392b] border-b border-[#FFCDD2]">Priorité</th>
                </tr></thead>
                <tbody>
                  {ecarteRows.map((p, i) => {
                    const rowKey = `ecarte-${i}`
                    const isExpanded = expandedRowKey === rowKey
                    const isChatExpanded = expandedChatKey === rowKey
                    const colSpan = importSource === 'pdf' ? 6 : 5
                    return (
                      <Fragment key={rowKey}>
                        <tr
                          className="border-b border-[#FFCDD2] cursor-pointer hover:bg-[#FFCDD2]/30 transition-colors"
                          onClick={() => setExpandedRowKey(isExpanded ? null : rowKey)}
                        >
                          <td className="py-2 px-3.5"><div className="pc flex items-center gap-2.5"><div className="av w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: '#FDE8E8', color: '#c0392b' }}>{ini(p.fn, p.ln)}</div><div className="pn font-medium">{p.fn} {p.ln}</div></div></td>
                          <td className="py-2 px-3.5 text-[12.5px]">{p.co || '—'}</td>
                          <td className="py-2 px-3.5 text-[12.5px] text-[var(--t2)]">{p.ti || '—'}</td>
                          {importSource === 'pdf' && <td className="py-2 px-3.5 text-[12.5px] text-[var(--t3)]">{p.dur || '—'}</td>}
                          <td className="py-2 px-3.5">
                            <div className="flex items-center gap-2">
                              <span className={`sc inline-flex items-center justify-center w-9 h-6 rounded-md ${scpill(p.sc)}`}>{p.sc}</span>
                              {p._correctedByUser && <CorrectedBadge />}
                              <ScoreImprovementBadge p={p} />
                              <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedChatKey(isChatExpanded ? null : rowKey) }} style={{ padding: '4px 8px', borderRadius: 6, background: 'white', border: '1px solid #173731', color: '#173731', fontSize: 12, cursor: 'pointer' }}>💬 Expliquer</button>
                            </div>
                          </td>
                          <td className="py-2 px-3.5 flex items-center gap-2">
                            {priotag(p.sc)}
                            <span style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none', fontSize: 12 }}>▾</span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={colSpan} className="p-0 align-top" style={{ borderBottom: '1px solid #FFCDD2', verticalAlign: 'top' }}>
                              <ExperienceExpandBlock experiences={p.experiences} />
                            </td>
                          </tr>
                        )}
                        {isChatExpanded && (
                          <tr>
                            <td colSpan={colSpan} className="p-0 align-top" style={{ borderBottom: '1px solid #FFCDD2', verticalAlign: 'top' }}>
                              <ScoringChat profile={p} rowKey={rowKey} isExpanded={isChatExpanded} onClose={() => setExpandedChatKey(null)} messages={chatHistory[rowKey]} onMessagesChange={handleChatMessagesChange} onProfileCorrection={handleProfileCorrection} showNotif={showNotif} useSupabase={useSupabase} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {useSupabase && (
            <div style={{ marginTop: 24, padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: '#173731' }}>Ce que l'IA a appris de vos corrections</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>{learningStats?.total ?? 0} correction{(learningStats?.total ?? 0) > 1 ? 's' : ''} enregistrée{(learningStats?.total ?? 0) > 1 ? 's' : ''}</span>
                {learningStats?.topCompanies?.length > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>
                    Top employeurs corrigés : {learningStats.topCompanies.map(([c, n]) => `${c} (${n})`).join(', ')}
                  </span>
                )}
                {learningStats?.configUpdatedAt && (
                  <span style={{ fontSize: 11, color: 'var(--t3)' }}>
                    Dernière config : {new Date(learningStats.configUpdatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
              <button type="button" onClick={() => navigate('/admin/scoring-learning')} style={{ padding: '6px 12px', borderRadius: 6, background: '#173731', color: 'white', fontSize: 12, cursor: 'pointer' }}>Voir tous les apprentissages</button>
            </div>
          )}
        </>
      )}

      {tab === 'is' && parsedRows.length > 0 && (
        <>
          <div className="stats-row grid grid-cols-4 gap-3 mb-3.5">
            <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Analysés</div><div className="sval text-[26px] font-semibold">{parsedRows.length}</div></div>
            <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Prioritaires ≥70</div><div className="sval text-[26px] font-semibold">{priorCount}</div></div>
            <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">À travailler</div><div className="sval text-[26px] font-semibold">{workCount}</div></div>
            <div className="scard bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4"><div className="slbl text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Score moyen</div><div className="sval text-[26px] font-semibold">{avgScore}</div></div>
          </div>
          <div className="bg-[var(--lbg)] border border-[#FFD5C0] rounded-lg py-2.5 px-4 mb-3.5 text-[12.5px] text-[var(--t2)] flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center text-[var(--lemlist)]"><IconLink /></span>
            Les profils ont été ajoutés au CRM. Chaque profil exporté vers Lemlist apparaîtra dans son historique.
          </div>
          <div className="tw bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
            <div className="thd py-3 px-4 border-b border-[var(--border)] flex items-center gap-2">
              <div className="ttl font-semibold text-sm">Résultats scoring</div>
              <button type="button" className="btn bo bsm py-1.5 px-2.5 text-xs inline-flex items-center gap-1" onClick={() => showNotif('Export CSV Lemlist — fonctionnalité à venir')}><IconUpload /> Export Lemlist CSV</button>
            </div>
            <table className="w-full border-collapse">
              <thead><tr>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Profil</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Employeur</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Intitulé</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Score</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 bg-[var(--s2)] border-b border-[var(--border)]">Priorité</th>
              </tr></thead>
              <tbody>
                {parsedRows.map((p, i) => (
                  <tr key={i} className="border-b border-[var(--border)]">
                    <td className="py-2.5 px-4"><div className="pc flex items-center gap-2.5"><div className="av w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: ['#D4EDE1', '#D3E4F8', '#FDEBC8'][i % 3], color: ['#1A7A4A', '#1E5FA0', '#B86B0F'][i % 3] }}>{ini(p.fn, p.ln)}</div><div className="pn font-medium">{p.fn} {p.ln}</div></div></td>
                    <td className="py-2.5 px-4 text-[12.5px]">{p.co || '—'}</td>
                    <td className="py-2.5 px-4 text-[12.5px] text-[var(--t2)]">{p.ti || '—'}</td>
                    <td className="py-2.5 px-4"><span className={`sc inline-flex items-center justify-center w-9 h-6 rounded-md ${scpill(p.sc)}`}>{p.sc}</span></td>
                    <td className="py-2.5 px-4">{priotag(p.sc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'is' && parsedRows.length === 0 && (
        <div className="text-[var(--t3)] py-8 text-center">Importez d'abord des profils depuis l'onglet Source.</div>
      )}
    </div>
  )
}
