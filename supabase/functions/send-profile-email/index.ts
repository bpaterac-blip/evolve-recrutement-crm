const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LOGO_URL = 'https://fcwzzrjhmjodterwjbbl.supabase.co/storage/v1/object/public/email-assets/unnamed%20(2).png'

const SENDERS: Record<string, {
  displayName: string
  title: string
  from: string
  photoUrl: string
  email: string
  phone: string
}> = {
  // Clés = email de connexion Supabase Auth
  'b.paterac@gmail.com': {
    displayName: 'Baptiste PATERAC',
    title: 'Associé &amp; Co-fondateur &nbsp;|&nbsp; Responsable de réseau régions',
    from: 'Baptiste Paterac <bpaterac@evolveinvestissement.com>',
    photoUrl: 'https://fcwzzrjhmjodterwjbbl.supabase.co/storage/v1/object/public/email-assets/unnamed%20(1).png',
    email: 'bpaterac@evolveinvestissement.com',
    phone: '06 38 37 59 60',
  },
  'agoutard@evolveinvestissement.com': {
    displayName: 'Aurélien GOUTARD',
    title: 'Associé &amp; Co-fondateur &nbsp;|&nbsp; Responsable de réseau IDF',
    from: 'Aurélien Goutard <agoutard@evolveinvestissement.com>',
    photoUrl: 'https://fcwzzrjhmjodterwjbbl.supabase.co/storage/v1/object/public/email-assets/unnamed%20(3).png',
    email: 'agoutard@evolveinvestissement.com',
    phone: '06 44 17 51 29',
  },
}

// Fallback = Baptiste
const DEFAULT_SENDER = SENDERS['b.paterac@gmail.com']

function buildSignatureHtml(sender: typeof DEFAULT_SENDER) {
  return `
  <table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-top:2px solid #D2AB76;padding-top:18px">
    <tr>
      <td style="padding-right:16px;vertical-align:top">
        <img src="${sender.photoUrl}" width="64" height="64"
          style="border-radius:50%;object-fit:cover;display:block"
          alt="${sender.displayName}" />
      </td>
      <td style="vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1A1A1A;line-height:1.7">
        <div style="font-weight:700;font-size:14px;color:#173731;letter-spacing:0.3px">${sender.displayName}</div>
        <div style="color:#666;font-size:12px;margin-bottom:2px">${sender.title}</div>
        <div style="color:#666;font-size:12px;margin-bottom:8px">Groupe Evolve</div>
        <img src="${LOGO_URL}" height="26" alt="Evolve" style="display:block;margin-bottom:10px" />
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-right:8px;vertical-align:middle">
              <div style="width:16px;height:16px;background:#173731;border-radius:3px;text-align:center;line-height:16px">
                <span style="color:#D2AB76;font-size:10px;font-family:Arial">@</span>
              </div>
            </td>
            <td><a href="mailto:${sender.email}" style="color:#173731;text-decoration:none;font-size:12px">${sender.email}</a></td>
          </tr>
          <tr><td colspan="2" style="height:4px"></td></tr>
          <tr>
            <td style="padding-right:8px;vertical-align:middle">
              <div style="width:16px;height:16px;background:#173731;border-radius:3px;text-align:center;line-height:16px">
                <span style="color:#D2AB76;font-size:9px;font-family:Arial;font-weight:bold">T</span>
              </div>
            </td>
            <td><span style="color:#444;font-size:12px">${sender.phone}</span></td>
          </tr>
          <tr><td colspan="2" style="height:4px"></td></tr>
          <tr>
            <td style="padding-right:8px;vertical-align:middle">
              <div style="width:16px;height:16px;background:#173731;border-radius:3px;text-align:center;line-height:16px">
                <span style="color:#D2AB76;font-size:9px;font-family:Arial;font-weight:bold">W</span>
              </div>
            </td>
            <td><a href="https://groupe-evolve.fr" style="color:#173731;text-decoration:none;font-size:12px">https://groupe-evolve.fr</a></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, body, userEmail } = await req.json()

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

    // Sélectionner la signature selon l'utilisateur connecté
    const sender = (userEmail && SENDERS[userEmail]) ? SENDERS[userEmail] : DEFAULT_SENDER
    const SIGNATURE_HTML = buildSignatureHtml(sender)

    // Retirer la partie signature texte avant de construire le HTML
    const bodyWithoutSig = body.replace(/\n\nBaptiste PATERAC[\s\S]*$/, '')
                               .replace(/\n\nAurélien GOUTARD[\s\S]*$/, '')
                               .trim()

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
        from: sender.from,
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
