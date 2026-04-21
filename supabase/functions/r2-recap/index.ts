import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ACCENT = '#173731'
const GOLD = '#D2AB76'

const ASPECTS_PERSONNELS = [
  { key: 'premiere_impression', label: 'Première impression' },
  { key: 'presentation_orale', label: 'Présentation orale' },
  { key: 'adequation_valeurs', label: "Adéquation avec les valeurs d'Evolve" },
  { key: 'dynamisme_commercial', label: 'Compétences et dynamisme commercial' },
  { key: 'degre_motivation', label: 'Degré de motivation' },
]
const ASPECTS_PROFESSIONNELS = [
  { key: 'annees_experience', label: "Années d'expérience" },
  { key: 'competences_techniques', label: 'Compétences techniques' },
  { key: 'vision_ambition', label: 'Vision et ambition' },
  { key: 'relation_independant', label: "Relation avec le statut d'indépendant" },
  { key: 'investissement_infos', label: 'Investissement pour obtenir des infos' },
  { key: 'tresorerie_avance', label: "Trésorerie d'avance pour se lancer" },
]

function fmtFR(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function fmtDateLong(d: string) {
  const date = new Date(d + 'T12:00:00')
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

function scoreColor(n: number | null): string {
  if (n == null) return '#888'
  if (n >= 75) return '#16a34a'
  if (n >= 50) return '#f59e0b'
  return '#ef4444'
}

function noteColor(n: number): string {
  if (n >= 7) return '#16a34a'
  if (n >= 4) return '#f59e0b'
  return '#ef4444'
}

function buildScoreBar(score: number | null, max = 110): string {
  if (score == null) return '<span style="color:#999;font-size:13px">—</span>'
  const pct = Math.min(100, Math.round((score / max) * 100))
  const color = scoreColor(score)
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:4px">
      <tr>
        <td style="font-size:28px;font-weight:700;color:${color};width:60px;vertical-align:middle">${score}</td>
        <td style="vertical-align:middle;padding-left:12px">
          <div style="font-size:10px;color:#888;margin-bottom:4px">/ ${max} pts</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            <tr>
              <td width="${pct}%" style="height:8px;background:${color};border-radius:4px 0 0 4px"></td>
              <td width="${100 - pct}%" style="height:8px;background:#E8E4DD;border-radius:0 4px 4px 0"></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`
}

function buildGrilleSection(grille: Record<string, number> | null, commentaires: Record<string, string> | null): string {
  if (!grille || Object.keys(grille).length === 0) {
    return '<p style="color:#999;font-size:13px;margin:8px 0">Grille non remplie</p>'
  }

  const buildAspects = (aspects: typeof ASPECTS_PERSONNELS) =>
    aspects.map(a => {
      const val = grille[a.key]
      const comment = commentaires?.[a.key]
      if (val == null) return ''
      const color = noteColor(val)
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #F0EDE7;font-size:12px;color:#333;width:55%">${a.label}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0EDE7;text-align:center;width:15%">
          <span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:${color};color:white;font-size:12px;font-weight:700;line-height:28px;text-align:center">${val}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #F0EDE7;font-size:11px;color:#666">${comment || ''}</td>
      </tr>`
    }).join('')

  const totalPersonnel = ASPECTS_PERSONNELS.reduce((s, a) => s + (grille[a.key] ?? 0), 0)
  const totalPro = ASPECTS_PROFESSIONNELS.reduce((s, a) => s + (grille[a.key] ?? 0), 0)
  const totalMax = (ASPECTS_PERSONNELS.length + ASPECTS_PROFESSIONNELS.length) * 10

  return `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:600;color:${ACCENT};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Aspects personnels</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#F5F3EF">
          <th style="padding:6px 12px;text-align:left;font-weight:600;color:#555;font-size:11px">Critère</th>
          <th style="padding:6px 12px;text-align:center;font-weight:600;color:#555;font-size:11px">/10</th>
          <th style="padding:6px 12px;text-align:left;font-weight:600;color:#555;font-size:11px">Commentaire</th>
        </tr></thead>
        <tbody>${buildAspects(ASPECTS_PERSONNELS)}</tbody>
      </table>
      <div style="font-size:11px;color:#888;margin-top:4px;text-align:right">Sous-total : ${totalPersonnel} / ${ASPECTS_PERSONNELS.length * 10}</div>
    </div>
    <div>
      <div style="font-size:12px;font-weight:600;color:${ACCENT};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Aspects professionnels</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#F5F3EF">
          <th style="padding:6px 12px;text-align:left;font-weight:600;color:#555;font-size:11px">Critère</th>
          <th style="padding:6px 12px;text-align:center;font-weight:600;color:#555;font-size:11px">/10</th>
          <th style="padding:6px 12px;text-align:left;font-weight:600;color:#555;font-size:11px">Commentaire</th>
        </tr></thead>
        <tbody>${buildAspects(ASPECTS_PROFESSIONNELS)}</tbody>
      </table>
      <div style="font-size:11px;color:#888;margin-top:4px;text-align:right">Sous-total : ${totalPro} / ${ASPECTS_PROFESSIONNELS.length * 10}</div>
    </div>
    <div style="margin-top:12px;padding:10px 16px;background:#F5F3EF;border-radius:6px;display:flex;align-items:center;gap:16px">
      <span style="font-size:13px;color:${ACCENT};font-weight:600">Total grille :</span>
      <span style="font-size:22px;font-weight:700;color:${scoreColor((totalPersonnel + totalPro) / totalMax * 110)}">${totalPersonnel + totalPro}</span>
      <span style="font-size:12px;color:#888">/ ${totalMax}</span>
    </div>`
}

function buildProfileBlock(p: any, notes: any[], activities: any[]): string {
  const name = `${p.first_name || ''} ${p.last_name || ''}`.trim()
  let grille: Record<string, number> | null = null
  let commentaires: Record<string, string> | null = null
  try {
    grille = typeof p.grille_notation === 'string'
      ? (p.grille_notation ? JSON.parse(p.grille_notation) : null)
      : (p.grille_notation || null)
  } catch (_) { grille = null }
  try {
    commentaires = typeof p.grille_commentaires === 'string'
      ? (p.grille_commentaires ? JSON.parse(p.grille_commentaires) : null)
      : (p.grille_commentaires || null)
  } catch (_) { commentaires = null }

  const liUrl = p.linkedin_url
    ? (p.linkedin_url.startsWith('http') ? p.linkedin_url : `https://${p.linkedin_url}`)
    : null

  // Toutes les notes (sans limite)
  const notesHtml = notes.length > 0
    ? notes.map(n => {
        const date = n.created_at ? new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
        return `<div style="padding:10px 14px;border-left:3px solid ${GOLD};background:#FAFAF8;border-radius:0 6px 6px 0;margin-bottom:8px">
          <div style="font-size:10px;color:#888;margin-bottom:4px">${date}</div>
          <div style="font-size:13px;color:#333;white-space:pre-line;line-height:1.5">${(n.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>`
      }).join('')
    : '<p style="color:#999;font-size:13px">Aucune note</p>'

  // Historique des stades (dernières activités stage_change)
  const stageActs = activities
    .filter(a => a.activity_type === 'stage_change')
    .reverse()
  const histoHtml = stageActs.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px">
        ${stageActs.map(a => {
          const date = a.created_at ? new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''
          const from = a.old_value || '—'
          const to = a.new_value || '—'
          return `<tr>
            <td style="padding:5px 10px;border-bottom:1px solid #F0EDE7;color:#888;width:80px">${date}</td>
            <td style="padding:5px 10px;border-bottom:1px solid #F0EDE7;color:#555">${from} → <strong style="color:${ACCENT}">${to}</strong></td>
          </tr>`
        }).join('')}
      </table>`
    : '<p style="color:#999;font-size:12px">—</p>'

  const mapSrc = (src: string) => {
    if (src === 'Inbound') return 'Inbound Marketing'
    return src || '—'
  }

  return `
  <!-- PROFIL BLOCK -->
  <div style="border:2px solid ${GOLD};border-radius:12px;overflow:hidden;margin-bottom:32px">

    <!-- En-tête profil -->
    <div style="background:${ACCENT};padding:20px 28px">
      <div style="font-size:22px;font-weight:700;color:${GOLD};margin-bottom:4px">${name}</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.8)">${p.title || '—'} · ${p.company || '—'}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.55);margin-top:2px">${p.city || '—'}${p.region ? ' · ' + p.region : ''}</div>
    </div>

    <div style="padding:20px 28px">

      <!-- Infos clés en tableau -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px">
        <tr>
          <td style="width:50%;vertical-align:top;padding-right:16px">
            <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">
              <tr>
                <td style="padding:6px 0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em;width:100px">Source</td>
                <td style="padding:6px 0;font-size:13px;color:#333;font-weight:500">${mapSrc(p.source)}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em">Stade actuel</td>
                <td style="padding:6px 0;font-size:13px;color:#333;font-weight:500">${p.stage || '—'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em">Maturité</td>
                <td style="padding:6px 0;font-size:13px;color:#333;font-weight:500">${p.maturity || '—'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em">Référent</td>
                <td style="padding:6px 0;font-size:13px;color:#333;font-weight:500">${p.owner_full_name || '—'}</td>
              </tr>
              ${p.email ? `<tr>
                <td style="padding:6px 0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em">Email</td>
                <td style="padding:6px 0;font-size:13px;color:#333">${p.email}</td>
              </tr>` : ''}
              ${liUrl ? `<tr>
                <td style="padding:6px 0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em">LinkedIn</td>
                <td style="padding:6px 0;font-size:13px"><a href="${liUrl}" style="color:${ACCENT};text-decoration:underline">Voir le profil</a></td>
              </tr>` : ''}
            </table>
          </td>
          <td style="width:50%;vertical-align:top;padding-left:16px;border-left:1px solid #E8E4DD">
            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Score IA</div>
            ${buildScoreBar(p.score)}
          </td>
        </tr>
      </table>

      <!-- Grille de notation -->
      <div style="margin-bottom:20px">
        <div style="font-size:14px;font-weight:700;color:${ACCENT};border-bottom:2px solid ${GOLD};padding-bottom:6px;margin-bottom:14px">Grille de notation</div>
        ${buildGrilleSection(grille, commentaires)}
      </div>

      <!-- Dernières notes -->
      <div style="margin-bottom:20px">
        <div style="font-size:14px;font-weight:700;color:${ACCENT};border-bottom:2px solid ${GOLD};padding-bottom:6px;margin-bottom:14px">Notes (${notes.length})</div>
        ${notesHtml}
      </div>

      <!-- Parcours pipeline -->
      <div>
        <div style="font-size:14px;font-weight:700;color:${ACCENT};border-bottom:2px solid ${GOLD};padding-bottom:6px;margin-bottom:14px">Parcours pipeline</div>
        ${histoHtml}
      </div>

    </div>
  </div>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const dateParam = url.searchParams.get('date')
    const today = dateParam ?? new Date().toISOString().split('T')[0]

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Profils avec R2 Amaury prévu aujourd'hui
    const { data: profilesR2 } = await supabase
      .from('profiles')
      .select(`
        id, first_name, last_name, company, title, city, region,
        stage, maturity, source, score, email, linkedin_url,
        owner_full_name, grille_notation, grille_commentaires,
        next_event_date, next_event_label
      `)
      .eq('next_event_label', 'R2 Amaury')
      .eq('next_event_date', today)

    const profiles = profilesR2 || []

    // Pas de R2 aujourd'hui → on signale mais on ne bloque pas Make
    if (profiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, has_r2_today: false, count: 0, date: today }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Pour chaque profil, charger notes + activités
    const enriched = await Promise.all(profiles.map(async (p: any) => {
      const [{ data: notes }, { data: activities }] = await Promise.all([
        supabase
          .from('notes')
          .select('content, created_at')
          .eq('profile_id', p.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('activities')
          .select('activity_type, old_value, new_value, note, created_at')
          .eq('profile_id', p.id)
          .order('created_at', { ascending: true }),
      ])
      return { profile: p, notes: notes || [], activities: activities || [] }
    }))

    const dateLong = fmtDateLong(today)
    const nbR2 = profiles.length
    const subject = `🎯 Recap R2 Amaury — ${nbR2 > 1 ? `${nbR2} profils` : enriched[0].profile.first_name + ' ' + enriched[0].profile.last_name} — ${dateLong}`

    const emailHtml = `
    <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:700px;margin:0 auto;background:white">

      <div style="background:${ACCENT};padding:28px 32px">
        <div style="font-size:20px;font-weight:600;color:${GOLD};letter-spacing:0.3px">Recap R2 Amaury</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.7);margin-top:6px">${dateLong} · ${nbR2} profil${nbR2 > 1 ? 's' : ''} au programme</div>
      </div>

      <div style="padding:28px 32px">
        ${enriched.map(({ profile, notes, activities }) => buildProfileBlock(profile, notes, activities)).join('')}
      </div>

      <div style="background:#F5F3EF;padding:14px 32px;text-align:center;font-size:11px;color:#AAA">
        Evolve Investissement — Recap automatique avant R2
      </div>
    </div>`

    return new Response(
      JSON.stringify({ success: true, has_r2_today: true, count: nbR2, html: emailHtml, subject }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
