/**
 * Consolidation automatique : synthétise des scoring_feedback non consolidés
 * en nouvelles lignes scoring_instructions (auto_generated).
 */

export async function consolidateLearning(supabaseClient, anthropicKey) {
  if (!supabaseClient || !anthropicKey) return null

  const { data: rows, error: fetchErr } = await supabaseClient
    .from('scoring_feedback')
    .select('*')
    .or('consolidated.is.null,consolidated.eq.false')
    .order('created_at', { ascending: false })

  if (fetchErr) {
    console.error('consolidateLearning fetch', fetchErr)
    return null
  }

  const feedbacks = (rows || []).filter((f) => f.consolidated !== true)
  if (!feedbacks.length || feedbacks.length < 3) return null

  const lines = feedbacks
    .map((f) => {
      const orig = f.original_score ?? f.previous_score
      const corr = f.corrected_score ?? f.new_score
      const co = f.profile_data?.company ?? '—'
      const ti = f.profile_data?.title ?? '—'
      const reas = f.reason || f.feedback_note || ''
      return `- ${co} "${ti}" : ${orig} → ${corr}. Raison : ${reas}`
    })
    .join('\n')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `Tu es un expert en recrutement CGP. 
      Analyse ces corrections de scoring et génère 
      des règles claires et concises à retenir pour 
      les prochains scorings. 
      Réponds UNIQUEMENT en JSON : 
      {"rules": ["règle 1", "règle 2", ...]}
      Maximum 5 règles, chacune en une phrase courte.`,
      messages: [
        {
          role: 'user',
          content: `Voici les corrections validées :\n${lines}\n\nGénère des règles synthétiques à retenir.`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    console.error('consolidateLearning API error', response.status, err)
    return null
  }

  const data = await response.json()
  const text = data.content?.[0]?.text || '{}'
  let rules = []
  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    const jsonStr = cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned
    const parsed = JSON.parse(jsonStr)
    rules = Array.isArray(parsed.rules) ? parsed.rules : []
  } catch (e) {
    console.error('consolidateLearning parse', e, text)
    return null
  }

  rules = rules.map((r) => String(r).trim()).filter(Boolean).slice(0, 5)
  if (!rules.length) return null

  for (const rule of rules) {
    const { error: insErr } = await supabaseClient.from('scoring_instructions').insert({
      content: rule,
      updated_by: 'IA (consolidation automatique)',
      updated_at: new Date().toISOString(),
      auto_generated: true,
    })
    if (insErr) console.error('consolidateLearning insert instruction', insErr)
  }

  const ids = feedbacks.map((f) => f.id)
  const { error: upErr } = await supabaseClient.from('scoring_feedback').update({ consolidated: true }).in('id', ids)
  if (upErr) console.error('consolidateLearning mark consolidated', upErr)

  return rules
}
