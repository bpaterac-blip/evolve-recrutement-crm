import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadScoringConfig } from '../lib/scoringConfig'

const ACCENT = '#173731'
const GOLD = '#D2AB76'
const ORANGE = '#F97316'

const IconBrain = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0-.34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>
)

export default function AdminScoringLearning() {
  const navigate = useNavigate()
  const [feedback, setFeedback] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [applying, setApplying] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data: fb } = await supabase.from('scoring_feedback').select('*').order('created_at', { ascending: false })
    setFeedback(fb || [])
    const ids = [...new Set((fb || []).map((f) => f.profile_id))]
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, first_name, last_name, company').in('id', ids)
      setProfiles(Object.fromEntries((profs || []).map((p) => [p.id, p])))
    } else {
      setProfiles({})
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalCorrections = feedback.length
  const avgBefore = feedback.length ? Math.round(feedback.reduce((a, f) => a + (f.previous_score || 0), 0) / feedback.length) : 0
  const avgAfter = feedback.length ? Math.round(feedback.reduce((a, f) => a + (f.new_score || 0), 0) / feedback.length) : 0

  const reasonCounts = {}
  feedback.forEach((f) => {
    const r = (f.feedback_note || f.reason || 'Autre').slice(0, 50)
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
    const correctionsText = feedback.slice(0, 50).map((f) => {
      const p = profiles[f.profile_id]
      return `- ${p?.first_name || ''} ${p?.last_name || ''} (${p?.company || '—'}): ${f.previous_score} → ${f.new_score} — ${(f.feedback_note || f.reason || '').slice(0, 150)}`
    }).join('\n')

    const systemPrompt = `Tu es un expert en scoring de prospects CGP. Voici les corrections manuelles apportées au scoring :
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

  return (
    <div className="page h-full overflow-y-auto p-[22px]" style={{ color: 'var(--text)' }}>
      <div className="flex items-center gap-3 mb-5">
        <button type="button" onClick={() => navigate('/admin/console')} className="text-[13px] text-[var(--t3)] hover:text-[var(--accent)]">← Retour</button>
        <h1 className="font-serif text-[22px] mb-0" style={{ color: ACCENT }}>Apprentissage Scoring</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-[10px] border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Corrections enregistrées</div>
          <div className="text-[26px] font-semibold">{totalCorrections}</div>
        </div>
        <div className="rounded-[10px] border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Score moyen avant</div>
          <div className="text-[26px] font-semibold">{avgBefore}</div>
        </div>
        <div className="rounded-[10px] border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-1">Score moyen après</div>
          <div className="text-[26px] font-semibold" style={{ color: ACCENT }}>{avgAfter}</div>
        </div>
      </div>

      {topReasons.length > 0 && (
        <div className="mb-6 rounded-[10px] border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="text-[11.5px] text-[var(--t3)] uppercase tracking-wider mb-2">Top 3 raisons de correction</div>
          <ol className="list-decimal list-inside space-y-1 text-[13px]">
            {topReasons.map(([r, n], i) => (
              <li key={i}>{r}… <span className="text-[var(--t3)]">({n}x)</span></li>
            ))}
          </ol>
        </div>
      )}

      {/* Table */}
      <div className="rounded-[10px] border overflow-hidden mb-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="py-3 px-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <span className="font-semibold text-sm">Liste des corrections</span>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || !feedback.length}
            className="py-1.5 px-3 rounded-lg text-[13px] font-medium disabled:opacity-50"
            style={{ backgroundColor: GOLD, color: ACCENT }}
          >
            {analyzing ? 'Analyse…' : 'Analyser'}
          </button>
        </div>
        {loading ? (
          <div className="py-8 text-center text-[var(--t3)]">Chargement…</div>
        ) : feedback.length === 0 ? (
          <div className="py-8 text-center text-[var(--t3)]">Aucune correction enregistrée</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr style={{ backgroundColor: 'var(--s2)' }}>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Profil</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Employeur</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Score initial</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Score corrigé</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Raison</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Date</th>
                  <th className="text-left text-[11px] font-medium uppercase tracking-wider text-[var(--t3)] py-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>Auteur</th>
                </tr>
              </thead>
              <tbody>
                {feedback.map((f) => {
                  const p = profiles[f.profile_id]
                  return (
                    <tr key={f.id} className="border-b hover:bg-[#F8F5F1]" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2.5 px-4 text-[13.5px]">{p ? `${p.first_name || ''} ${p.last_name || ''}` : '—'}</td>
                      <td className="py-2.5 px-4 text-[13px]">{p?.company || '—'}</td>
                      <td className="py-2.5 px-4">{f.previous_score ?? '—'}</td>
                      <td className="py-2.5 px-4 font-medium" style={{ color: ACCENT }}>{f.new_score}</td>
                      <td className="py-2.5 px-4 text-[12px] max-w-[200px] truncate" title={f.feedback_note || f.reason}>{(f.feedback_note || f.reason || '—').slice(0, 60)}…</td>
                      <td className="py-2.5 px-4 text-[12px]" style={{ color: 'var(--t2)' }}>{fmt(f.created_at)}</td>
                      <td className="py-2.5 px-4 text-[12px]">{f.author || '—'}</td>
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
        <div className="rounded-[10px] border p-5 mb-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
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
  )
}
