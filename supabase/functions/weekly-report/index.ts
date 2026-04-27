import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SOURCES = ['Chasse LinkedIn', 'Chasse Mail', 'Recommandation', 'Ads', 'Chasse externe', 'Inbound Marketing', 'Autre']
const SOURCE_COLORS: Record<string, string> = {
  'Chasse LinkedIn': '#0077B5',
  'Chasse Mail': '#6366f1',
  'Recommandation': '#16a34a',
  'Ads': '#ea580c',
  'Chasse externe': '#8b5cf6',
  'Inbound Marketing': '#0891b2',
  'Autre': '#94a3b8',
}

const ANALYTICS_STAGES = ['R0', 'R1', "Point d'étape", 'R2 Amaury', 'Point juridique', 'Recruté']
const ALL_PIPELINE_STAGES = ['R0', 'R1', 'Point Business Plan', "Point d'étape", 'Démission reconversion', 'R2 Amaury', 'Point juridique', 'Recruté']

function normalizeStage(stg: string | null): string {
  if (!stg) return ''
  if (stg === "Point d'étape téléphonique") return "Point d'étape"
  if (stg === 'R2 Baptiste') return 'R2 Amaury'
  return stg
}

function stageIndex(stg: string | null): number {
  if (!stg) return -1
  const normalized = normalizeStage(stg)
  return ALL_PIPELINE_STAGES.indexOf(normalized)
}

function mapSourceToDisplay(src: string | null): string {
  if (!src) return 'Chasse LinkedIn'
  if (src === 'Inbound') return 'Inbound Marketing'
  if (SOURCES.includes(src)) return src
  return 'Autre'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const dateParam = url.searchParams.get('date')
    const today = dateParam ? new Date(dateParam + 'T09:00:00') : new Date()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)

    const fmt = (d: Date) => d.toISOString().split('T')[0]
    const fmtFR = (d: string) => {
      const [y, m, day] = d.split('-')
      return `${day}/${m}/${y}`
    }

    // ═══════════════════════════════════════════════
    // REQUÊTES EXISTANTES (inchangées)
    // ═══════════════════════════════════════════════

    // R1 cette semaine
    const { data: r1 } = await supabase
      .from('profiles')
      .select('first_name, last_name, company, city, next_event_date, owner_full_name, source')
      .eq('next_event_label', 'R1')
      .gte('next_event_date', fmt(monday))
      .lte('next_event_date', fmt(friday))
      .order('next_event_date')

    // Tous les R1 programmés
    const { data: allR1 } = await supabase
      .from('profiles')
      .select('first_name, last_name, company, city, next_event_date, owner_full_name, source')
      .eq('next_event_label', 'R1')
      .order('next_event_date')

    // Points d'étape cette semaine
    const { data: pointsEtape } = await supabase
      .from('profiles')
      .select('first_name, last_name, company, city, next_event_date, owner_full_name, source')
      .eq('next_event_label', "Point d'étape")
      .gte('next_event_date', fmt(monday))
      .lte('next_event_date', fmt(friday))
      .order('next_event_date')

    // Tous les points d'étape
    const { data: allPointsEtape } = await supabase
      .from('profiles')
      .select('first_name, last_name, company, city, next_event_date, owner_full_name, source')
      .eq('next_event_label', "Point d'étape")
      .order('next_event_date')

    // R2 Amaury cette semaine
    const { data: r2 } = await supabase
      .from('profiles')
      .select('first_name, last_name, company, city, next_event_date, owner_full_name, source')
      .eq('next_event_label', 'R2 Amaury')
      .gte('next_event_date', fmt(monday))
      .lte('next_event_date', fmt(friday))
      .order('next_event_date')

    // Points Business Plan cette semaine
    const { data: pointsBP } = await supabase
      .from('profiles')
      .select('first_name, last_name, company, city, next_event_date, owner_full_name, source')
      .eq('next_event_label', 'Point Business Plan')
      .gte('next_event_date', fmt(monday))
      .lte('next_event_date', fmt(friday))
      .order('next_event_date')

    // Sessions à venir — les 2 prochaines à partir d'aujourd'hui (basé sur date_debut, pas le statut)
    const { data: sessions } = await supabase
      .from('sessions_formation')
      .select('*')
      .gte('date_debut', fmt(today))
      .order('date_debut', { ascending: true, nullsFirst: false })
      .limit(2)

    // Profils liés à une session
    const { data: profilsSession } = await supabase
      .from('profiles')
      .select('first_name, last_name, city, stage, maturity, owner_full_name, integration_confirmed, session_formation_id, source')
      .not('session_formation_id', 'is', null)
      .not('stage', 'in', '("R0","R1","Pas intéressé","Chute")')
      .not('maturity', 'eq', 'Chute')

    // Recrutés 2026 (hors archivés — cohérent avec le funnel)
    const { data: recrutes } = await supabase
      .from('profiles')
      .select('first_name, last_name, owner_full_name, source')
      .eq('stage', 'Recruté')
      .neq('maturity', 'Archivé')

    const totalRecrutes = recrutes?.length || 0
    const recrutesAurelien = recrutes?.filter(r =>
      r.owner_full_name?.includes('Goutard') || r.owner_full_name?.includes('Aurélien')
    ).length || 0
    const recrutesBaptiste = recrutes?.filter(r =>
      r.owner_full_name?.includes('PATERAC') || r.owner_full_name?.includes('Baptiste')
    ).length || 0

    // ═══════════════════════════════════════════════
    // NOUVELLES REQUÊTES — ANALYTICS
    // ═══════════════════════════════════════════════

    // Tous les profils actifs (non archivés) pour le funnel + sources
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, stage, source, maturity, chute_stade, created_at, updated_at, skip_business_plan, skip_demission')
      .neq('maturity', 'Archivé')

    // Activités stage_change pour calculer le funnel cumulatif
    const { data: stageActivities } = await supabase
      .from('activities')
      .select('profile_id, old_value, new_value, note, created_at')
      .eq('activity_type', 'stage_change')
      .order('created_at', { ascending: true })

    // ═══════════════════════════════════════════════
    // CALCULS ANALYTICS
    // ═══════════════════════════════════════════════

    const profiles = allProfiles || []
    const acts = stageActivities || []

    // — Build stage history per profile (same logic as Analytics.jsx) —
    const stagesReachedByProfile: Record<string, Set<string>> = {}
    acts.forEach((a: any) => {
      const pid = a.profile_id
      if (!stagesReachedByProfile[pid]) stagesReachedByProfile[pid] = new Set()
      if (a.new_value) stagesReachedByProfile[pid].add(normalizeStage(a.new_value))
      if (a.old_value) stagesReachedByProfile[pid].add(normalizeStage(a.old_value))
      if (a.note && a.note.includes(' → ')) {
        const parts = a.note.split(' → ')
        const from = parts[0]?.trim()
        const to = parts[1]?.replace(/\s*\(.*?\)/, '').trim()
        if (from) stagesReachedByProfile[pid].add(normalizeStage(from))
        if (to) stagesReachedByProfile[pid].add(normalizeStage(to))
      }
    })

    const reachedStage = (profile: any, targetStageIdx: number): boolean => {
      const targetStage = ALL_PIPELINE_STAGES[targetStageIdx]
      const pStg = normalizeStage(profile.stage)
      const pIdx = stageIndex(pStg)
      if (pIdx === targetStageIdx) return true
      if (profile.maturity === 'Chute' || profile.maturity === 'Pas intéressé') {
        const chuteStade = normalizeStage(profile.chute_stade || profile.stage)
        if (stageIndex(chuteStade) >= targetStageIdx) return true
      }
      const actStages = stagesReachedByProfile[profile.id]
      if (actStages && actStages.size > 0) {
        return actStages.has(targetStage)
      }
      return pIdx >= targetStageIdx
    }

    // — Funnel cumulatif —
    // Pour 'Recruté' on utilise totalRecrutes directement (cohérence avec objectifs, inclut les archivés)
    const forFunnel = profiles.filter((p: any) => p.stage && p.stage !== '')
    const funnelCounts = ANALYTICS_STAGES.map((stage) => {
      if (stage === 'Recruté') return { stage, reached: totalRecrutes }
      const targetIdx = stageIndex(stage)
      const reached = forFunnel.filter((p: any) => reachedStage(p, targetIdx)).length
      return { stage, reached }
    })

    // — Taux de conversion inter-étapes —
    const conversions: Array<{ label: string; from: number; to: number; rate: number }> = []
    for (let i = 0; i < ANALYTICS_STAGES.length - 1; i++) {
      const from = funnelCounts[i].reached
      const to = funnelCounts[i + 1].reached
      const rate = from > 0 ? Math.round((to / from) * 100) : 0
      conversions.push({
        label: `${ANALYTICS_STAGES[i]} → ${ANALYTICS_STAGES[i + 1]}`,
        from,
        to,
        rate,
      })
    }
    // Global R0 → Recruté
    const globalFrom = funnelCounts[0].reached
    const globalTo = funnelCounts[funnelCounts.length - 1].reached
    conversions.push({
      label: 'R0 → Recruté (global)',
      from: globalFrom,
      to: globalTo,
      rate: globalFrom > 0 ? Math.round((globalTo / globalFrom) * 100) : 0,
    })

    // — Recrutés confirmés par source —
    const recrutesBySource: Record<string, number> = {}
    ;(recrutes || []).forEach((r: any) => {
      const src = mapSourceToDisplay(r.source)
      recrutesBySource[src] = (recrutesBySource[src] || 0) + 1
    })

    // ═══════════════════════════════════════════════
    // HTML BUILDERS
    // ═══════════════════════════════════════════════

    const sourceColor = (src: string) => SOURCE_COLORS[mapSourceToDisplay(src)] || '#94a3b8'
    const sourceBadge = (src: string) => {
      const display = mapSourceToDisplay(src)
      const color = sourceColor(src)
      return `<span style="display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;background:${color}18;color:${color};white-space:nowrap">${display}</span>`
    }

    const profileRow = (p: any) =>
      `<tr>
        <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#1A1A1A">${p.first_name} ${p.last_name}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.company || '—'}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.city || '—'}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD">${sourceBadge(p.source || '')}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.next_event_date ? fmtFR(p.next_event_date) : '—'}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.owner_full_name || '—'}</td>
      </tr>`

    const tableStart = `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px">
      <thead><tr style="background:#173731;color:#D2AB76">
        <th style="padding:8px 14px;text-align:left;font-weight:500">Nom</th>
        <th style="padding:8px 14px;text-align:left;font-weight:500">Entreprise</th>
        <th style="padding:8px 14px;text-align:left;font-weight:500">Ville</th>
        <th style="padding:8px 14px;text-align:left;font-weight:500">Source</th>
        <th style="padding:8px 14px;text-align:left;font-weight:500">Date</th>
        <th style="padding:8px 14px;text-align:left;font-weight:500">Référent</th>
      </tr></thead><tbody>`

    const tableEnd = `</tbody></table>`

    const section = (title: string, weekData: any[], allData?: any[]) => {
      const n = weekData?.length || 0
      let html = `<div style="margin-bottom:28px">
        <div style="font-size:15px;font-weight:600;color:#173731;margin-bottom:4px;border-bottom:2px solid #D2AB76;padding-bottom:6px">${title} — ${n} cette semaine</div>`
      if (n > 0) {
        html += tableStart + weekData.map(profileRow).join('') + tableEnd
      } else {
        html += `<p style="color:#999;font-size:13px;margin:8px 0">Aucun cette semaine</p>`
      }
      if (allData && allData.length > 0) {
        html += `<p style="font-size:12px;color:#888;margin-top:6px">Total programmés : ${allData.length}</p>`
      }
      html += `</div>`
      return html
    }

    const buildSessionBlock = (session: any) => {
      const allSessionProfiles = profilsSession?.filter((p: any) => p.session_formation_id === session.id) || []
      const sessionConfirmes = allSessionProfiles.filter((p: any) => p.integration_confirmed === true)
      const sessionPotentiels = allSessionProfiles.filter((p: any) => p.integration_confirmed !== true)

      const confirmeRows = sessionConfirmes.length > 0
        ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px">
            <thead><tr style="background:#173731;color:#D2AB76">
              <th style="padding:8px 14px;text-align:left;font-weight:500">Nom</th>
              <th style="padding:8px 14px;text-align:left;font-weight:500">Ville</th>
              <th style="padding:8px 14px;text-align:left;font-weight:500">Source</th>
              <th style="padding:8px 14px;text-align:left;font-weight:500">Référent</th>
            </tr></thead><tbody>
            ${sessionConfirmes.map((p: any) => `<tr>
              <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD">${p.first_name} ${p.last_name}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.city || '—'}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD">${sourceBadge(p.source || '')}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.owner_full_name || '—'}</td>
            </tr>`).join('')}
            </tbody></table>`
        : '<p style="color:#999;font-size:13px;margin:4px 0">Aucun confirmé</p>'

      const potentielRows = sessionPotentiels.length > 0
        ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px">
            <thead><tr style="background:#F5F3EF;color:#173731">
              <th style="padding:8px 14px;text-align:left;font-weight:500">Nom</th>
              <th style="padding:8px 14px;text-align:left;font-weight:500">Ville</th>
              <th style="padding:8px 14px;text-align:left;font-weight:500">Source</th>
              <th style="padding:8px 14px;text-align:left;font-weight:500">Maturité</th>
              <th style="padding:8px 14px;text-align:left;font-weight:500">Référent</th>
            </tr></thead><tbody>
            ${sessionPotentiels.map((p: any) => `<tr>
              <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD">${p.first_name} ${p.last_name}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.city || '—'}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD">${sourceBadge(p.source || '')}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.maturity || '—'}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.owner_full_name || '—'}</td>
            </tr>`).join('')}
            </tbody></table>`
        : '<p style="color:#999;font-size:13px;margin:4px 0">Aucun potentiel</p>'

      return `<div style="background:#F5F3EF;padding:16px 20px;border-radius:6px;margin-bottom:12px;border-left:3px solid #D2AB76">
        <div style="font-size:14px;font-weight:600;color:#173731">${session.periode} ${session.annee}${session.date_debut ? ' — Début le ' + fmtFR(session.date_debut) : ''}</div>
        <div style="font-size:12px;color:#888;margin-bottom:12px">${session.statut}${session.date_debut ? '' : ' — date à confirmer'}</div>
        <div style="font-size:13px;font-weight:600;color:#173731;margin-bottom:4px">Confirmés (${sessionConfirmes.length})</div>
        ${confirmeRows}
        <div style="font-size:13px;font-weight:600;color:#173731;margin:14px 0 4px">Potentiels (${sessionPotentiels.length})</div>
        ${potentielRows}
      </div>`
    }

    const sessionsHtml = sessions && sessions.length > 0
      ? sessions.map(buildSessionBlock).join('')
      : '<p style="color:#999;font-size:13px">Aucune session planifiée</p>'

    const pct = Math.round((totalRecrutes / 30) * 100)

    // ═══════════════════════════════════════════════
    // NOUVELLES SECTIONS ANALYTICS — HTML
    // ═══════════════════════════════════════════════

    // — Section : Recrutés confirmés par source —
    const recrutesBySourceEntries = SOURCES
      .map(src => ({ src, count: recrutesBySource[src] || 0 }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count)

    const maxRecrutesBySource = Math.max(1, ...recrutesBySourceEntries.map(e => e.count))

    const recrutesBySourceHtml = recrutesBySourceEntries.length > 0
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
        recrutesBySourceEntries.map(({ src, count }) => {
          const barPct = Math.max(8, Math.round((count / maxRecrutesBySource) * 100))
          const emptyPct = 100 - barPct
          const color = SOURCE_COLORS[src] || '#94a3b8'
          return `<tr>
            <td style="padding:6px 12px 6px 0;width:160px;vertical-align:middle;white-space:nowrap">
              <table cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
                <td style="width:12px;height:12px;background:${color};border-radius:2px"></td>
                <td style="padding-left:6px;font-size:12px;color:#444">${src}</td>
              </tr></table>
            </td>
            <td style="padding:6px 12px 6px 0;vertical-align:middle">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
                <tr>
                  <td width="${barPct}%" style="height:14px;background:${color};border-radius:4px 0 0 4px"></td>
                  <td width="${emptyPct}%" style="height:14px;background:#E8E4DD;border-radius:0 4px 4px 0"></td>
                </tr>
              </table>
            </td>
            <td style="padding:6px 0;width:30px;vertical-align:middle;text-align:right">
              <span style="font-size:13px;font-weight:700;color:#173731">${count}</span>
            </td>
          </tr>`
        }).join('') + `</table>`
      : '<p style="color:#999;font-size:13px">Aucun recrutement confirmé</p>'

    // — Taux de conversion inter-étapes (table-based pour email) —
    const conversionsHtml = conversions.map(c => {
      const barColor = c.rate >= 50 ? '#16a34a' : c.rate >= 25 ? '#D2AB76' : '#ef4444'
      const barPct = Math.max(6, Math.min(100, c.rate))
      const emptyPct = 100 - barPct
      const isGlobal = c.label.includes('global')
      const rowBg = isGlobal ? '#EAE6DF' : 'transparent'
      const topBorder = isGlobal ? `<tr><td colspan="3" style="padding-top:12px;border-top:2px solid #D2AB76"></td></tr>` : ''
      const fontSize = isGlobal ? '14px' : '13px'
      const fontWeight = isGlobal ? '700' : '500'
      const pctSize = isGlobal ? '22px' : '17px'
      const barH = isGlobal ? '14' : '10'
      return `${topBorder}
      <tr style="background:${rowBg}">
        <td style="padding:10px 12px 4px 12px;width:200px;vertical-align:middle">
          <span style="font-size:${fontSize};font-weight:${fontWeight};color:#173731">${c.label}</span>
        </td>
        <td style="padding:10px 8px 4px 0;width:80px;vertical-align:middle;text-align:right;white-space:nowrap">
          <span style="font-size:${pctSize};font-weight:700;color:${barColor}">${c.rate}%</span>
        </td>
        <td style="padding:10px 12px 4px 0;vertical-align:middle;text-align:right;white-space:nowrap">
          <span style="font-size:11px;color:#999">${c.from} → ${c.to}</span>
        </td>
      </tr>
      <tr style="background:${rowBg}">
        <td colspan="3" style="padding:2px 12px 10px 12px">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            <tr>
              <td width="${barPct}%" style="height:${barH}px;background:${barColor};border-radius:6px 0 0 6px"></td>
              <td width="${emptyPct}%" style="height:${barH}px;background:#E8E4DD;border-radius:0 6px 6px 0"></td>
            </tr>
          </table>
        </td>
      </tr>`
    }).join('')

    const conversionsTable = `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${conversionsHtml}</table>`

    // ═══════════════════════════════════════════════
    // ASSEMBLAGE FINAL DU HTML
    // ═══════════════════════════════════════════════

    const emailHtml = `
    <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;background:white">

      <div style="background:#173731;padding:28px 32px">
        <div style="font-size:20px;font-weight:600;color:#D2AB76;letter-spacing:0.3px">Rapport hebdomadaire</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px">Semaine du ${fmtFR(fmt(monday))} — Evolve Recruiter</div>
      </div>

      <div style="padding:28px 32px">

        ${section('R1 fixés', r1 || [], allR1 || [])}
        ${section("Points d'étape fixés", pointsEtape || [], allPointsEtape || [])}
        ${section('R2 Amaury fixés', r2 || [])}
        ${section('Points Business Plan fixés', pointsBP || [])}

        <div style="margin-bottom:28px">
          <div style="font-size:15px;font-weight:600;color:#173731;margin-bottom:8px;border-bottom:2px solid #D2AB76;padding-bottom:6px">Prochaines sessions de formation</div>
          ${sessionsHtml}
        </div>

        <div style="margin-bottom:28px">
          <div style="font-size:15px;font-weight:600;color:#173731;margin-bottom:8px;border-bottom:2px solid #D2AB76;padding-bottom:6px">Objectifs 2026</div>
          <div style="display:flex;gap:24px;margin-top:12px">
            <div style="flex:1;background:#F5F3EF;padding:14px 18px;border-radius:6px;text-align:center">
              <div style="font-size:24px;font-weight:700;color:#173731">${totalRecrutes}</div>
              <div style="font-size:11px;color:#888;margin-top:2px">/ 30 recrutés</div>
            </div>
            <div style="flex:1;background:#F5F3EF;padding:14px 18px;border-radius:6px;text-align:center">
              <div style="font-size:24px;font-weight:700;color:#173731">${recrutesBaptiste}</div>
              <div style="font-size:11px;color:#888;margin-top:2px">/ 15 Baptiste</div>
            </div>
            <div style="flex:1;background:#F5F3EF;padding:14px 18px;border-radius:6px;text-align:center">
              <div style="font-size:24px;font-weight:700;color:#173731">${recrutesAurelien}</div>
              <div style="font-size:11px;color:#888;margin-top:2px">/ 15 Aurélien</div>
            </div>
          </div>
          <div style="margin-top:10px;background:#E8E4DD;border-radius:6px;height:20px">
            <div style="background:#D2AB76;border-radius:6px;height:20px;width:${pct}%;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:600">${pct}%</div>
          </div>
        </div>

        <!-- ═══ ANALYTICS ═══ -->

        <div style="margin-bottom:28px">
          <div style="font-size:15px;font-weight:600;color:#173731;margin-bottom:4px;border-bottom:2px solid #D2AB76;padding-bottom:6px">Recrutements confirmés par source</div>
          <div style="font-size:12px;color:#888;margin-bottom:12px">D'où viennent les ${totalRecrutes} profils recrutés ?</div>
          ${recrutesBySourceHtml}
        </div>

        <div style="margin-bottom:28px;background:#F5F3EF;border-radius:12px;padding:24px 28px;border:1px solid #E8E4DD">
          <div style="font-size:17px;font-weight:700;color:#173731;margin-bottom:4px">Taux de conversion par étape</div>
          <div style="font-size:12px;color:#888;margin-bottom:16px">% de profils passant d'une étape à la suivante</div>
          ${conversionsTable}
        </div>

      </div>

      <div style="background:#F5F3EF;padding:14px 32px;text-align:center;font-size:11px;color:#AAA">
        Evolve Investissement — Rapport généré automatiquement
      </div>
    </div>`

    return new Response(
      JSON.stringify({
        success: true,
        html: emailHtml,
        subject: '🎯 Rapport Hebdo - Recrutement et développement réseau Evolve - Semaine du ' + fmtFR(fmt(monday))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
