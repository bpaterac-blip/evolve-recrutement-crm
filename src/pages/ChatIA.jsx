import { useState, useRef, useEffect } from 'react'
import { useCRM } from '../context/CRMContext'
import { IconStar } from '../components/Icons'
import { fetchScoringInstructions } from '../lib/scoringInstructions'

function buildPipelineContext(profiles) {
  const byStage = {}
  profiles.forEach((p) => {
    const s = p.stg || 'R0'
    byStage[s] = (byStage[s] || 0) + 1
  })
  const lines = Object.entries(byStage).map(([s, n]) => `- ${s} → ${n} profils`).join('\n')
  const top = profiles.slice(0, 15).map((p) => `  - ${p.fn} ${p.ln} (${p.co}) — ${p.stg}, score ${p.sc}`).join('\n')
  return `Pipeline Evolve Recruiter actuel:\n${lines}\n\nProfils (extrait):\n${top}`
}

export default function ChatIA() {
  const { filteredProfiles } = useCRM()
  const [messages, setMessages] = useState([
    { role: 'ai', content: "Bonjour ! Je suis ton assistant CRM Evolve.<br><br>Tu peux me demander :<br>— <em>Quels profils sont bloqués ?</em><br>— <em>Rédige un email de relance pour [nom]</em><br>— <em>Quelle est ma meilleure source d'acquisition ?</em><br>— <em>État du pipeline</em>" },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)

  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    const msg = input.trim()
    if (!msg) return
    if (!apiKey) {
      setMessages((prev) => [...prev, { role: 'u', content: msg }, { role: 'ai', content: "<strong>Attention :</strong> Clé API Anthropic manquante.<br><br>Ajoute <code>VITE_ANTHROPIC_API_KEY</code> dans <code>.env.local</code> pour activer le chat IA." }])
      setInput('')
      return
    }
    setInput('')
    setMessages((prev) => [...prev, { role: 'u', content: msg }])
    setLoading(true)

    const stripHtml = (s) => (typeof s === 'string' ? s.replace(/<[^>]+>/g, '') : s)
    const context = buildPipelineContext(filteredProfiles)
    const scoringInstructions = await fetchScoringInstructions()
    let systemContent = `Tu es l'assistant CRM Evolve Recruiter. Tu aides au recrutement de CGP/conseillers patrimoine. Réponds en français, de façon concise et actionnable. Utilise le contexte pipeline fourni pour répondre précisément.

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
    <div id="pg-chat" className="h-full flex flex-col overflow-hidden">
      <div className="cms flex-1 overflow-y-auto py-5 px-5 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={`cm flex gap-2.5 max-w-[80%] items-start ${m.role === 'u' ? 'u flex-row-reverse self-end' : ''}`}>
            <div className={`mav w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${m.role === 'ai' ? 'ai bg-[var(--accent)] text-[var(--gold)]' : 'u bg-[var(--gold)] text-[var(--accent)]'}`}>{m.role === 'ai' ? <IconStar /> : 'B'}</div>
            <div className={`mb py-2.5 px-3.5 rounded-xl text-[13.5px] leading-relaxed ${m.role === 'ai' ? 'bg-[var(--surface)] border border-[var(--border)] rounded-tl rounded-tr rounded-br rounded-bl' : 'bg-[var(--accent)] text-white rounded-tr rounded-tl rounded-br rounded-bl'}`}>
              {typeof m.content === 'string' && m.content.includes('<') ? <span dangerouslySetInnerHTML={{ __html: m.content }} /> : m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="cm flex gap-2.5 items-start">
            <div className="mav w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-[var(--accent)] text-[var(--gold)]"><IconStar /></div>
            <div className="mb py-2.5 px-3.5 rounded-xl text-[13.5px] text-[var(--t3)]">…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="cbar py-3 px-5 border-t border-[var(--border)] bg-[var(--surface)] flex gap-2 items-end shrink-0">
        <textarea
          className="cin flex-1 border border-[var(--b2)] rounded-[10px] py-2 px-3 font-[inherit] text-[13.5px] text-[var(--text)] resize-none outline-none bg-[var(--bg)] max-h-[110px] transition-colors focus:border-[var(--accent)]"
          placeholder="Pose ta question…"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          disabled={loading}
        />
        <button type="button" className="csend w-[38px] h-[38px] rounded-lg bg-[var(--accent)] border-none cursor-pointer flex items-center justify-center text-white text-[17px] shrink-0 hover:bg-[var(--a2)] transition-colors disabled:opacity-60" onClick={send} disabled={loading}>↑</button>
      </div>
    </div>
  )
}
