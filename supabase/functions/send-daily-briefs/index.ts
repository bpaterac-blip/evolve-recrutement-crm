import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Config visuelle ────────────────────────────────────────────────────────────
const LOGO_URL = 'https://fcwzzrjhmjodterwjbbl.supabase.co/storage/v1/object/public/email-assets/unnamed%20(2).png'
const ACCENT   = '#173731'
const GOLD     = '#D2AB76'
const BG       = '#F5F0E8'

// ── Étapes qui déclenchent un brief ───────────────────────────────────────────
const BRIEF_STAGES = ['R1', 'Point Business Plan', "Point d'étape", "Point d'étape téléphonique"]

// ── Email destinataire R2 Amaury ───────────────────────────────────────────────
const AMAURY_EMAIL = 'amaurydubuisson@evolveinvestissement.com'

// ── Expéditeurs ────────────────────────────────────────────────────────────────
const SENDERS: Record<string, { displayName: string; from: string; toEmail: string }> = {
  'b.paterac@gmail.com':               { displayName: 'Baptiste PATERAC', from: 'Baptiste Paterac <bpaterac@evolveinvestissement.com>', toEmail: 'bpaterac@evolveinvestissement.com' },
  'bpaterac@evolveinvestissement.com': { displayName: 'Baptiste PATERAC', from: 'Baptiste Paterac <bpaterac@evolveinvestissement.com>', toEmail: 'bpaterac@evolveinvestissement.com' },
  'agoutard@evolveinvestissement.com': { displayName: 'Aurélien GOUTARD', from: 'Aurélien Goutard <agoutard@evolveinvestissement.com>', toEmail: 'agoutard@evolveinvestissement.com' },
}
const DEFAULT_SENDER = SENDERS['bpaterac@evolveinvestissement.com']

function resolveSender(ownerEmail: string | null) {
  if (!ownerEmail) return DEFAULT_SENDER
  return SENDERS[ownerEmail] ?? DEFAULT_SENDER
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function todayUTC()    { return new Date().toISOString().split('T')[0] }
function tomorrowUTC() { const d = new Date(); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().split('T')[0] }

function fmtDateLong(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

function fmtTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`
}

function fmtNoteDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Convertir markdown basique en HTML email-safe ─────────────────────────────
function noteToHtml(text: string): string {
  const lines = text.split('\n')
  let html = ''
  let inList = false

  for (const raw of lines) {
    const line = raw
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

    if (/^[-•]\s/.test(raw)) {
      if (!inList) { html += '<ul style="margin:8px 0;padding-left:20px">'; inList = true }
      html += `<li style="margin:4px 0;color:#333;font-size:13px">${line.replace(/^[-•]\s/, '')}</li>`
    } else {
      if (inList) { html += '</ul>'; inList = false }
      if (line.trim() === '') {
        html += '<div style="height:8px"></div>'
      } else if (/^#{1,3}\s/.test(raw) || (raw.startsWith('**') && raw.endsWith('**'))) {
        html += `<div style="font-weight:700;color:${ACCENT};font-size:13px;margin:12px 0 4px">${line.replace(/^#+\s/, '')}</div>`
      } else {
        html += `<div style="font-size:13px;color:#333;line-height:1.6;margin:2px 0">${line}</div>`
      }
    }
  }
  if (inList) html += '</ul>'
  return html
}

// ── Construire le bloc HTML d'une note ────────────────────────────────────────
function buildNoteBlock(note: { content: string; created_at: string }, index: number): string {
  const isAI = note.content.includes('✨') || note.content.startsWith('✨')
  const dateLabel = fmtNoteDate(note.created_at)
  const tag = isAI
    ? `<span style="background:#F0FDF4;color:#16a34a;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;border:1px solid #BBF7D0">✨ Récap IA</span>`
    : `<span style="background:#F5F3EF;color:#888;font-size:10px;font-weight:500;padding:2px 8px;border-radius:10px;border:1px solid #E5E0D8">Note</span>`

  return `
  <div style="background:white;border:1px solid #E8E4DD;border-radius:10px;padding:16px 20px;margin-bottom:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      ${tag}
      <span style="font-size:11px;color:#aaa">${dateLabel}</span>
    </div>
    <div>${noteToHtml(note.content)}</div>
  </div>`
}

// ── Construire l'email complet ─────────────────────────────────────────────────
function buildEmailHtml(
  profile: Record<string, any>,
  notes: Array<{ content: string; created_at: string }>,
  senderDisplayName: string,
): string {
  const fullName  = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
  const stage     = profile.stage ?? '—'
  const time      = fmtTime(profile.next_event_date)
  const dateLabel = fmtDateLong(todayUTC())

  const sc = profile.score
  const scorePct = sc != null ? Math.min(100, Math.round((sc / 110) * 100)) : 0
  const scColor  = sc == null ? '#888' : sc >= 75 ? '#16a34a' : sc >= 50 ? '#f59e0b' : '#ef4444'

  // Trier les notes : plus récentes en premier, max 5
  const sortedNotes = [...notes]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  const notesHtml = sortedNotes.length > 0
    ? sortedNotes.map((n, i) => buildNoteBlock(n, i)).join('')
    : `<div style="padding:20px;text-align:center;color:#aaa;font-size:13px;background:white;border:1px solid #E8E4DD;border-radius:10px">Aucune note disponible pour ce profil.</div>`

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ece4">
<div style="max-width:620px;margin:0 auto;background:white;font-family:Arial,Helvetica,sans-serif">

  <!-- En-tête -->
  <div style="background:${ACCENT};padding:28px 32px">
    <img src="${LOGO_URL}" height="26" alt="Evolve" style="display:block;margin-bottom:16px" />
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(210,171,118,0.7);margin-bottom:6px">Brief RDV · ${dateLabel}</div>
    <div style="font-size:24px;font-weight:700;color:white;letter-spacing:0.2px">${fullName}</div>
    <div style="margin-top:10px">
      <span style="display:inline-block;background:${GOLD};color:${ACCENT};font-size:12px;font-weight:700;padding:4px 14px;border-radius:20px">${stage}${time ? ` · ${time}` : ''}</span>
    </div>
  </div>

  <div style="padding:24px 32px;background:${BG}">

    <!-- Snapshot profil -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;background:white;border:1px solid #E8E4DD;border-radius:10px;overflow:hidden">
      <tr>
        <td style="padding:16px 20px;border-right:1px solid #E8E4DD;width:55%;vertical-align:top">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#aaa;margin-bottom:10px">Profil</div>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="padding:3px 0;font-size:11px;color:#999;width:75px">Employeur</td><td style="padding:3px 0;font-size:12px;color:#1A1A1A;font-weight:600">${profile.company ?? '—'}</td></tr>
            <tr><td style="padding:3px 0;font-size:11px;color:#999">Poste</td><td style="padding:3px 0;font-size:12px;color:#333">${profile.title ?? '—'}</td></tr>
            <tr><td style="padding:3px 0;font-size:11px;color:#999">Région</td><td style="padding:3px 0;font-size:12px;color:#333">${profile.region ?? '—'}</td></tr>
            <tr><td style="padding:3px 0;font-size:11px;color:#999">Maturité</td><td style="padding:3px 0;font-size:12px;color:#333">${profile.maturity ?? '—'}</td></tr>
          </table>
        </td>
        <td style="padding:16px 20px;width:45%;vertical-align:middle;text-align:center">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#aaa;margin-bottom:8px">Score IA</div>
          <div style="font-size:38px;font-weight:700;color:${scColor};line-height:1">${sc ?? '—'}</div>
          <div style="font-size:10px;color:#ccc;margin-bottom:10px">/ 110 pts</div>
          <div style="height:6px;background:#F0EDE8;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${scorePct}%;background:${scColor};border-radius:3px"></div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Notes -->
    <div style="font-size:12px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid ${GOLD}">
      📋 Notes (${sortedNotes.length})
    </div>
    ${notesHtml}

    <!-- Footer -->
    <div style="text-align:center;padding-top:16px;font-size:11px;color:#bbb">
      Brief automatique · Evolve Recruiter · Bon ${stage} à toi, ${senderDisplayName.split(' ')[0]} 👊
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
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY manquante')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const today    = todayUTC()
    const tomorrow = tomorrowUTC()

    console.log(`[send-daily-briefs] Date: ${today}, searching RDVs...`)

    // ── 1. Chercher les profils avec un RDV aujourd'hui ──────────────────────
    const { data: profilesRaw, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, company, title, region, stage, maturity, score, next_event_date, owner_email, owner_full_name')
      .in('stage', [...BRIEF_STAGES, 'R2 Amaury'])
      .gte('next_event_date', `${today}T00:00:00`)
      .lt('next_event_date', `${tomorrow}T00:00:00`)

    if (profilesErr) throw new Error(`Supabase profiles: ${profilesErr.message}`)

    const profiles = profilesRaw ?? []
    console.log(`[send-daily-briefs] Found ${profiles.length} profiles with RDV today`)

    if (profiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Aucun RDV prevu aujourd'hui", date: today }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    const results: Array<{ profile: string; stage: string; sent_to: string; notesCount: number; ok: boolean; error?: string }> = []

    for (const profile of profiles) {
      try {
        // ── 2. Récupérer les notes ────────────────────────────────────────
        const { data: notes, error: notesErr } = await supabase
          .from('notes')
          .select('content, created_at')
          .eq('profile_id', profile.id)
          .order('created_at', { ascending: false })

        if (notesErr) console.log(`[send-daily-briefs] Notes error for ${profile.id}: ${notesErr.message}`)

        const fullName     = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
        const stage        = profile.stage ?? '—'
        const time         = fmtTime(profile.next_event_date)
        const notesList    = notes ?? []

        console.log(`[send-daily-briefs] ${fullName} (${stage}): ${notesList.length} notes`)

        // ── 3. Déterminer expéditeur et destinataire ──────────────────────
        const senderConfig = resolveSender(profile.owner_email)
        const toList = stage === 'R2 Amaury'
          ? [AMAURY_EMAIL, senderConfig.toEmail].filter((v, i, a) => v && a.indexOf(v) === i)
          : [senderConfig.toEmail]

        // ── 4. Construire et envoyer l'email ──────────────────────────────
        const subject = `📋 Brief RDV — ${fullName} · ${stage}${time ? ` à ${time}` : ''}`
        const html    = buildEmailHtml(profile, notesList, senderConfig.displayName)

        console.log(`[send-daily-briefs] Sending to ${toList.join(', ')} for ${fullName}`)

        const resend = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: senderConfig.from, to: toList, subject, html }),
        })

        const resendData = await resend.json()
        if (!resend.ok) throw new Error(`Resend: ${JSON.stringify(resendData)}`)

        console.log(`[send-daily-briefs] Email sent OK for ${fullName}`)
        results.push({ profile: fullName, stage, sent_to: toList.join(', '), notesCount: notesList.length, ok: true })

      } catch (err: any) {
        const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
        console.log(`[send-daily-briefs] ERROR for ${fullName}: ${err.message}`)
        results.push({ profile: fullName, stage: profile.stage ?? '—', sent_to: '', notesCount: 0, ok: false, error: err.message })
      }
    }

    return new Response(
      JSON.stringify({ success: true, date: today, count: profiles.length, results }),
      { headers: { 'Content-Type': 'application/json' } },
    )

  } catch (err: any) {
    console.log(`[send-daily-briefs] FATAL: ${err.message}`)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
