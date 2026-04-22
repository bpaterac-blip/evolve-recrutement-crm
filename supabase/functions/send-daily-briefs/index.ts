import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Config visuelle ────────────────────────────────────────────────────────────
const LOGO_URL  = 'https://fcwzzrjhmjodterwjbbl.supabase.co/storage/v1/object/public/email-assets/unnamed%20(2).png'
const ACCENT    = '#173731'
const GOLD      = '#D2AB76'
const BG        = '#F5F0E8'

// ── Étapes qui déclenchent un brief IA ────────────────────────────────────────
const BRIEF_STAGES = ['R1', 'Point Business Plan', "Point d'étape", "Point d'étape téléphonique"]

// ── Email destinataire R2 Amaury ───────────────────────────────────────────────
// ⚠️  Remplacer par l'email réel d'Amaury
const AMAURY_EMAIL = 'amaurydubuisson@evolveinvestissement.com'

// ── Expéditeurs (même map que send-profile-email) ─────────────────────────────
const SENDERS: Record<string, { displayName: string; from: string; toEmail: string }> = {
  'b.paterac@gmail.com':            { displayName: 'Baptiste PATERAC', from: 'Baptiste Paterac <bpaterac@evolveinvestissement.com>', toEmail: 'bpaterac@evolveinvestissement.com' },
  'bpaterac@evolveinvestissement.com': { displayName: 'Baptiste PATERAC', from: 'Baptiste Paterac <bpaterac@evolveinvestissement.com>', toEmail: 'bpaterac@evolveinvestissement.com' },
  'agoutard@evolveinvestissement.com': { displayName: 'Aurélien GOUTARD', from: 'Aurélien Goutard <agoutard@evolveinvestissement.com>', toEmail: 'agoutard@evolveinvestissement.com' },
}
const DEFAULT_SENDER = SENDERS['bpaterac@evolveinvestissement.com']

function resolveSender(ownerEmail: string | null) {
  if (!ownerEmail) return DEFAULT_SENDER
  return SENDERS[ownerEmail] ?? DEFAULT_SENDER
}

// ── Helpers date / heure ───────────────────────────────────────────────────────
function todayUTC(): string {
  return new Date().toISOString().split('T')[0]
}

function tomorrowUTC(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().split('T')[0]
}

function fmtDateLong(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

function fmtTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}h${m}`
}

// ── Appel Claude pour générer le brief ────────────────────────────────────────
async function generateBrief(
  profile: Record<string, any>,
  notes: Array<{ content: string; created_at: string }>,
  apiKey: string,
): Promise<{ resume: string; pointsAppui: string }> {

  const notesContext = notes.length > 0
    ? notes
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((n, i) => {
          const d = new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
          return `[Note ${i + 1} — ${d}]\n${n.content}`
        })
        .join('\n\n')
    : 'Aucune note disponible.'

  const stage = profile.stage ?? '—'
  const systemPrompt = `Tu es un assistant expert en recrutement de CGP pour Evolve Investissement.
Tu aides Baptiste et Aurélien à préparer leurs rendez-vous de recrutement.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant ou après le JSON.`

  const userPrompt = `Profil : ${profile.first_name ?? ''} ${profile.last_name ?? ''} | ${profile.company ?? ''} | ${profile.title ?? ''} | ${profile.region ?? ''} | Stage : ${stage} | Score : ${profile.score ?? '—'}/110 | Maturité : ${profile.maturity ?? '—'}

Notes chronologiques :
${notesContext}

Génère un brief de préparation pour le ${stage}. Réponds avec ce JSON exact, sans rien d'autre :
{"resume":"3 à 5 points clés des échanges passés, chaque point sur une ligne commençant par - ","pointsAppui":"3 à 5 angles actionnables pour le ${stage}, chaque point sur une ligne commençant par - "}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  const data = await res.json()
  const text: string = data.content?.[0]?.text ?? ''

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? text)
    return {
      resume:      (parsed.resume      ?? '').trim(),
      pointsAppui: (parsed.pointsAppui ?? '').trim(),
    }
  } catch {
    // Fallback : tout dans le résumé
    return { resume: text.trim(), pointsAppui: '' }
  }
}

// ── Construction du HTML de l'email ──────────────────────────────────────────
function mdToHtml(md: string): string {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin:6px 0;padding-left:4px">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>)/g, '<ul style="margin:10px 0;padding-left:18px">$1</ul>')
    .replace(/<\/ul>\s*<ul[^>]*>/g, '')  // fusionner listes consécutives
    .replace(/\n\n/g, '</p><p style="margin:10px 0">')
    .replace(/\n/g, '<br>')
}

function buildEmailHtml(
  profile: Record<string, any>,
  resume: string,
  pointsAppui: string,
  senderDisplayName: string,
): string {
  const fullName  = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
  const stage     = profile.stage ?? '—'
  const time      = fmtTime(profile.next_event_date)
  const dateLabel = fmtDateLong(todayUTC())

  const scoreColor = (s: number | null): string => {
    if (s == null) return '#888'
    if (s >= 75) return '#16a34a'
    if (s >= 50) return '#f59e0b'
    return '#ef4444'
  }

  const sc = profile.score
  const scorePct = sc != null ? Math.min(100, Math.round((sc / 110) * 100)) : 0
  const scColor  = scoreColor(sc)

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ece4">
<div style="max-width:620px;margin:0 auto;background:white;font-family:Arial,Helvetica,sans-serif">

  <!-- En-tête -->
  <div style="background:${ACCENT};padding:28px 32px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <img src="${LOGO_URL}" height="28" alt="Evolve" style="display:block" />
    </div>
    <div style="margin-top:16px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(210,171,118,0.7);margin-bottom:6px">Brief IA · ${dateLabel}</div>
      <div style="font-size:22px;font-weight:700;color:white;letter-spacing:0.2px">${fullName}</div>
      <div style="margin-top:8px;display:inline-block;background:${GOLD};color:${ACCENT};font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:0.3px">${stage}${time ? ` · ${time}` : ''}</div>
    </div>
  </div>

  <div style="padding:28px 32px">

    <!-- Snapshot profil -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;background:${BG};border-radius:10px;overflow:hidden">
      <tr>
        <td style="padding:16px 20px;border-right:1px solid #E5E0D8;width:50%;vertical-align:top">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#999;margin-bottom:8px">Profil</div>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="padding:3px 0;font-size:11px;color:#888;width:80px">Employeur</td><td style="padding:3px 0;font-size:12px;color:#1A1A1A;font-weight:500">${profile.company ?? '—'}</td></tr>
            <tr><td style="padding:3px 0;font-size:11px;color:#888">Poste</td><td style="padding:3px 0;font-size:12px;color:#1A1A1A">${profile.title ?? '—'}</td></tr>
            <tr><td style="padding:3px 0;font-size:11px;color:#888">Région</td><td style="padding:3px 0;font-size:12px;color:#1A1A1A">${profile.region ?? '—'}</td></tr>
            <tr><td style="padding:3px 0;font-size:11px;color:#888">Maturité</td><td style="padding:3px 0;font-size:12px;color:#1A1A1A">${profile.maturity ?? '—'}</td></tr>
          </table>
        </td>
        <td style="padding:16px 20px;width:50%;vertical-align:top">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#999;margin-bottom:8px">Score IA</div>
          <div style="font-size:30px;font-weight:700;color:${scColor};line-height:1">${sc ?? '—'}</div>
          <div style="font-size:10px;color:#aaa;margin-bottom:8px">/ 110 pts</div>
          <div style="height:6px;background:#E8E4DD;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${scorePct}%;background:${scColor};border-radius:3px"></div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Résumé des échanges -->
    <div style="margin-bottom:24px">
      <div style="font-size:13px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid ${GOLD};padding-bottom:6px;margin-bottom:14px">
        📋 Résumé des échanges
      </div>
      <div style="font-size:13px;color:#333;line-height:1.7">
        <p style="margin:10px 0">${mdToHtml(resume)}</p>
      </div>
    </div>

    <!-- Points d'appui -->
    <div style="margin-bottom:28px">
      <div style="font-size:13px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid ${GOLD};padding-bottom:6px;margin-bottom:14px">
        🎯 Points d'appui pour ce RDV
      </div>
      <div style="font-size:13px;color:#333;line-height:1.7">
        <p style="margin:10px 0">${mdToHtml(pointsAppui)}</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #E5E0D8;padding-top:16px;font-size:11px;color:#aaa;text-align:center">
      Brief généré automatiquement par Evolve Recruiter · Bon ${stage} à toi, ${senderDisplayName.split(' ')[0]} 👊
    </div>

  </div>
</div>
</body></html>`
}

// ── Handler principal ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    const RESEND_API_KEY    = Deno.env.get('RESEND_API_KEY')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY manquante')
    if (!RESEND_API_KEY)    throw new Error('RESEND_API_KEY manquante')

    const today    = todayUTC()
    const tomorrow = tomorrowUTC()

    // ── 1. Chercher les profils avec un RDV aujourd'hui ──────────────────────
    const { data: profilesRaw, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, company, title, region, email, stage, maturity, score, next_event_date, next_event_label, owner_email, owner_full_name')
      .in('stage', [...BRIEF_STAGES, 'R2 Amaury'])
      .gte('next_event_date', `${today}T00:00:00`)
      .lt('next_event_date', `${tomorrow}T00:00:00`)

    if (profilesErr) throw new Error(`Supabase profiles: ${profilesErr.message}`)

    const profiles = profilesRaw ?? []
    if (profiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Aucun RDV prévu aujourd'hui", date: today }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    const results: Array<{ profile: string; stage: string; sent_to: string; ok: boolean; error?: string }> = []

    for (const profile of profiles) {
      try {
        // ── 2. Récupérer les notes du profil ──────────────────────────────
        const { data: notes } = await supabase
          .from('notes')
          .select('content, created_at')
          .eq('profile_id', profile.id)
          .order('created_at', { ascending: true })

        const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
        const stage    = profile.stage ?? '—'
        const time     = fmtTime(profile.next_event_date)

        // ── 3. Déterminer le destinataire ─────────────────────────────────
        let recipientEmail: string
        let senderConfig: typeof DEFAULT_SENDER

        if (stage === 'R2 Amaury') {
          // Envoyer à Amaury + copie au référent
          recipientEmail = AMAURY_EMAIL
          senderConfig   = resolveSender(profile.owner_email)
        } else {
          senderConfig   = resolveSender(profile.owner_email)
          recipientEmail = senderConfig.toEmail
        }

        // ── 4. Générer le brief via Claude ────────────────────────────────
        const { resume, pointsAppui, _rawText } = await generateBrief(
          profile,
          notes ?? [],
          ANTHROPIC_API_KEY,
        )

        // ── 5. Construire et envoyer l'email ──────────────────────────────
        const subject = `🤖 Brief IA — ${fullName} · ${stage}${time ? ` à ${time}` : ''}`
        const html    = buildEmailHtml(profile, resume, pointsAppui, senderConfig.displayName)

        const toList = stage === 'R2 Amaury'
          ? [recipientEmail, senderConfig.toEmail].filter((v, i, a) => a.indexOf(v) === i)
          : [recipientEmail]

        const resend = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from:    senderConfig.from,
            to:      toList,
            subject,
            html,
          }),
        })

        const resendData = await resend.json()
        if (!resend.ok) throw new Error(JSON.stringify(resendData))

        results.push({ profile: fullName, stage, sent_to: toList.join(', '), ok: true, notesCount: (notes ?? []).length, rawBrief: _rawText })

      } catch (err: any) {
        const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
        results.push({ profile: fullName, stage: profile.stage ?? '—', sent_to: '', ok: false, error: err.message })
      }
    }

    return new Response(
      JSON.stringify({ success: true, date: today, count: profiles.length, results }),
      { headers: { 'Content-Type': 'application/json' } },
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
