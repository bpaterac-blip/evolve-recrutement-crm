import { useState, useRef, useEffect } from 'react'

const CR = {
  bloqu: "D'après le pipeline, <strong>3 profils</strong> sont bloqués depuis +2 semaines :<br><br>• <strong>Sophie Bernard</strong> (BNP) — Point d'étape, hésite sur le variable<br>• <strong>Alexandre Petit</strong> (Generali) — R1 en attente depuis 8j<br>• <strong>Delphine Adam</strong> (SG) — R1, attend infos commission<br><br>Veux-tu un email de relance pour l'un d'eux ?",
  email: "Voici un email de relance pour <strong>Thomas Dupont</strong> (Crédit Agricole, score 85) :<br><br><em>Objet : Un point sur votre projet d'indépendance ?</em><br><br>Bonjour Thomas,<br><br>Je souhaitais revenir vers vous. Seriez-vous disponible 20 minutes cette semaine pour voir ce que nos CGP gagnent concrètement à 12 mois ?<br><br>Cordialement, Baptiste — Evolve Investissement</em>",
  source: "En mars 2026, ta meilleure source en volume est <strong>Chasse LinkedIn</strong> (18 profils, 47% de taux R0→R1).<br><br>Mais la <strong>Recommandation</strong> a le meilleur taux de conversion : <strong>80%</strong> atteignent le R1. Canal très sous-exploité à développer.",
  pipeline: "État au 13 mars 2026 :<br><br>• R0 → <strong>11</strong> profils · R1 → <strong>4</strong> · Point d'étape → <strong>1</strong><br>• R2 Amaury → <strong>1</strong> (Marine Laurent, 18/03) · Démission → <strong>1</strong><br>• Point juridique → <strong>1</strong> · Recrutés → <strong>3</strong><br><br>⚠️ Goulot principal : <strong>R0→R1</strong>, −47% des profils.<br>Délai moyen R0→R1 : <strong>9 jours</strong>.<br>Prochaines intégrations : <strong>Julien Morel & Pierre Lefebvre</strong> — mai 2026.",
}

export default function ChatIA() {
  const [messages, setMessages] = useState([
    { role: 'ai', content: "Bonjour Baptiste ! Je suis ton assistant CRM Evolve.<br><br>Tu peux me demander :<br>— <em>Quels profils sont bloqués depuis +3 semaines ?</em><br>— <em>Rédige un email de relance pour Thomas Dupont</em><br>— <em>Quelle est ma meilleure source d'acquisition ?</em><br>— <em>État du pipeline</em>" },
  ])
  const [input, setInput] = useState('')
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = () => {
    const msg = input.trim()
    if (!msg) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'u', content: msg }])
    setTimeout(() => {
      const lc = msg.toLowerCase()
      let r = CR.pipeline
      if (lc.includes('bloqu') || lc.includes('inactif')) r = CR.bloqu
      else if (lc.includes('email') || lc.includes('relance')) r = CR.email
      else if (lc.includes('source') || lc.includes('acquisit') || lc.includes('meilleur')) r = CR.source
      setMessages((prev) => [...prev, { role: 'ai', content: r }])
    }, 650)
  }

  return (
    <div id="pg-chat" className="h-full flex flex-col overflow-hidden">
      <div className="cms flex-1 overflow-y-auto py-5 px-5 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={`cm flex gap-2.5 max-w-[80%] items-start ${m.role === 'u' ? 'u flex-row-reverse self-end' : ''}`}>
            <div className={`mav w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${m.role === 'ai' ? 'ai bg-[var(--accent)] text-[var(--gold)]' : 'u bg-[var(--gold)] text-[var(--accent)]'}`}>{m.role === 'ai' ? '✦' : 'B'}</div>
            <div className={`mb py-2.5 px-3.5 rounded-xl text-[13.5px] leading-relaxed ${m.role === 'ai' ? 'bg-[var(--surface)] border border-[var(--border)] rounded-tl rounded-tr rounded-br rounded-bl' : 'bg-[var(--accent)] text-white rounded-tr rounded-tl rounded-br rounded-bl'}`}>
              {typeof m.content === 'string' && m.content.includes('<') ? <span dangerouslySetInnerHTML={{ __html: m.content }} /> : m.content}
            </div>
          </div>
        ))}
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
        />
        <button type="button" className="csend w-[38px] h-[38px] rounded-lg bg-[var(--accent)] border-none cursor-pointer flex items-center justify-center text-white text-[17px] shrink-0 hover:bg-[var(--a2)] transition-colors" onClick={send}>↑</button>
      </div>
    </div>
  )
}
