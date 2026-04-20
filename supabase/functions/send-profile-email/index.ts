const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, body } = await req.json()

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: 'Champs manquants : to, subject, body requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY non configurée dans les secrets Supabase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convertit le texte brut en HTML simple
    const htmlBody = `
      <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A1A;line-height:1.7;font-size:14px">
        ${body
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n\n/g, '</p><p style="margin:12px 0">')
          .replace(/\n/g, '<br>')}
        <hr style="border:none;border-top:1px solid #E5E0D8;margin:28px 0 16px">
        <div style="font-size:11px;color:#AAA;text-align:center">Evolve Investissement</div>
      </div>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Baptiste Paterac <baptiste@evolve-investissement.fr>',
        to: [to],
        subject,
        html: htmlBody,
        text: body,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: data }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
