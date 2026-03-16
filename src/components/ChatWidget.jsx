import { useState, useRef, useEffect } from 'react'
import { useCRM } from '../context/CRMContext'
import { supabase } from '../lib/supabase'
import { fetchScoringInstructions } from '../lib/scoringInstructions'

const ACCENT = '#173731'
const GOLD = '#D2AB76'

const RELANCE_THRESHOLDS = {
  R0: 7,
  R1: 14,
  'R2 Amaury': 21,
  'R2 Baptiste': 21,
}

function getRelanceThreshold(stage) {
  if (RELANCE_THRESHOLDS[stage] != null) return RELANCE_THRESHOLDS[stage]
  if (stage === 'R2 Baptiste') return 21
  return 30
}

function buildPipelineContext(profiles, nextSession) {
  const byStage = {}
  const active = profiles.filter((p) => p.stg && p.mat !== 'Archivé')
  active.forEach((p) => {
    const s = p.stg || 'R0'
    byStage[s] = (byStage[s] || 0) + 1
  })
  const stageLines = Object.entries(byStage).map(([s, n]) => `- ${s} : ${n} profils`).join('\n')

  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const profilsARelancer = active
    .filter((p) => {
      if (!p.stg || p.stg === 'Recruté') return false
      const lastUpdate = p.updated_at || p.created_at
      if (!lastUpdate) return false
      const daysSince = Math.floor((now - new Date(lastUpdate).getTime()) / dayMs)
      return daysSince > getRelanceThreshold(p.stg)
    })
    .sort((a, b) => {
      const da = a.updated_at || a.created_at
      const db = b.updated_at || b.created_at
      return (db ? new Date(db).getTime() : 0) - (da ? new Date(da).getTime() : 0)
    })
    .slice(0, 8)

  const relancerLines = profilsARelancer.length > 0
    ? profilsARelancer.map((p) => `  - ${p.fn} ${p.ln} (${p.co}) — ${p.stg}`).join('\n')
    : 'Aucun'

  let sessionLine = 'Aucune session planifiée'
  if (nextSession) {
    const d = new Date(nextSession.date_session).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    sessionLine = `${d} — ${nextSession.lieu || '—'} (${nextSession.statut || 'planifiée'})`
  }

  return `Nombre de profils par stade:\n${stageLines}\n\nProfils à relancer (${profilsARelancer.length}):\n${relancerLines}\n\nProchaine session de formation:\n${sessionLine}`
}

const IconChat = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const IconSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

export default function ChatWidget() {
  const { filteredProfiles } = useCRM()
  const [open, setOpen] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'ai', content: "Bonjour. Je suis l'assistant Evolve. Posez vos questions sur le pipeline, les profils à relancer ou la prochaine session." },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [nextSession, setNextSession] = useState(null)
  const endRef = useRef(null)

  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().slice(0, 10)
      supabase.from('sessions_formation').select('*').gte('date_session', today).order('date_session', { ascending: true }).limit(1).maybeSingle().then(({ data }) => setNextSession(data))
    }
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const msg = input.trim()
    if (!msg) return
    if (!apiKey) {
      setMessages((prev) => [...prev, { role: 'u', content: msg }, { role: 'ai', content: 'Clé API Anthropic manquante. Ajoutez VITE_ANTHROPIC_API_KEY dans .env.local.' }])
      setInput('')
      return
    }
    setInput('')
    setMessages((prev) => [...prev, { role: 'u', content: msg }])
    setLoading(true)

    const stripHtml = (s) => (typeof s === 'string' ? s.replace(/<[^>]+>/g, '') : s)
    const context = buildPipelineContext(filteredProfiles, nextSession)
    const scoringInstructions = await fetchScoringInstructions()
    let systemContent = `Tu es un assistant pour Evolve Recruiter, un CRM de recrutement de CGP indépendants. Tu aides l'utilisateur à gérer son pipeline, analyser ses prospects et optimiser son recrutement. Réponds en français, de façon concise et professionnelle.

Contexte pipeline actuel:
${context}`
    if (scoringInstructions) {
      systemContent += `\n\nPour les questions liées au scoring CGP, utilise ces règles métier :\n${scoringInstructions}`
    }

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
          system: systemContent,
          messages: [
            ...messages.map((m) => ({ role: m.role === 'u' ? 'user' : 'assistant', content: stripHtml(m.content) })),
            { role: 'user', content: msg },
          ].slice(-20),
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error?.message || `API ${res.status}`)
      }

      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const formatted = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')
      setMessages((prev) => [...prev, { role: 'ai', content: formatted }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'ai', content: `Erreur : ${err?.message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => { setPressed(false); setOpen((o) => !o) }}
        onMouseLeave={() => setPressed(false)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: ACCENT,
          boxShadow: pressed ? '0 2px 6px rgba(0,0,0,0.15)' : '0 4px 12px rgba(0,0,0,0.2)',
          transform: pressed ? 'scale(0.88)' : 'scale(1)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          cursor: 'pointer',
          zIndex: 1000,
          border: '2px solid ' + GOLD,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconChat />
      </button>

      <div
        style={{
          position: 'fixed',
          bottom: 84,
          right: 24,
          width: 420,
          height: 560,
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.2s ease, opacity 0.2s ease',
          transform: open ? 'translateY(0)' : 'translateY(20px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <div style={{ background: ACCENT, borderRadius: '16px 16px 0 0', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, color: 'white' }}>Assistant Evolve</div>
            <div style={{ fontSize: 11, color: GOLD, marginTop: 2 }}>Posez vos questions sur le pipeline</div>
          </div>
          <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', padding: 4, display: 'flex' }}>
            <IconClose />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'u' ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontSize: 13,
                  lineHeight: 1.5,
                  background: m.role === 'u' ? '#F5F0E8' : '#f8f8f8',
                  marginLeft: m.role === 'u' ? 'auto' : 0,
                  marginRight: m.role === 'u' ? 0 : 'auto',
                }}
              >
                {typeof m.content === 'string' && m.content.includes('<') ? <span dangerouslySetInnerHTML={{ __html: m.content }} /> : m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '10px 14px', borderRadius: 12, fontSize: 13, background: '#f8f8f8', color: '#888' }}>…</div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), send())}
            placeholder="Posez votre question…"
            disabled={loading}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit' }}
          />
          <button type="button" onClick={send} disabled={loading} style={{ background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', color: ACCENT, padding: 4, display: 'flex', opacity: loading ? 0.5 : 1 }}>
            <IconSend />
          </button>
        </div>
      </div>
    </>
  )
}
