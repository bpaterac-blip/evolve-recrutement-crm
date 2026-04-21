const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PHOTO_URL = 'https://fcwzzrjhmjodterwjbbl.supabase.co/storage/v1/object/public/email-assets/unnamed%20(1).png'
const LOGO_URL  = 'https://fcwzzrjhmjodterwjbbl.supabase.co/storage/v1/object/public/email-assets/unnamed%20(2).png'

const SIGNATURE_HTML = `
  <table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-top:1px solid #E5E0D8;padding-top:18px">
    <tr>
      <td style="padding-right:16px;vertical-align:top">
        <img src="${PHOTO_URL}" width="64" height="64"
          style="border-radius:50%;object-fit:cover;display:block"
          alt="Baptiste PATERAC" />
      </td>
      <td style="vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1A1A1A;line-height:1.6">
        <div style="font-weight:700;font-size:14px;color:#173731">Baptiste PATERAC</div>
        <div style="color:#555;font-size:12px">Associé &amp; Co-fondateur · Responsable de réseau régions</div>
        <div style="margin-top:6px">
          <img src="${LOGO_URL}" height="28" alt="Evolve" style="display:block;margin-bottom:8px" />
        </div>
        <div style="font-size:12px;color:#444">
          <a href="mailto:bpaterac@evolveinvestissement.com" style="color:#173731;text-decoration:none">📧 bpaterac@evolveinvestissement.com</a><br>
          <span>📱 06 38 37 59 60</span><br>
          <a href="https://groupe-evolve.fr" style="color:#173731;text-decoration:none">🌐 groupe-evolve.fr</a>
        </div>
      </td>
    </tr>
  </table>
`

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

    // Corps du message (texte → HTML propre, sans la signature texte en bas)
    // On retire la signature texte brute si elle est présente
    const bodyWithoutSig = body.replace(/\nBien cordialement[\s\S]*$/, '').trim()

    const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9f7f4">
  <div style="max-width:600px;margin:0 auto;background:white;padding:32px 36px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1A1A1A;line-height:1.7">

    ${bodyWithoutSig
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/🔗 Lien de connexion : (https?:\/\/\S+)/g, '🔗 <a href="$1" style="color:#173731">Lien de connexion</a>')
      .replace(/\n\n/g, '</p><p style="margin:14px 0">')
      .replace(/\n/g, '<br>')}

    ${SIGNATURE_HTML}

  </div>
</body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Baptiste Paterac <baptiste@evolveinvestissement.com>',
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
