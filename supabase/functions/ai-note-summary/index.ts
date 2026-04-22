const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { rawNote, profile } = await req.json()

    if (!rawNote?.trim()) {
      return new Response(
        JSON.stringify({ error: 'rawNote est requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY non configurée dans les secrets Supabase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Construire le contexte profil
    const profileContext = profile ? [
      profile.fn && profile.ln ? `Prénom Nom : ${profile.fn} ${profile.ln}` : null,
      profile.co ? `Employeur actuel : ${profile.co}` : null,
      profile.ti ? `Intitulé de poste : ${profile.ti}` : null,
      profile.stg ? `Étape pipeline : ${profile.stg}` : null,
      profile.mat ? `Maturité : ${profile.mat}` : null,
      profile.region ? `Région : ${profile.region}` : null,
    ].filter(Boolean).join('\n') : ''

    const systemPrompt = `Tu es un assistant expert en recrutement de Conseillers en Gestion de Patrimoine (CGP) pour Evolve Investissement.
Tu aides Baptiste et Aurélien à synthétiser leurs échanges avec des prospects CGP en vue de leur recrutement vers l'indépendance.
Tu réponds toujours en français, de manière concise et professionnelle.`

    const userPrompt = `${profileContext ? `## Contexte du profil\n${profileContext}\n\n` : ''}## Note brute de l'échange
${rawNote.trim()}

---

À partir de cette note, génère un récapitulatif structuré avec exactement ce format :

**📋 Résumé de l'échange**
- [point clé 1]
- [point clé 2]
- [point clé 3]
(ajoute d'autres points si pertinent)

**💡 Éléments clés à retenir**
- [information importante sur le profil, motivation, situation, objection…]
- [autre élément clé]

**🎯 Points d'appui pour le prochain RDV**
- [angle ou argument à utiliser lors du prochain échange]
- [question ou sujet à approfondir]
- [élément sur lequel rebondir]

Sois factuel, direct, et utile. Pas d'introduction ni de conclusion.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const summary = data.content?.[0]?.text || ''

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
