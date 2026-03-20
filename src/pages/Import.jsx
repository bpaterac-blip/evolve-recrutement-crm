import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import { useAuth } from '../context/AuthContext'
import { parseCSV } from '../lib/csvParser'
import { extractTextFromPDF } from '../lib/pdfExtractor'

const parseWithClaude = async (rawText) => {
  let instructions = ''
  try {
    const mod = await import('../lib/scoringInstructions')
    instructions = ((await mod.fetchScoringInstructions()) || '').trim()
  } catch (_) {}

  const instructionsPrefix = instructions
    ? `Instructions importantes pour l'extraction (règles métier à appliquer) :\n${instructions}\n\n`
    : ''

  const content = `${instructionsPrefix}Extrais les informations de ce profil LinkedIn exporté en PDF.
Réponds UNIQUEMENT avec un JSON valide, sans texte avant ou après.

Format attendu :
{
  "firstName": "prénom",
  "lastName": "nom",
  "email": "email ou null",
  "linkedinUrl": "url linkedin ou null",
  "title": "intitulé du poste actuel",
  "city": "ville",
  "region": "région",
  "experiences": [
    {
      "company": "nom entreprise",
      "title": "intitulé poste",
      "startYear": 2020,
      "startMonth": 6,
      "endYear": 2023,
      "endMonth": 12,
      "isCurrent": false
    }
  ]
}

Règles :
- experiences[0] = poste actuel (le plus récent)
- isCurrent = true si encore en poste (Present/Présent)
- endYear = null si isCurrent = true
- Ignorer les stages de moins de 3 mois
- Ignorer les postes "Auxiliaire été"
- Ne PAS inclure les compétences, langues ou formations dans les expériences

Texte du PDF :
${rawText}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content }],
    }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || `API ${response.status}`)
  const text = data.content?.[0]?.text || ''
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}
import { calculateScore, scoreProfile, getExperienceBadge, buildScoringLearningPromptSuffix } from '../lib/scoring'
import { enrichProfileWithNetrows } from '../lib/netrows'
import { supabase } from '../lib/supabase'
import { detectDoublon } from '../lib/detectDoublon'
import { notifyScoringFeedbackUpdated, fetchScoringInstructions } from '../lib/scoringInstructions'
import { IconLink, IconDot, IconUpload, IconDocument } from '../components/Icons'

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

const ACCENT = '#173731'
const GOLD = '#D2AB76'

function escapeCsv(val) {
  if (val == null || val === '') return ''
  const s = String(val)
  if (/[,\n"]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function profileToLemlistRow(p) {
  const email = p.mail || p.email || ''
  const companyDomain = email && email.includes('@') ? email.split('@')[1] || '' : ''
  return [
    escapeCsv(email),
    escapeCsv(p.fn || ''),
    escapeCsv(p.ln || ''),
    escapeCsv(p.co || ''),
    escapeCsv(companyDomain),
    escapeCsv(p.li || p.linkedinUrl || ''),
    escapeCsv(p.phone || ''),
    escapeCsv(p.ti || ''),
    escapeCsv(p.city || ''),
    escapeCsv('R0'),
  ].join(',')
}

function exportToLemlistCsv(profiles) {
  const header = 'email,firstname,lastname,companyName,companyDomain,linkedinUrl,phone,title,city,stade'
  const rows = profiles.map(profileToLemlistRow)
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lemlist_scoring_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const IconWarning = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

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

const SYSTEM_PROMPT = `Tu es un expert en recrutement CGP pour Evolve Investissement. Tu analyses des profils de Conseillers en Gestion de Patrimoine en banque ou assurance pour identifier les meilleurs candidats à rejoindre un réseau indépendant.

Critères de scoring :
- Employeur banque ou assurance = jusqu'à 50pts
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

const CHAT_SUGGESTIONS = ['Pourquoi ce score ?', 'Quel séquence Lemlist recommandes-tu ?', 'Points forts et points faibles ?', 'Est-il vraiment prioritaire ?']
const CORRECTION_SUGGESTIONS = ['Employeur non reconnu', 'A déjà travaillé en cabinet CGP', 'Titre mal interprété', 'Ancienneté incorrecte', 'Profil hors cible']

const ProfileImportModal = ({
  profile,
  rowKey,
  onClose,
  chatHistory,
  onMessagesChange,
  onProfileCorrection,
  showNotif,
  useSupabase,
  ini,
  priotag,
}) => {
  const { user, userProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('chat')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [correctedScore, setCorrectedScore] = useState(profile?.sc ?? 0)
  const [priorityLabel, setPriorityLabel] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const messagesEndRef = useRef(null)
  const initialCalledRef = useRef(false)

  const messages = chatHistory?.[rowKey] || []

  useEffect(() => {
    initialCalledRef.current = false
  }, [profile, rowKey])

  useEffect(() => {
    if (!profile) return
    if (initialCalledRef.current || (messages && messages.length > 0)) return
    initialCalledRef.current = true
    callAnthropic(buildInitialUserMessage(profile), true)
  }, [profile, rowKey])

  useEffect(() => {
    if (messages?.length) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])


  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const callAnthropic = async (userMsg, isInitial = false) => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) { showNotif('Clé API Anthropic manquante'); return }
    setLoading(true)
    try {
      let learningSuffix = ''
      if (useSupabase) {
        learningSuffix = await buildScoringLearningPromptSuffix()
      }
      const systemPrompt = `Tu es un expert en recrutement CGP pour Evolve Investissement. Tu analyses des profils de Conseillers en Gestion de Patrimoine en banque ou assurance pour identifier les meilleurs candidats à rejoindre un réseau indépendant.

Critères de scoring : employeur banque ou assurance = jusqu'à 50pts, intitulé CGP = jusqu'à 30pts, ancienneté 3-7 ans = jusqu'à 20pts, bonus expérience cabinet CGP = +20pts.${learningSuffix}

Applique ces instructions en priorité dans ton analyse. Réponds toujours en français, de manière concise et professionnelle.`
      const history = (messages || []).filter((m) => m.role && m.content).map((m) => ({ role: m.role, content: m.content }))
      const allMessages = [...history, { role: 'user', content: userMsg }]
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: isInitial ? 500 : 1024, system: systemPrompt, messages: allMessages.map((m) => ({ role: m.role, content: m.content })) }),
      })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      onMessagesChange(rowKey, [...(messages || []), { role: 'user', content: userMsg }, { role: 'assistant', content: text }])
    } catch (err) { showNotif(`Erreur : ${err?.message}`) }
    finally { setLoading(false) }
  }

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return
    setInput('')
    callAnthropic(trimmed, false)
  }

  const handleSuggestion = (s) => {
    callAnthropic(s, false)
  }

  const addCorrectionSuggestion = (s) => {
    setCorrectionReason((prev) => (prev ? `${prev}\n${s}` : s))
  }

  const handleSaveCorrection = async () => {
    if (!useSupabase) { showNotif('Supabase requis pour enregistrer'); return }
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    setSaving(true)
    try {
      const manualReason = correctionReason.trim()
      const aiSummary = (!manualReason && apiKey && (messages || []).length > 0)
        ? await generateConversationSummary(messages, apiKey)
        : null
      const reason = manualReason || aiSummary || 'Correction manuelle'
      const priority = priorityLabel || getPriorityLabel(profile?.sc ?? 0)
      const profileData = !profile?.id ? { name: `${profile?.fn || ''} ${profile?.ln || ''}`.trim(), company: profile?.co, title: profile?.ti, score: profile?.sc, priority } : null
      await supabase.from('scoring_feedback').insert({
        profile_id: profile?.id || null,
        profile_data: profileData,
        original_score: profile?.sc ?? 0,
        corrected_score: correctedScore,
        reason,
        priority_label: priority,
        author: userProfile?.full_name?.trim() || user?.email || null,
        consolidated: false,
      })
      onProfileCorrection?.(profile, { sc: correctedScore, _correctedByUser: true, _correctedAt: Date.now() })
      notifyScoringFeedbackUpdated()
      showNotif('✓ Correction enregistrée')
      onClose()
    } catch (err) { showNotif(`Erreur : ${err?.message}`) }
    finally { setSaving(false) }
  }

  const exps = Array.isArray(profile?.experiences) ? profile.experiences : []
  const signals = useMemo(() => {
    if (profile?.signals?.length) return profile.signals
    const { signals: s } = scoreProfile(profile || {}, exps)
    return s || []
  }, [profile, exps])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 900, maxWidth: '100%', height: '92vh', background: 'white', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
          <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--s2)', color: 'var(--t2)', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Colonne gauche */}
          <div style={{ width: 300, flexShrink: 0, background: '#F5F3EF', padding: 24, overflowY: 'auto', borderRight: '1px solid #E5E0D8' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#173731', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600 }}>{ini(profile?.fn, profile?.ln)}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#173731' }}>{profile?.fn} {profile?.ln}</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{profile?.co || profile?.company || '—'} · {profile?.ti || profile?.title || '—'}</div>
                <div style={{ marginTop: 8 }}>{priotag(profile?.sc)}</div>
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#173731', marginBottom: 8 }}>{profile?.sc ?? 0}/100</div>
            <ScoreImprovementBadge p={profile} />
            <div style={{ marginTop: 16, fontSize: 12, color: '#6B7280' }}>
              <div>Email : {profile?.email || '—'}</div>
              <div>LinkedIn : {profile?.li || profile?.linkedinUrl ? <a href={profile.li || profile.linkedinUrl} target="_blank" rel="noreferrer" style={{ color: '#173731' }}>Voir</a> : '—'}</div>
              <div>Ville : {profile?.city || profile?.ville || '—'}</div>
              <div>Région : {profile?.region || '—'}</div>
              <div>Source : {profile?._source || 'Import'}</div>
            </div>
            {exps.length > 0 && (
              <div style={{ marginTop: 20 }}>
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
                          {badge === 'banque' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#EFF6FF', color: '#1D4ED8', fontWeight: 500 }}>Banque</span>}
                          {badge === 'assurance' && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#ECFDF5', color: '#065F46', fontWeight: 500 }}>Assurance</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {signals.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: '#173731' }}>Signaux détectés</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
                  {signals.map((s, i) => (
                    <li key={i}>✓ {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {/* Colonne droite */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #E5E0D8', flexShrink: 0 }}>
              <button type="button" onClick={() => setActiveTab('chat')} style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, background: activeTab === 'chat' ? 'white' : 'transparent', border: 'none', borderBottom: activeTab === 'chat' ? '2px solid #173731' : '2px solid transparent', color: activeTab === 'chat' ? '#173731' : '#6B7280', cursor: 'pointer' }}>Chat IA</button>
              <button type="button" onClick={() => setActiveTab('correction')} style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, background: activeTab === 'correction' ? 'white' : 'transparent', border: 'none', borderBottom: activeTab === 'correction' ? '2px solid #173731' : '2px solid transparent', color: activeTab === 'correction' ? '#173731' : '#6B7280', cursor: 'pointer' }}>Corriger le scoring</button>
            </div>
            {activeTab === 'chat' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                  {loading && (!messages || messages.length === 0) && <div style={{ fontSize: 12, color: '#6B7280' }}>Analyse en cours…</div>}
                  {(messages || []).map((m, i) => (
                    <div key={i} style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start', maxWidth: '90%', marginLeft: m.role === 'user' ? 'auto' : 0, marginRight: m.role === 'user' ? 0 : 'auto', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: m.role === 'user' ? '#173731' : '#F5F3EF', color: m.role === 'user' ? 'white' : '#173731', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{m.role === 'user' ? 'Vous' : 'IA'}</div>
                      <div style={{ padding: '10px 14px', borderRadius: 12, background: m.role === 'user' ? '#173731' : '#F5F3EF', color: m.role === 'user' ? 'white' : '#1A1A1A', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.content}</div>
                    </div>
                  ))}
                  {loading && (messages || []).length > 0 && (
                    <div style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F5F3EF', color: '#173731', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>IA</div>
                      <div style={{ padding: '10px 14px', borderRadius: 12, background: '#F5F3EF', fontSize: 13, color: '#6B7280' }}>…</div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div style={{ flexShrink: 0, padding: 12, borderTop: '1px solid #E5E0D8', background: '#FAFAF9' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    {CHAT_SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => handleSuggestion(s)} disabled={loading} style={{ padding: '6px 12px', borderRadius: 6, background: 'white', border: '1px solid #E5E0D8', fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer', color: '#173731' }}>{s}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()} placeholder="Poser une question…" disabled={loading} style={{ flex: 1, minWidth: 0, padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E0D8', fontSize: 13, background: 'white' }} />
                    <button type="button" onClick={handleSend} disabled={loading || !input.trim()} style={{ padding: '10px 18px', borderRadius: 8, background: '#173731', color: 'white', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', flexShrink: 0 }}>Envoyer</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: 14, color: '#6B7280' }}>Score actuel : <strong style={{ color: '#173731' }}>{profile?.sc ?? 0}/100</strong></div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#374151' }}>Score que j'aurais donné (0-100)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input type="range" min={0} max={100} value={correctedScore} onChange={(e) => setCorrectedScore(Number(e.target.value))} style={{ flex: 1 }} />
                      <input type="number" min={0} max={100} value={correctedScore} onChange={(e) => setCorrectedScore(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} style={{ width: 60, padding: '8px', borderRadius: 6, border: '1px solid #E5E0D8', fontSize: 13 }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#374151' }}>Catégorie réelle</label>
                    <select value={priorityLabel} onChange={(e) => setPriorityLabel(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #E5E0D8', fontSize: 13 }}>
                      <option value="">—</option>
                      {PRIORITY_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#374151' }}>Raison de la correction</label>
                    <textarea value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} placeholder="Expliquez pourquoi vous corrigez ce score... Ex: L'employeur Banque Courtois n'est pas reconnu mais c'est une banque" style={{ width: '100%', minHeight: 300, padding: '10px', borderRadius: 6, border: '1px solid #E5E0D8', fontSize: 13, resize: 'vertical' }} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      {CORRECTION_SUGGESTIONS.map((s) => (
                        <button key={s} type="button" onClick={() => addCorrectionSuggestion(s)} style={{ padding: '6px 12px', borderRadius: 6, background: '#FFF7ED', border: '1px solid #F97316', color: '#F97316', fontSize: 12, cursor: 'pointer' }}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={handleSaveCorrection} disabled={saving} style={{ padding: '10px 20px', borderRadius: 8, background: '#D2AB76', color: '#173731', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}>{saving ? 'Enregistrement…' : 'Enregistrer la correction'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
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
  const { showNotif, addProfile, addProfilesBatch, useSupabase, fetchProfiles } = useCRM()
  const [tab, setTab] = useState('iu')
  const [parsedRows, setParsedRows] = useState([])
  const [importSource, setImportSource] = useState(null) // 'csv' | 'pdf'
  const [importFilename, setImportFilename] = useState('')
  const [restoredFromSession, setRestoredFromSession] = useState(false)
  const hasClearedAfterPushRef = useRef(false)
  const [loading, setLoading] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [pushingRowKey, setPushingRowKey] = useState(null)
  const [includeATravailler, setIncludeATravailler] = useState(false)
  const [ecarteExpanded, setEcarteExpanded] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [enrichedCount, setEnrichedCount] = useState(0)
  const [enrichTotal, setEnrichTotal] = useState(0)
  const [enrichSummary, setEnrichSummary] = useState(null) // { enriched, failed, noLinkedIn }
  const [modalProfile, setModalProfile] = useState(null)
  const [modalRowKey, setModalRowKey] = useState(null)
  const [chatHistory, setChatHistory] = useState({}) // { [rowKey]: [{ role, content }] }
  const [learningRefresh, setLearningRefresh] = useState(0)
  const [learningStats, setLearningStats] = useState(null) // { total, topCompanies, configUpdatedAt }
  const [doublons, setDoublons] = useState([]) // { imported, existing }[]
  const [doublonsModalOpen, setDoublonsModalOpen] = useState(false)
  const csvInputRef = useRef(null)
  const pdfInputRef = useRef(null)
  const pdfFileRef = useRef(null)
  const [pdfAnalyzing, setPdfAnalyzing] = useState(false)

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

    const loadLearningStats = async () => {
      const { count: feedbackCount } = await supabase.from('scoring_feedback').select('*', { count: 'exact', head: true })
      const { count: instructionsCount } = await supabase.from('scoring_instructions').select('*', { count: 'exact', head: true })
      const total = (feedbackCount || 0) + (instructionsCount || 0)
      const { data: fb } = await supabase.from('scoring_feedback').select('profile_data, previous_score').limit(500)
      const companies = {}
      ;(fb || []).forEach((f) => {
        const co = ((f.profile_data?.company || f.profile_data?.name || '')?.trim() || 'Inconnu').slice(0, 50)
        companies[co] = (companies[co] || 0) + 1
      })
      const topCompanies = Object.entries(companies).sort((a, b) => b[1] - a[1]).slice(0, 3)
      const { data: lastFb } = await supabase.from('scoring_feedback').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle()
      const { data: lastInstr } = await supabase.from('scoring_instructions').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle()
      const t1 = lastFb?.created_at ? new Date(lastFb.created_at).getTime() : 0
      const t2 = lastInstr?.updated_at ? new Date(lastInstr.updated_at).getTime() : 0
      const maxT = Math.max(t1, t2)
      const lastInstructionAt = maxT > 0 ? new Date(maxT).toISOString() : null
      setLearningStats({ total, topCompanies, lastInstructionAt })
    }

    loadLearningStats()

    const channel = supabase
      .channel('import-learning-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scoring_feedback' }, () => {
        loadLearningStats()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scoring_instructions' }, () => {
        loadLearningStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
    setModalProfile(null)
    setModalRowKey(null)
    setChatHistory({})
    setDoublons([])
    setDoublonsModalOpen(false)
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
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      showNotif('Clé API Anthropic manquante (VITE_ANTHROPIC_API_KEY)')
      return
    }
    setLoading(true)
    setPdfAnalyzing(true)
    setRestoredFromSession(false)
    hasClearedAfterPushRef.current = false
    try {
      const text = await extractTextFromPDF(file)
      const parsed = await parseWithClaude(text)
      const firstExp = parsed.experiences?.[0]
      const profile = {
        fn: parsed.firstName || '',
        ln: parsed.lastName || '',
        fullName: [parsed.firstName, parsed.lastName].filter(Boolean).join(' ') || '',
        co: firstExp?.company || parsed.title || '—',
        ti: firstExp?.title || parsed.title || '—',
        city: parsed.city || '—',
        region: parsed.region || '',
        email: parsed.email || '',
        mail: parsed.email || '',
        li: parsed.linkedinUrl || '',
        dur: firstExp?.isCurrent && firstExp?.startYear ? `Depuis ${firstExp.startYear}` : '',
        experiences: (parsed.experiences || []).map((exp) => ({
          company: exp.company,
          title: exp.title,
          startYear: exp.startYear ?? null,
          startMonth: exp.startMonth ?? null,
          endYear: exp.endYear ?? null,
          endMonth: exp.endMonth ?? null,
          isCurrent: exp.isCurrent ?? false,
        })),
        _source: 'Import PDF',
      }
      const { score, priority, signals } = scoreProfile(profile, profile.experiences)
      setParsedRows([{ ...profile, sc: score, priority, signals }])
      setImportSource('pdf')
      setImportFilename(file.name || '')
      pdfFileRef.current = file
      setTab('im')
      showNotif('📑 PDF analysé — 1 profil extrait ✓')
    } catch (err) {
      showNotif(`Erreur PDF : ${err?.message}`)
    } finally {
      setLoading(false)
      setPdfAnalyzing(false)
      e.target.value = ''
    }
  }

  const priorRows = parsedRows.filter((r) => (r.sc || 0) >= 70)
  const workRows = parsedRows.filter((r) => (r.sc || 0) >= 50 && (r.sc || 0) < 70)
  const ecarteRows = parsedRows.filter((r) => (r.sc || 0) < 50)
  const rowsToPush = includeATravailler ? [...priorRows, ...workRows] : priorRows

  const buildProfileRow = (p) => ({
    first_name: p.fn ?? '',
    last_name: p.ln ?? '',
    company: p.co ?? '—',
    title: p.ti ?? '—',
    city: p.city ?? '—',
    region: p.region ?? '',
    email: p.mail ?? '—',
    linkedin_url: p.li ?? '—',
    source: p.src ?? 'Chasse LinkedIn',
    score: p.sc ?? 0,
    stage: p.stg ?? null,
    maturity: p.mat ?? 'Froid',
    experiences: Array.isArray(p.experiences) ? p.experiences : [],
    sequence_lemlist: p.sequence_lemlist ?? '',
    lead_status: p.lead_status ?? '',
  })

  const pushToCRM = async () => {
    if (!rowsToPush.length) return
    setPushing(true)
    setDoublons([])
    try {
      if (useSupabase) {
        const toInsert = []
        const doublonsList = []
        for (const p of rowsToPush) {
          const existing = await detectDoublon(p)
          if (existing) {
            doublonsList.push({ imported: p, existing })
          } else {
            toInsert.push(p)
          }
        }
        if (toInsert.length > 0) {
          const inserted = await addProfilesBatch(toInsert)
          const n = Array.isArray(inserted) ? inserted.length : inserted
          showNotif(`✓ ${n} profils ajoutés au CRM`)
          if (importSource === 'pdf' && pdfFileRef.current && inserted?.length > 0) {
            const profileId = inserted[0].id
            const file = pdfFileRef.current
            const storagePath = `${profileId}/${file.name}`
            const { error: uploadErr } = await supabase.storage.from('cvs').upload(storagePath, file, { contentType: 'application/pdf' })
            if (!uploadErr) {
              const { data: urlData } = await supabase.storage.from('cvs').createSignedUrl(storagePath, 60 * 60 * 24 * 365)
              if (urlData?.signedUrl) {
                await supabase.from('profiles').update({ cv_url: urlData.signedUrl, cv_url_path: storagePath }).eq('id', profileId)
                fetchProfiles()
              }
            }
            pdfFileRef.current = null
          }
        }
        if (doublonsList.length > 0) {
          setDoublons(doublonsList)
          setDoublonsModalOpen(true)
        }
        if (toInsert.length > 0 || doublonsList.length > 0) {
          hasClearedAfterPushRef.current = true
          clearImportStorage()
          setTab('is')
        }
      } else {
        for (const p of rowsToPush) {
          await addProfile(p)
        }
        showNotif(`✓ ${rowsToPush.length} profils ajoutés au CRM`)
        hasClearedAfterPushRef.current = true
        clearImportStorage()
        setTab('is')
      }
    } catch (err) {
      showNotif(`Erreur : ${err?.message}`)
    } finally {
      setPushing(false)
    }
  }

  const pushSingleProfileToCRM = async (p, rowKey) => {
    if (!p || pushingRowKey) return
    setPushingRowKey(rowKey)
    setDoublons([])
    try {
      if (useSupabase) {
        const existing = await detectDoublon(p)
        if (existing) {
          setDoublons([{ imported: p, existing }])
          setDoublonsModalOpen(true)
          return
        }
        const inserted = await addProfilesBatch([p])
        const arr = Array.isArray(inserted) ? inserted : []
        if (arr.length > 0) {
          showNotif('✓ Profil ajouté au CRM')
          if (importSource === 'pdf' && pdfFileRef.current && arr[0]?.id) {
            const profileId = arr[0].id
            const file = pdfFileRef.current
            const storagePath = `${profileId}/${file.name}`
            const { error: uploadErr } = await supabase.storage.from('cvs').upload(storagePath, file, { contentType: 'application/pdf' })
            if (!uploadErr) {
              const { data: urlData } = await supabase.storage.from('cvs').createSignedUrl(storagePath, 60 * 60 * 24 * 365)
              if (urlData?.signedUrl) {
                await supabase.from('profiles').update({ cv_url: urlData.signedUrl, cv_url_path: storagePath }).eq('id', profileId)
                fetchProfiles()
              }
            }
            pdfFileRef.current = null
          }
          fetchProfiles?.()
          setParsedRows((prev) => prev.filter((row) => !(row.fn === p.fn && row.ln === p.ln && (row.co || '') === (p.co || ''))))
        }
      } else {
        await addProfile(p)
        showNotif('✓ Profil ajouté au CRM')
        setParsedRows((prev) => prev.filter((row) => !(row.fn === p.fn && row.ln === p.ln && (row.co || '') === (p.co || ''))))
      }
    } catch (err) {
      showNotif(`Erreur : ${err?.message}`)
    } finally {
      setPushingRowKey(null)
    }
  }

  const hasValidLinkedIn = (p) => {
    const li = (p.li || p.linkedinUrl || '').trim()
    return li && li !== '—' && (li.startsWith('http') || li.includes('linkedin.com'))
  }

  const profilesWithLinkedIn = parsedRows.filter(hasValidLinkedIn)
  const netrowsEligibleCount = parsedRows.filter((p) => hasValidLinkedIn(p) && p._enrichStatus !== 'enriched').length

  const handleEnrichWithNetrows = async () => {
    if (!netrowsEligibleCount) return
    if (!useSupabase) {
      showNotif('Enrichissement Netrows nécessite Supabase (Edge Function)')
      return
    }
    setEnriching(true)
    setEnrichedCount(0)
    setEnrichTotal(netrowsEligibleCount)
    setEnrichSummary(null)
    let enriched = 0
    let failed = 0
    let noLinkedIn = parsedRows.length - profilesWithLinkedIn.length
    const updatedRows = [...parsedRows]

    for (let i = 0; i < parsedRows.length; i++) {
      const p = parsedRows[i]
      const li = (p.li || p.linkedinUrl || '').trim()
      if (!li || li === '—' || !li.includes('linkedin')) {
        if (updatedRows[i]) updatedRows[i] = { ...updatedRows[i], _enrichStatus: 'Sans LinkedIn' }
        continue
      }
      if (p._enrichStatus === 'enriched') continue
      try {
        const data = await enrichProfileWithNetrows(li)
        const experiences = data.experiences || []
        console.log('Expériences reçues:', experiences)
        const prevScore = p.sc ?? calculateScore(p)
        const { score: newScore, priority, signals } = scoreProfile(updatedRows[i], experiences)
        const enrichedProfile = {
          ...updatedRows[i],
          experiences,
          sc: newScore,
          priority,
          signals,
          _enrichStatus: 'enriched',
          _scoreBeforeEnrich: prevScore,
        }
        console.log('Profil après enrichissement:', enrichedProfile)
        updatedRows[i] = enrichedProfile
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
    <div className="page h-full overflow-y-auto p-[22px]" style={{ background: '#F5F0E8' }}>
      <div className="font-serif text-[22px] mb-1" style={{ color: ACCENT }}>Import & Scoring</div>
      <div className="text-[13px] mb-5" style={{ color: '#6B6B6B' }}>CSV Sales Navigator ou PDF LinkedIn — mappe les colonnes, lance le scoring automatique</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 4, display: 'flex', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <button type="button" onClick={() => setTab('iu')} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: tab === 'iu' ? ACCENT : 'transparent', color: tab === 'iu' ? GOLD : '#6B6B6B' }}>Source</button>
          <button type="button" onClick={() => setTab('im')} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: tab === 'im' ? ACCENT : 'transparent', color: tab === 'im' ? GOLD : '#6B6B6B' }}>Résultat scoring</button>
          <button type="button" onClick={() => setTab('is')} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: tab === 'is' ? ACCENT : 'transparent', color: tab === 'is' ? GOLD : '#6B6B6B' }}>Profils intégrés</button>
        </div>
        {tab === 'im' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: '#333' }}>
              <input type="checkbox" checked={includeATravailler} onChange={(e) => setIncludeATravailler(e.target.checked)} />
              Inclure les À travailler
            </label>
            {netrowsEligibleCount > 0 && importSource === 'csv' && (
              <button type="button" onClick={handleEnrichWithNetrows} disabled={enriching} style={{ padding: '8px 16px', borderRadius: 8, background: 'white', color: ACCENT, fontWeight: 500, fontSize: 13, border: '1px solid #173731', cursor: enriching ? 'not-allowed' : 'pointer', opacity: enriching ? 0.6 : 1 }}>
                {enriching ? 'Enrichissement…' : `Enrichir via Netrows (${netrowsEligibleCount} profils)`}
              </button>
            )}
            <button type="button" onClick={pushToCRM} disabled={pushing || rowsToPush.length === 0} style={{ position: 'relative', zIndex: 1, padding: '8px 16px', borderRadius: 8, background: ACCENT, color: GOLD, fontWeight: 500, fontSize: 13, cursor: pushing || rowsToPush.length === 0 ? 'not-allowed' : 'pointer', opacity: pushing || rowsToPush.length === 0 ? 0.6 : 1 }}>
              {pushing ? 'En cours…' : `Pousser ${rowsToPush.length} profil(s) dans le CRM`}
            </button>
            <button type="button" onClick={() => exportToLemlistCsv(rowsToPush)} disabled={rowsToPush.length === 0} style={{ position: 'relative', zIndex: 1, padding: '8px 16px', borderRadius: 8, background: GOLD, color: ACCENT, fontWeight: 500, fontSize: 13, cursor: rowsToPush.length === 0 ? 'not-allowed' : 'pointer', opacity: rowsToPush.length === 0 ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconUpload />
              Exporter vers Lemlist
            </button>
          </div>
        )}
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
            <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E8F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#1A7A4A' }}>
                  <IconDocument />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Import CSV</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Sales Navigator, Waalaxy, Lemlist</div>
                </div>
              </div>
              <div
                style={{ margin: '0 16px 16px', padding: 28, border: '1.5px dashed var(--border)', borderRadius: 12, background: 'var(--s2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => csvInputRef.current?.click()}
              >
                {loading ? (
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>…</div>
                ) : (
                  <>
                    <span style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}><IconUpload /></span>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Glisser-déposer ou</div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); csvInputRef.current?.click(); }} style={{ padding: '8px 16px', borderRadius: 8, background: '#173731', color: '#E7E0D0', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Choisir un fichier</button>
                  </>
                )}
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>Formats détectés</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['Lemlist', 'Waalaxy', 'Sales Navigator'].map((f) => (
                    <span key={f} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--border)', fontWeight: 500 }}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E8F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#1E5FA0' }}>
                  <IconDocument />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Import PDF LinkedIn</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Profil exporté en PDF</div>
                </div>
              </div>
              <div
                style={{ margin: '0 16px 16px', padding: 28, border: '1.5px dashed var(--border)', borderRadius: 12, background: 'var(--s2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => pdfInputRef.current?.click()}
              >
                {loading && pdfAnalyzing ? (
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>Analyse du PDF en cours…</div>
                ) : (
                  <>
                    <span style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}><IconUpload /></span>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Glisser-déposer ou</div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); pdfInputRef.current?.click(); }} style={{ padding: '8px 16px', borderRadius: 8, background: '#173731', color: '#E7E0D0', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Choisir un fichier</button>
                  </>
                )}
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>Extraction automatique</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['Nom', 'Employeur', 'Poste', 'Ville', 'Expériences'].map((f) => (
                    <span key={f} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--border)', fontWeight: 500 }}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'im' && (
        <>
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

          <div style={{ marginBottom: 16, background: 'white', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>Prioritaires</span>
              </div>
              <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: '#dcfce7', color: '#15803d', fontWeight: 500 }}>{priorCount} profils · ≥70 pts</span>
            </div>
            <div style={{ padding: '0 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '36px 2.5fr 1.5fr 2fr 70px 110px 40px', alignItems: 'center', gap: 12, padding: '12px 0', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#bbb', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <span>Avatar</span><span>Profil</span><span>Employeur</span><span>Intitulé</span><span>Score</span><span>Priorité</span><span />
              </div>
              {priorRows.map((p, i) => {
                const rowKey = `prior-${i}`
                return (
                  <div key={rowKey} style={{ display: 'grid', gridTemplateColumns: '36px 2.5fr 1.5fr 2fr 70px 110px 40px', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer' }} onClick={() => { setModalProfile(p); setModalRowKey(rowKey) }} onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: ACCENT, color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{ini(p.fn, p.ln)}</div>
                    <span style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>{p.fn} {p.ln}</span>
                    <span style={{ fontSize: 12, color: '#555' }}>{p.co || '—'}</span>
                    <span style={{ fontSize: 12, color: '#555' }}>{p.ti || '—'}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 8, background: '#dcfce7', color: '#15803d', fontSize: 12, fontWeight: 600 }}>{p.sc}</span>
                      {p._correctedByUser && <CorrectedBadge />}
                      <ScoreImprovementBadge p={p} />
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 20, background: '#dcfce7', color: '#15803d', fontSize: 11, fontWeight: 500 }}>Prioritaire</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); exportToLemlistCsv([p]) }} title="Exporter vers Lemlist" style={{ width: 28, height: 28, borderRadius: 8, background: '#F5F0E8', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconUpload />
                    </button>
                  </div>
                )
              })}
              {priorRows.length === 0 && <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#888' }}>Aucun profil prioritaire</div>}
            </div>
          </div>

          <div style={{ marginBottom: 16, background: 'white', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#a16207' }}>À travailler</span>
              </div>
              <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: '#fefce8', color: '#a16207', fontWeight: 500 }}>{workCount} profils · 50-69 pts</span>
            </div>
            <div style={{ padding: '0 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '36px 2.5fr 1.5fr 2fr 70px 110px 40px', alignItems: 'center', gap: 12, padding: '12px 0', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#bbb', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <span>Avatar</span><span>Profil</span><span>Employeur</span><span>Intitulé</span><span>Score</span><span>Priorité</span><span />
              </div>
              {workRows.map((p, i) => {
                const rowKey = `work-${i}`
                return (
                  <div key={rowKey} style={{ display: 'grid', gridTemplateColumns: '36px 2.5fr 1.5fr 2fr 70px 110px 40px', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer' }} onClick={() => { setModalProfile(p); setModalRowKey(rowKey) }} onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fefce8', color: '#a16207', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{ini(p.fn, p.ln)}</div>
                    <span style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>{p.fn} {p.ln}</span>
                    <span style={{ fontSize: 12, color: '#555' }}>{p.co || '—'}</span>
                    <span style={{ fontSize: 12, color: '#555' }}>{p.ti || '—'}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 8, background: '#fefce8', color: '#a16207', fontSize: 12, fontWeight: 600 }}>{p.sc}</span>
                      {p._correctedByUser && <CorrectedBadge />}
                      <ScoreImprovementBadge p={p} />
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 20, background: '#fefce8', color: '#a16207', fontSize: 11, fontWeight: 500 }}>À travailler</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); exportToLemlistCsv([p]) }} title="Exporter vers Lemlist" style={{ width: 28, height: 28, borderRadius: 8, background: '#F5F0E8', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconUpload />
                    </button>
                  </div>
                )
              })}
              {workRows.length === 0 && <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#888' }}>Aucun profil à travailler</div>}
            </div>
          </div>

          <div style={{ marginBottom: 16, background: 'white', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <button type="button" onClick={() => setEcarteExpanded(!ecarteExpanded)} style={{ width: '100%', padding: '16px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: ecarteExpanded ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>À écarter</span>
                <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', fontWeight: 500 }}>{ecarteRows.length} profils · &lt;50 pts</span>
              </div>
              <span style={{ transition: 'transform 0.2s', transform: ecarteExpanded ? 'rotate(180deg)' : 'none', color: '#888' }}>▾</span>
            </button>
            {ecarteExpanded && (
              <div style={{ padding: '0 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '36px 2.5fr 1.5fr 2fr 70px 110px minmax(140px, auto)', alignItems: 'center', gap: 12, padding: '12px 0', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#bbb', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <span>Avatar</span><span>Profil</span><span>Employeur</span><span>Intitulé</span><span>Score</span><span>Priorité</span><span style={{ textAlign: 'right' }}>Actions</span>
                </div>
                {ecarteRows.map((p, i) => {
                  const rowKey = `ecarte-${i}`
                  return (
                    <div key={rowKey} style={{ display: 'grid', gridTemplateColumns: '36px 2.5fr 1.5fr 2fr 70px 110px minmax(140px, auto)', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer' }} onClick={() => { setModalProfile(p); setModalRowKey(rowKey) }} onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{ini(p.fn, p.ln)}</div>
                      <span style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>{p.fn} {p.ln}</span>
                      <span style={{ fontSize: 12, color: '#555' }}>{p.co || '—'}</span>
                      <span style={{ fontSize: 12, color: '#555' }}>{p.ti || '—'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ padding: '4px 10px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600 }}>{p.sc}</span>
                        {p._correctedByUser && <CorrectedBadge />}
                        <ScoreImprovementBadge p={p} />
                      </div>
                      <span style={{ padding: '4px 10px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 500 }}>À écarter</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={(e) => { e.stopPropagation(); exportToLemlistCsv([p]) }} title="Exporter vers Lemlist" style={{ width: 28, height: 28, borderRadius: 8, background: '#F5F0E8', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <IconUpload />
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); pushSingleProfileToCRM(p, rowKey) }} disabled={pushingRowKey === rowKey || pushing} title="Ajouter ce profil au CRM" style={{ padding: '6px 10px', borderRadius: 8, background: ACCENT, color: GOLD, fontSize: 11, fontWeight: 500, border: 'none', cursor: pushingRowKey === rowKey || pushing ? 'not-allowed' : 'pointer', opacity: pushingRowKey === rowKey || pushing ? 0.65 : 1, whiteSpace: 'nowrap' }}>
                          {pushingRowKey === rowKey ? '…' : 'Ajouter au CRM'}
                        </button>
                      </div>
                    </div>
                  )
                })}
                {ecarteRows.length === 0 && <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#888' }}>Aucun profil à écarter</div>}
              </div>
            )}
          </div>

          {useSupabase && (
            <div style={{ marginTop: 24, padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: '#173731' }}>Ce que l'IA a appris de vos corrections</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>{learningStats?.total ?? 0} correction(s) enregistrée(s)</span>
                {learningStats?.topCompanies?.length > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>
                    Top employeurs corrigés : {learningStats.topCompanies.map(([c, n]) => `${c} (${n})`).join(', ')}
                  </span>
                )}
                {learningStats?.lastInstructionAt && (
                  <span style={{ fontSize: 11, color: 'var(--t3)' }}>
                    Dernière instruction : {new Date(learningStats.lastInstructionAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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

      {doublonsModalOpen && doublons.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.5)' }} onClick={() => setDoublonsModalOpen(false)}>
          <div style={{ width: 560, maxWidth: '100%', maxHeight: '90vh', background: 'white', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#f59e0b' }}><IconWarning /></span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#173731' }}>{doublons.length} doublon(s) détecté(s)</h2>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {doublons.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: i < doublons.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#173731', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                    {(d.imported.fn?.[0] || '') + (d.imported.ln?.[0] || '') || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#173731' }}>{d.imported.fn} {d.imported.ln}</div>
                    <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>Existant : {d.existing.first_name} {d.existing.last_name} · {d.existing.company || '—'} · Stade : {d.existing.stage || '—'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button type="button" onClick={async () => { setDoublons((prev) => prev.filter((_, j) => j !== i)); if (doublons.length <= 1) setDoublonsModalOpen(false) }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'white', fontSize: 12, cursor: 'pointer', color: 'var(--t2)' }}>Ignorer</button>
                    <button type="button" onClick={async () => {
                      const row = buildProfileRow(d.imported)
                      await supabase.from('profiles').update(row).eq('id', d.existing.id)
                      await fetchProfiles?.()
                      showNotif(`${d.imported.fn} ${d.imported.ln} mis à jour`)
                      setDoublons((prev) => prev.filter((_, j) => j !== i))
                      if (doublons.length <= 1) setDoublonsModalOpen(false)
                    }} style={{ padding: '6px 12px', borderRadius: 6, background: '#173731', border: 'none', fontSize: 12, cursor: 'pointer', color: 'white' }}>Mettre à jour</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => { setDoublons([]); setDoublonsModalOpen(false) }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'white', fontSize: 13, cursor: 'pointer', color: 'var(--t2)' }}>Ignorer tous</button>
              <button type="button" onClick={async () => {
                for (const d of doublons) {
                  const row = buildProfileRow(d.imported)
                  await supabase.from('profiles').update(row).eq('id', d.existing.id)
                }
                await fetchProfiles?.()
                showNotif(`${doublons.length} profil(s) mis à jour`)
                setDoublons([])
                setDoublonsModalOpen(false)
              }} style={{ padding: '8px 16px', borderRadius: 8, background: '#D2AB76', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#173731' }}>Mettre à jour tous</button>
            </div>
          </div>
        </div>
      )}

      {modalProfile && modalRowKey && (
        <ProfileImportModal
          profile={modalProfile}
          rowKey={modalRowKey}
          onClose={() => { setModalProfile(null); setModalRowKey(null) }}
          chatHistory={chatHistory}
          onMessagesChange={handleChatMessagesChange}
          onProfileCorrection={handleProfileCorrection}
          showNotif={showNotif}
          useSupabase={useSupabase}
          ini={ini}
          priotag={priotag}
        />
      )}
    </div>
  )
}
