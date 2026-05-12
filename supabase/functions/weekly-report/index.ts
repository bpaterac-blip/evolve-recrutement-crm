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

const REGIONS = [
  'Paris / Île-de-France', 'Grand Est', 'Hauts-de-France', 'Bourgogne-Franche-Comté',
  'Provence-Alpes-Côte d\'Azur', 'Occitanie', 'Nouvelle-Aquitaine', 'Auvergne-Rhône-Alpes',
  'Centre-Val de Loire', 'Pays de la Loire', 'Bretagne', 'Normandie', 'Corse',
]

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
  return ALL_PIPELINE_STAGES.indexOf(normalizeStage(stg))
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
    const weeksAgo = (dateStr: string) => {
      const d = new Date(dateStr)
      const weeks = Math.floor((today.getTime() - d.getTime()) / (7 * 24 * 3600 * 1000))
      if (weeks === 0) return 'cette semaine'
      return `${weeks} sem.`
    }
    const pauseStyle = (dateStr: string) => {
      const weeks = Math.floor((today.getTime() - new Date(dateStr).getTime()) / (7 * 24 * 3600 * 1000))
      if (weeks <= 3) return 'background:#EAF3DE;color:#3B6D11'
      if (weeks <= 6) return 'background:#FAEEDA;color:#854F0B'
      return 'background:#FCEBEB;color:#A32D2D'
    }

    // ═══════════════════════════════════════════════
    // REQUÊTES
    // ═══════════════════════════════════════════════

    const profileSelect = 'first_name, last_name, company, city, next_event_date, owner_full_name, source'

    // R1 cette semaine
    const { data: r1 } = await supabase.from('profiles').select(profileSelect)
      .eq('next_event_label', 'R1')
      .gte('next_event_date', fmt(monday)).lte('next_event_date', fmt(friday))
      .order('next_event_date')

    // R1 à venir (futur seulement)
    const { data: allR1 } = await supabase.from('profiles').select('id')
      .eq('next_event_label', 'R1').gte('next_event_date', fmt(today))

    // Points d'étape cette semaine
    const { data: pointsEtape } = await supabase.from('profiles').select(profileSelect)
      .eq('next_event_label', "Point d'étape")
      .gte('next_event_date', fmt(monday)).lte('next_event_date', fmt(friday))
      .order('next_event_date')

    // Points d'étape à venir
    const { data: allPointsEtape } = await supabase.from('profiles').select('id')
      .eq('next_event_label', "Point d'étape").gte('next_event_date', fmt(today))

    // R2 cette semaine
    const { data: r2 } = await supabase.from('profiles').select(profileSelect)
      .eq('next_event_label', 'R2 Amaury')
      .gte('next_event_date', fmt(monday)).lte('next_event_date', fmt(friday))
      .order('next_event_date')

    // R2 à venir
    const { data: allR2 } = await supabase.from('profiles').select('id')
      .eq('next_event_label', 'R2 Amaury').gte('next_event_date', fmt(today))

    // Points Business Plan cette semaine
    const { data: pointsBP } = await supabase.from('profiles').select(profileSelect)
      .eq('next_event_label', 'Point Business Plan')
      .gte('next_event_date', fmt(monday)).lte('next_event_date', fmt(friday))
      .order('next_event_date')

    // Points BP à venir
    const { data: allBP } = await supabase.from('profiles').select('id')
      .eq('next_event_label', 'Point Business Plan').gte('next_event_date', fmt(today))

    // Sessions à venir avec date confirmée
    const { data: sessionsWithDate } = await supabase.from('sessions_formation').select('*')
      .gte('date_debut', fmt(today))
      .order('date_debut', { ascending: true })
      .limit(2)

    // Sessions sans date (à confirmer) — exclure les passées
    const { data: sessionsNoDate } = await supabase.from('sessions_formation').select('*')
      .is('date_debut', null)
      .not('statut', 'ilike', 'pass%')
      .limit(2)

    // Fusionner : prochaines sessions avec date d'abord, puis sans date
    const sessions = [...(sessionsWithDate || []), ...(sessionsNoDate || [])].slice(0, 2)

    // Profils liés à une session (on filtre En pause et Archivé côté code)
    const { data: profilsSession } = await supabase.from('profiles')
      .select('first_name, last_name, city, stage, maturity, owner_full_name, integration_confirmed, session_formation_id, source')
      .not('session_formation_id', 'is', null)
      .not('stage', 'in', '("R0","R1","Pas intéressé","Chute")')
      .not('maturity', 'eq', 'Chute')

    // Recrutés (hors archivés)
    const { data: recrutes } = await supabase.from('profiles')
      .select('first_name, last_name, owner_full_name, source')
      .eq('stage', 'Recruté').neq('maturity', 'Archivé')

    const totalRecrutes = recrutes?.length || 0
    const recrutesAurelien = recrutes?.filter((r: any) =>
      r.owner_full_name?.includes('Goutard') || r.owner_full_name?.includes('Aurélien')
    ).length || 0
    const recrutesBaptiste = recrutes?.filter((r: any) =>
      r.owner_full_name?.includes('PATERAC') || r.owner_full_name?.includes('Baptiste')
    ).length || 0

    // Profils non-archivés avec un stage (= dans le pipeline) pour analytics
    // Filtre stage != null côté serveur pour éviter la pagination 1000 lignes
    // (la table a 900+ prospects CRM sans stage qui pollueraient le compte)
    const { data: allProfiles } = await supabase.from('profiles')
      .select('id, stage, source, maturity, region, chute_stade, created_at, updated_at, skip_business_plan, skip_demission')
      .neq('maturity', 'Archivé')
      .not('stage', 'is', null)
      .neq('stage', '')

    // Profils ayant eu un stage (y compris archivés) pour le funnel cumulatif
    // On filtre côté serveur sur stage != null pour éviter la pagination à 1000 lignes
    // (la table CRM a 900+ prospects sans stage qui ne sont pas dans le pipeline)
    const { data: allProfilesFunnel } = await supabase.from('profiles')
      .select('id, stage, source, maturity, chute_stade')
      .not('stage', 'is', null)
      .neq('stage', '')

    // Activités stage_change pour funnel cumulatif
    const { data: stageActivities } = await supabase.from('activities')
      .select('profile_id, old_value, new_value, note, created_at')
      .eq('activity_type', 'stage_change').order('created_at', { ascending: true })

    // Entrées cette semaine = profils qui ont REJOINT le pipeline (stage != null)
    // et dont le stage a été assigné cette semaine (created_at comme proxy)
    // On exclut les simples ajouts CRM sans stage (= prospects pas encore en pipeline)
    const { data: entreesRaw } = await supabase.from('profiles')
      .select('first_name, last_name, source, owner_full_name')
      .not('stage', 'is', null)
      .neq('stage', '')
      .gte('created_at', fmt(monday) + 'T00:00:00Z')
      .lte('created_at', fmt(friday) + 'T23:59:59Z')
      .order('created_at', { ascending: false })

    // Sorties cette semaine (passés en Chute ou Pas intéressé)
    const { data: sortiesRaw } = await supabase.from('profiles')
      .select('first_name, last_name, source, stage, maturity, chute_type, pas_interesse_type, owner_full_name, chute_stade')
      .in('maturity', ['Chute', 'Pas intéressé'])
      .gte('updated_at', fmt(monday) + 'T00:00:00Z')
      .lte('updated_at', fmt(friday) + 'T23:59:59Z')
      .order('updated_at', { ascending: false })

    // Profils en pause
    const { data: enPauseRaw } = await supabase.from('profiles')
      .select('first_name, last_name, source, stage, owner_full_name, updated_at')
      .eq('maturity', 'En pause')
      .order('updated_at', { ascending: true })

    // ═══════════════════════════════════════════════
    // CALCULS ANALYTICS
    // ═══════════════════════════════════════════════

    const profiles = allProfiles || []
    const profilesFunnel = allProfilesFunnel || []
    const acts = stageActivities || []

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

    const reachedStage = (profile: any, targetIdx: number): boolean => {
      const targetStage = ALL_PIPELINE_STAGES[targetIdx]
      const pIdx = stageIndex(profile.stage)
      if (pIdx === targetIdx) return true
      if (profile.maturity === 'Chute' || profile.maturity === 'Pas intéressé') {
        const chuteStade = normalizeStage(profile.chute_stade || profile.stage)
        if (stageIndex(chuteStade) >= targetIdx) return true
      }
      const actStages = stagesReachedByProfile[profile.id]
      if (actStages && actStages.size > 0) return actStages.has(targetStage)
      return pIdx >= targetIdx
    }

    // Funnel cumulatif sur TOUS les profils (y compris archivés) qui ont RÉELLEMENT
    // été dans le pipeline = ceux qui ont eu un stage assigné (R0 ou au-delà)
    const forFunnel = profilesFunnel.filter((p: any) => p.stage && p.stage !== '')
    const totalEverRecruited = profilesFunnel.filter((p: any) => p.stage === 'Recruté').length
    const funnelCounts = ANALYTICS_STAGES.map((stage) => {
      if (stage === 'Recruté') {
        // Tous les recrutés (actifs + archivés)
        return { stage, reached: totalEverRecruited }
      }
      const targetIdx = stageIndex(stage)
      if (targetIdx === 0) {
        // R0 = tous les profils qui ont un stage = tous les vrais entrants pipeline
        return { stage, reached: forFunnel.length }
      }
      return { stage, reached: forFunnel.filter((p: any) => reachedStage(p, targetIdx)).length }
    })

    const conversions: Array<{ label: string; from: number; to: number; rate: number }> = []
    for (let i = 0; i < ANALYTICS_STAGES.length - 1; i++) {
      const from = funnelCounts[i].reached
      const to = funnelCounts[i + 1].reached
      conversions.push({ label: `${ANALYTICS_STAGES[i]} → ${ANALYTICS_STAGES[i + 1]}`, from, to, rate: from > 0 ? Math.round((to / from) * 100) : 0 })
    }
    conversions.push({
      label: 'R0 → Recruté (global)',
      from: funnelCounts[0].reached,
      to: funnelCounts[funnelCounts.length - 1].reached,
      rate: funnelCounts[0].reached > 0 ? Math.round((totalEverRecruited / funnelCounts[0].reached) * 100) : 0,
    })

    // Recrutés par source
    const recrutesBySource: Record<string, number> = {}
    ;(recrutes || []).forEach((r: any) => {
      const src = mapSourceToDisplay(r.source)
      recrutesBySource[src] = (recrutesBySource[src] || 0) + 1
    })

    // Pipeline actif par source + stade
    // Un profil est "dans le pipeline" seulement s'il a un stage (= R0 accepté ou plus)
    // Les profils sans stage = prospects CRM pas encore en pipeline
    const activePipeline = profiles.filter((p: any) =>
      !['Chute', 'Pas intéressé', 'Archivé', 'En pause'].includes(p.maturity) &&
      p.stage && p.stage !== ''
    )
    const pipelineBySource: Record<string, { total: number; stages: Record<string, number> }> = {}
    activePipeline.forEach((p: any) => {
      const src = mapSourceToDisplay(p.source)
      if (!pipelineBySource[src]) pipelineBySource[src] = { total: 0, stages: {} }
      pipelineBySource[src].total++
      const stg = normalizeStage(p.stage)
      pipelineBySource[src].stages[stg] = (pipelineBySource[src].stages[stg] || 0) + 1
    })
    const totalActivePipeline = activePipeline.length

    // Couverture géographique
    const pipelineByRegion: Record<string, number> = {}
    activePipeline.forEach((p: any) => {
      const reg = p.region || 'Non renseignée'
      pipelineByRegion[reg] = (pipelineByRegion[reg] || 0) + 1
    })

    // Entrées par source
    const entreesParSource: Record<string, number> = {}
    ;(entreesRaw || []).forEach((p: any) => {
      const src = mapSourceToDisplay(p.source)
      entreesParSource[src] = (entreesParSource[src] || 0) + 1
    })
    const totalEntrees = entreesRaw?.length || 0
    const sorties = sortiesRaw || []

    // ═══════════════════════════════════════════════
    // HTML BUILDERS
    // ═══════════════════════════════════════════════

    const sourceColor = (src: string) => SOURCE_COLORS[mapSourceToDisplay(src)] || '#94a3b8'
    const sourceBadge = (src: string) => {
      const display = mapSourceToDisplay(src)
      const color = sourceColor(src)
      return `<span style="display:inline-block;font-size:10px;font-weight:600;padding:2px 7px;border-radius:8px;background:${color}18;color:${color};white-space:nowrap">${display}</span>`
    }

    const profileRow = (p: any) =>
      `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #E8E4DD;color:#1A1A1A">${p.first_name} ${p.last_name}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #E8E4DD;color:#555">${p.company || '—'}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #E8E4DD;color:#555">${p.city || '—'}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #E8E4DD">${sourceBadge(p.source || '')}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #E8E4DD;color:#555">${p.next_event_date ? fmtFR(p.next_event_date) : '—'}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #E8E4DD;color:#555">${p.owner_full_name || '—'}</td>
      </tr>`

    const tableStart = `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px">
      <thead><tr style="background:#173731;color:#D2AB76">
        <th style="padding:7px 10px;text-align:left;font-weight:400">Nom</th>
        <th style="padding:7px 10px;text-align:left;font-weight:400">Entreprise</th>
        <th style="padding:7px 10px;text-align:left;font-weight:400">Ville</th>
        <th style="padding:7px 10px;text-align:left;font-weight:400">Source</th>
        <th style="padding:7px 10px;text-align:left;font-weight:400">Date</th>
        <th style="padding:7px 10px;text-align:left;font-weight:400">Référent</th>
      </tr></thead><tbody>`
    const tableEnd = `</tbody></table>`

    const section = (title: string, weekData: any[], totalAVenir?: number) => {
      const n = weekData?.length || 0
      let html = `<div style="margin-bottom:24px">
        <div style="font-size:14px;font-weight:600;color:#173731;border-bottom:2px solid #D2AB76;padding-bottom:5px;margin-bottom:8px">${title} — ${n} cette semaine</div>`
      if (n > 0) html += tableStart + weekData.map(profileRow).join('') + tableEnd
      else html += `<p style="color:#bbb;font-size:12px;margin:6px 0">Aucun cette semaine</p>`
      if (totalAVenir !== undefined) html += `<p style="font-size:11px;color:#aaa;margin-top:5px">Total à venir : ${totalAVenir}</p>`
      html += `</div>`
      return html
    }

    const buildSessionBlock = (session: any) => {
      const allSP = profilsSession?.filter((p: any) => p.session_formation_id === session.id) || []
      const confirmes = allSP.filter((p: any) => p.integration_confirmed === true)
      // Potentiels : exclure Archivé et En pause, garder Chaud / Tiède / Froid
      const potentiels = allSP.filter((p: any) =>
        p.integration_confirmed !== true &&
        !['Archivé', 'En pause'].includes(p.maturity)
      )

      const confirmeRows = confirmes.length > 0
        ? `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:5px">
            <thead><tr style="background:#173731;color:#D2AB76">
              <th style="padding:6px 10px;text-align:left;font-weight:400">Nom</th>
              <th style="padding:6px 10px;text-align:left;font-weight:400">Ville</th>
              <th style="padding:6px 10px;text-align:left;font-weight:400">Source</th>
              <th style="padding:6px 10px;text-align:left;font-weight:400">Référent</th>
            </tr></thead><tbody>
            ${confirmes.map((p: any) => `<tr>
              <td style="padding:6px 10px;border-bottom:1px solid #E8E4DD">${p.first_name} ${p.last_name}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #E8E4DD;color:#555">${p.city || '—'}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #E8E4DD">${sourceBadge(p.source || '')}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #E8E4DD;color:#555">${p.owner_full_name || '—'}</td>
            </tr>`).join('')}
            </tbody></table>`
        : '<p style="color:#bbb;font-size:12px;margin:4px 0">Aucun confirmé</p>'

      const potentielRows = potentiels.length > 0
        ? `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:5px">
            <thead><tr style="background:#173731;color:#D2AB76">
              <th style="padding:6px 10px;text-align:left;font-weight:400">Nom</th>
              <th style="padding:6px 10px;text-align:left;font-weight:400">Ville</th>
              <th style="padding:6px 10px;text-align:left;font-weight:400">Source</th>
              <th style="padding:6px 10px;text-align:left;font-weight:400">Maturité</th>
              <th style="padding:6px 10px;text-align:left;font-weight:400">Référent</th>
            </tr></thead><tbody>
            ${potentiels.map((p: any) => `<tr>
              <td style="padding:6px 10px;border-bottom:1px solid #E8E4DD">${p.first_name} ${p.last_name}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #E8E4DD;color:#555">${p.city || '—'}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #E8E4DD">${sourceBadge(p.source || '')}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #E8E4DD;color:#555">${p.maturity || '—'}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #E8E4DD;color:#555">${p.owner_full_name || '—'}</td>
            </tr>`).join('')}
            </tbody></table>`
        : '<p style="color:#bbb;font-size:12px;margin:4px 0">Aucun potentiel</p>'

      return `<div style="background:#F5F3EF;padding:14px 16px;border-radius:6px;margin-bottom:10px;border-left:3px solid #D2AB76">
        <div style="font-size:13px;font-weight:600;color:#173731">${session.periode || ''} ${session.annee || ''}${session.date_debut ? ' — Début le ' + fmtFR(session.date_debut) : ' — date à confirmer'}</div>
        <div style="font-size:11px;color:#aaa;margin-bottom:10px">${session.statut || ''}</div>
        <div style="font-size:12px;font-weight:600;color:#173731;margin-bottom:4px">Confirmés (${confirmes.length})</div>
        ${confirmeRows}
        <div style="font-size:12px;font-weight:600;color:#173731;margin:12px 0 4px">Potentiels (${potentiels.length})</div>
        ${potentielRows}
      </div>`
    }

    const sessionsHtml = sessions && sessions.length > 0
      ? sessions.map(buildSessionBlock).join('')
      : '<p style="color:#bbb;font-size:12px">Aucune session planifiée</p>'

    const pct = Math.round((totalRecrutes / 30) * 100)

    // ── Recrutés par source ──
    const recrutesBySourceEntries = SOURCES
      .map(src => ({ src, count: recrutesBySource[src] || 0 }))
      .filter(e => e.count > 0).sort((a, b) => b.count - a.count)
    const maxRecr = Math.max(1, ...recrutesBySourceEntries.map(e => e.count))

    const recrutesBySourceHtml = recrutesBySourceEntries.length > 0
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
        recrutesBySourceEntries.map(({ src, count }) => {
          const bp = Math.max(8, Math.round((count / maxRecr) * 100))
          const color = SOURCE_COLORS[src] || '#94a3b8'
          return `<tr>
            <td style="padding:5px 10px 5px 0;width:150px;vertical-align:middle;white-space:nowrap">
              <table cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
                <td style="width:10px;height:10px;background:${color};border-radius:2px"></td>
                <td style="padding-left:6px;font-size:11px;color:#444">${src}</td>
              </tr></table>
            </td>
            <td style="padding:5px 10px 5px 0;vertical-align:middle">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
                <td width="${bp}%" style="height:12px;background:${color};border-radius:3px 0 0 3px"></td>
                <td width="${100 - bp}%" style="height:12px;background:#E8E4DD;border-radius:0 3px 3px 0"></td>
              </tr></table>
            </td>
            <td style="padding:5px 0;width:24px;text-align:right;vertical-align:middle">
              <span style="font-size:12px;font-weight:700;color:#173731">${count}</span>
            </td>
          </tr>`
        }).join('') + `</table>`
      : '<p style="color:#bbb;font-size:12px">Aucun recrutement confirmé</p>'

    // ── Taux de conversion ──
    const hasOverflow = conversions.some(c => c.rate > 100)
    const conversionsHtml = conversions.map(c => {
      const barColor = c.rate >= 50 ? '#16a34a' : c.rate >= 25 ? '#D2AB76' : '#ef4444'
      const bp = Math.max(6, Math.min(100, c.rate))
      const isGlobal = c.label.includes('global')
      const rateLabel = c.rate > 100 ? `${c.rate}% *` : `${c.rate}%`
      const topBorder = isGlobal ? `<tr><td colspan="3" style="padding-top:10px;border-top:2px solid #D2AB76"></td></tr>` : ''
      return `${topBorder}
      <tr style="${isGlobal ? 'background:#EAE6DF' : ''}">
        <td style="padding:8px 10px 3px;width:195px;vertical-align:middle">
          <span style="font-size:${isGlobal ? '13px' : '12px'};font-weight:${isGlobal ? '700' : '500'};color:#173731">${c.label}</span>
        </td>
        <td style="padding:8px 8px 3px 0;width:72px;text-align:right;white-space:nowrap;vertical-align:middle">
          <span style="font-size:${isGlobal ? '20px' : '15px'};font-weight:700;color:${barColor}">${rateLabel}</span>
        </td>
        <td style="padding:8px 10px 3px 0;text-align:right;white-space:nowrap;vertical-align:middle">
          <span style="font-size:10px;color:#bbb">${c.from} → ${c.to}</span>
        </td>
      </tr>
      <tr style="${isGlobal ? 'background:#EAE6DF' : ''}">
        <td colspan="3" style="padding:2px 10px ${isGlobal ? '10px' : '8px'}">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
            <td width="${bp}%" style="height:${isGlobal ? '12' : '8'}px;background:${barColor};border-radius:4px 0 0 4px"></td>
            <td width="${100 - bp}%" style="height:${isGlobal ? '12' : '8'}px;background:#E8E4DD;border-radius:0 4px 4px 0"></td>
          </tr></table>
        </td>
      </tr>`
    }).join('')
    const conversionFootnote = hasOverflow
      ? `<tr><td colspan="3" style="padding:10px 10px 0"><span style="font-size:10px;color:#aaa;font-style:italic">* Un taux &gt; 100% indique que certains profils atteignent cette étape via un chemin non linéaire (ex : skip d'une étape précédente).</span></td></tr>`
      : ''

    // ── Pipeline par source ──
    const pipelineSrcEntries = SOURCES
      .map(src => ({ src, data: pipelineBySource[src] }))
      .filter(e => e.data && e.data.total > 0)
      .sort((a, b) => b.data.total - a.data.total)
    const maxPipeSrc = Math.max(1, ...pipelineSrcEntries.map(e => e.data.total))

    const pipelineParSourceHtml = pipelineSrcEntries.length > 0
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px">` +
        pipelineSrcEntries.map(({ src, data }) => {
          const bp = Math.max(6, Math.round((data.total / maxPipeSrc) * 100))
          const pct2 = Math.round((data.total / totalActivePipeline) * 100)
          const color = SOURCE_COLORS[src] || '#94a3b8'
          return `<tr>
            <td style="padding:5px 10px 5px 0;width:150px;vertical-align:middle;white-space:nowrap">
              <table cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
                <td style="width:10px;height:10px;background:${color};border-radius:2px"></td>
                <td style="padding-left:6px;font-size:11px;color:#444">${src}</td>
              </tr></table>
            </td>
            <td style="padding:5px 10px 5px 0;vertical-align:middle">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
                <td width="${bp}%" style="height:12px;background:${color};border-radius:3px 0 0 3px"></td>
                <td width="${100 - bp}%" style="height:12px;background:#E8E4DD;border-radius:0 3px 3px 0"></td>
              </tr></table>
            </td>
            <td style="padding:5px 0 5px 8px;width:24px;text-align:right;vertical-align:middle">
              <span style="font-size:12px;font-weight:700;color:#173731">${data.total}</span>
            </td>
            <td style="padding:5px 0 5px 6px;width:34px;text-align:right;vertical-align:middle">
              <span style="font-size:10px;color:#aaa">${pct2}%</span>
            </td>
          </tr>`
        }).join('') + `</table>` +
        // Stage breakdown cards
        `<div style="font-size:12px;font-weight:600;color:#173731;margin-bottom:8px">Où en sont-ils dans le pipeline ?</div>` +
        `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr valign="top">` +
        pipelineSrcEntries.map(({ src, data }, i) => {
          const color = SOURCE_COLORS[src] || '#94a3b8'
          const stageRows = ALL_PIPELINE_STAGES
            .filter(stg => (data.stages[stg] || 0) > 0)
            .map(stg => `<tr>
              <td style="padding:3px 10px;font-size:10px;color:#666;border-bottom:1px solid #F0EDE7">${stg}</td>
              <td style="padding:3px 10px;font-size:10px;font-weight:600;color:${color};text-align:right;border-bottom:1px solid #F0EDE7">${data.stages[stg]}</td>
            </tr>`).join('')
          const card = `<div style="border:1px solid #E8E4DD;border-radius:6px;overflow:hidden;margin-bottom:8px">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#F5F3EF">
              <tr>
                <td style="padding:7px 10px;vertical-align:middle">
                  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse">
                    <tr>
                      <td style="width:9px;height:9px;background:${color};border-radius:2px;vertical-align:middle;font-size:0;line-height:0">&nbsp;</td>
                      <td style="padding-left:6px;font-size:11px;font-weight:600;color:#173731;vertical-align:middle">${src}</td>
                    </tr>
                  </table>
                </td>
                <td style="padding:7px 10px;text-align:right;font-size:10px;color:#aaa;vertical-align:middle;white-space:nowrap">${data.total} profils</td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${stageRows}</table>
          </div>`
          // 2 columns
          if (i % 2 === 0) return `<td width="50%" style="padding-right:5px">${card}`
          return `${card}</td>`
        }).join('') +
        (pipelineSrcEntries.length % 2 !== 0 ? `</td>` : '') +
        `</tr></table>`
      : '<p style="color:#bbb;font-size:12px">Aucun profil actif</p>'

    // ── Couverture géographique ──
    const regionEntries = REGIONS
      .map(reg => ({ reg, count: pipelineByRegion[reg] || 0 }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count)
    const maxReg = Math.max(1, ...regionEntries.map(e => e.count))
    const regionsZero = REGIONS.filter(r => !pipelineByRegion[r])

    const geoHtml = regionEntries.map(({ reg, count }) => {
      const bp = Math.max(4, Math.round((count / maxReg) * 100))
      const pct3 = Math.round((count / totalActivePipeline) * 100)
      return `<tr>
        <td style="padding:4px 10px 4px 0;font-size:11px;color:#444;width:200px;white-space:nowrap">${reg}</td>
        <td style="padding:4px 10px 4px 0;vertical-align:middle">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
            <td width="${bp}%" style="height:11px;background:#173731;border-radius:3px 0 0 3px"></td>
            <td width="${100 - bp}%" style="height:11px;background:#E8E4DD;border-radius:0 3px 3px 0"></td>
          </tr></table>
        </td>
        <td style="padding:4px 0 4px 6px;width:22px;text-align:right;font-size:11px;font-weight:600;color:#173731">${count}</td>
        <td style="padding:4px 0 4px 6px;width:30px;text-align:right;font-size:10px;color:#aaa">${pct3}%</td>
      </tr>`
    }).join('')
    const geoZeroHtml = regionsZero.map(reg =>
      `<tr><td style="padding:3px 10px 3px 0;font-size:10px;color:#ccc;width:200px">${reg}</td><td></td><td style="padding:3px 0;font-size:10px;color:#ddd;text-align:right">0</td><td style="padding:3px 0 3px 6px;font-size:10px;color:#ddd;text-align:right">—</td></tr>`
    ).join('')

    // ── Mouvements ──
    const entreesSourceRows = Object.entries(entreesParSource)
      .sort((a, b) => b[1] - a[1])
      .map(([src, n]) => {
        const color = SOURCE_COLORS[src] || '#94a3b8'
        return `<tr>
          <td style="padding:2px 0;font-size:10px;color:#3B6D11">${src}</td>
          <td style="padding:2px 0;font-size:10px;font-weight:700;color:#3B6D11;text-align:right">+${n}</td>
        </tr>`
      }).join('')

    const sortiesRows = sorties.map((p: any) => {
      const motif = p.maturity === 'Chute' ? (p.chute_type || 'Chute') : (p.pas_interesse_type || 'Pas intéressé')
      const motifColor = p.maturity === 'Chute' ? { bg: '#FCEBEB', color: '#A32D2D' } : { bg: '#FAEEDA', color: '#854F0B' }
      const stadeDepart = p.chute_stade || p.stage || '—'
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #F0EDE7;font-size:12px;color:#333">${p.first_name} ${p.last_name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #F0EDE7">${sourceBadge(p.source || '')}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #F0EDE7;font-size:11px;color:#555">${stadeDepart}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #F0EDE7">
          <span style="display:inline-block;font-size:10px;font-weight:600;padding:2px 7px;border-radius:8px;background:${motifColor.bg};color:${motifColor.color}">${motif}</span>
        </td>
        <td style="padding:6px 10px;border-bottom:1px solid #F0EDE7;font-size:11px;color:#555">${p.owner_full_name || '—'}</td>
      </tr>`
    }).join('')

    // ── En pause ──
    const enPauseRows = (enPauseRaw || []).map((p: any) => {
      const dur = weeksAgo(p.updated_at)
      const style = pauseStyle(p.updated_at)
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #F0EDE7;font-size:12px;color:#333">${p.first_name} ${p.last_name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #F0EDE7;font-size:11px;color:#555">${p.stage || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #F0EDE7">${sourceBadge(p.source || '')}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #F0EDE7">
          <span style="display:inline-block;font-size:10px;font-weight:600;padding:2px 7px;border-radius:8px;${style}">${dur}</span>
        </td>
        <td style="padding:6px 10px;border-bottom:1px solid #F0EDE7;font-size:11px;color:#555">${p.owner_full_name || '—'}</td>
      </tr>`
    }).join('')

    // ═══════════════════════════════════════════════
    // ASSEMBLAGE FINAL
    // ═══════════════════════════════════════════════

    const emailHtml = `
    <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;background:white">

      <div style="background:#173731;padding:24px 28px">
        <div style="font-size:18px;font-weight:600;color:#D2AB76;letter-spacing:0.3px">Rapport hebdomadaire</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px">Semaine du ${fmtFR(fmt(monday))} — Evolve Recruiter</div>
      </div>

      <div style="padding:24px 28px">

        ${section('R1 fixés', r1 || [], allR1?.length)}
        ${section("Points d'étape fixés", pointsEtape || [], allPointsEtape?.length)}
        ${section('R2 Amaury fixés', r2 || [], allR2?.length)}
        ${section('Points Business Plan fixés', pointsBP || [], allBP?.length)}

        <div style="margin-bottom:24px">
          <div style="font-size:14px;font-weight:600;color:#173731;border-bottom:2px solid #D2AB76;padding-bottom:5px;margin-bottom:10px">Prochaines sessions de formation</div>
          ${sessionsHtml}
        </div>

        <div style="margin-bottom:24px">
          <div style="font-size:14px;font-weight:600;color:#173731;border-bottom:2px solid #D2AB76;padding-bottom:5px;margin-bottom:10px">Objectifs 2026</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:10px">
            <tr>
              <td width="33%" style="padding-right:8px">
                <div style="background:#F5F3EF;padding:12px 14px;border-radius:6px;text-align:center">
                  <div style="font-size:22px;font-weight:700;color:#173731">${totalRecrutes}</div>
                  <div style="font-size:10px;color:#888;margin-top:2px">/ 30 recrutés</div>
                </div>
              </td>
              <td width="33%" style="padding-right:8px">
                <div style="background:#F5F3EF;padding:12px 14px;border-radius:6px;text-align:center">
                  <div style="font-size:22px;font-weight:700;color:#173731">${recrutesBaptiste}</div>
                  <div style="font-size:10px;color:#888;margin-top:2px">/ 15 Baptiste</div>
                </div>
              </td>
              <td width="33%">
                <div style="background:#F5F3EF;padding:12px 14px;border-radius:6px;text-align:center">
                  <div style="font-size:22px;font-weight:700;color:#173731">${recrutesAurelien}</div>
                  <div style="font-size:10px;color:#888;margin-top:2px">/ 15 Aurélien</div>
                </div>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            <tr>
              <td style="vertical-align:middle">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
                  <tr>
                    <td width="${pct}%" style="height:18px;background:#D2AB76;border-radius:4px 0 0 4px"></td>
                    <td width="${100 - pct}%" style="height:18px;background:#E8E4DD;border-radius:0 4px 4px 0"></td>
                  </tr>
                </table>
              </td>
              <td style="padding-left:10px;width:40px;text-align:right;vertical-align:middle;white-space:nowrap">
                <span style="font-size:13px;font-weight:700;color:#D2AB76">${pct}%</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- MOUVEMENTS -->
        <div style="margin-bottom:24px">
          <div style="font-size:14px;font-weight:600;color:#173731;border-bottom:2px solid #D2AB76;padding-bottom:5px;margin-bottom:12px">Mouvements de la semaine</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px">
            <tr valign="top">
              <td width="49%" style="padding-right:8px">
                <div style="background:#EAF3DE;border:1px solid #97C459;border-radius:6px;padding:12px 14px">
                  <div style="font-size:10px;font-weight:700;color:#3B6D11;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Entrées</div>
                  <div style="font-size:26px;font-weight:700;color:#3B6D11;line-height:1">${totalEntrees}</div>
                  <div style="font-size:10px;color:#888;margin-bottom:10px;margin-top:2px">nouveaux profils en R0</div>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${entreesSourceRows}</table>
                </div>
              </td>
              <td width="2%"></td>
              <td width="49%">
                <div style="background:#FCEBEB;border:1px solid #F09595;border-radius:6px;padding:12px 14px">
                  <div style="font-size:10px;font-weight:700;color:#A32D2D;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Sorties</div>
                  <div style="font-size:26px;font-weight:700;color:#A32D2D;line-height:1">${sorties.length}</div>
                  <div style="font-size:10px;color:#888;margin-bottom:10px;margin-top:2px">profils sortis du pipeline</div>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
                    <tr><td style="padding:2px 0;font-size:10px;color:#A32D2D">Chutes</td><td style="padding:2px 0;font-size:10px;font-weight:700;color:#A32D2D;text-align:right">${sorties.filter((s: any) => s.maturity === 'Chute').length}</td></tr>
                    <tr><td style="padding:2px 0;font-size:10px;color:#A32D2D">Pas intéressés</td><td style="padding:2px 0;font-size:10px;font-weight:700;color:#A32D2D;text-align:right">${sorties.filter((s: any) => s.maturity === 'Pas intéressé').length}</td></tr>
                  </table>
                </div>
              </td>
            </tr>
          </table>
          ${sorties.length > 0 ? `
          <div style="font-size:12px;font-weight:600;color:#555;margin-bottom:6px">Détail des sorties</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#173731;color:#D2AB76">
              <th style="padding:6px 10px;text-align:left;font-weight:400">Nom</th>
              <th style="padding:6px 10px;text-align:left;font-weight:400">Source</th>
              <th style="padding:6px 10px;text-align:left;font-weight:400">Stade au départ</th>
              <th style="padding:6px 10px;text-align:left;font-weight:400">Motif</th>
              <th style="padding:6px 10px;text-align:left;font-weight:400">Référent</th>
            </tr></thead><tbody>${sortiesRows}</tbody>
          </table>` : ''}
        </div>

        <!-- EN PAUSE -->
        ${(enPauseRaw || []).length > 0 ? `
        <div style="margin-bottom:24px">
          <div style="font-size:14px;font-weight:600;color:#173731;border-bottom:2px solid #D2AB76;padding-bottom:5px;margin-bottom:6px">Profils en pause — ${(enPauseRaw || []).length}</div>
          <div style="font-size:11px;color:#aaa;margin-bottom:8px">À relancer selon les délais — trié du plus récent au plus ancien</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#173731;color:#D2AB76">
              <th style="padding:6px 10px;text-align:left;font-weight:400">Nom</th>
              <th style="padding:6px 10px;text-align:left;font-weight:400">Stade</th>
              <th style="padding:6px 10px;text-align:left;font-weight:400">Source</th>
              <th style="padding:6px 10px;text-align:left;font-weight:400">En pause depuis</th>
              <th style="padding:6px 10px;text-align:left;font-weight:400">Référent</th>
            </tr></thead><tbody>${enPauseRows}</tbody>
          </table>
        </div>` : ''}

        <!-- RECRUTÉS PAR SOURCE -->
        <div style="margin-bottom:24px">
          <div style="font-size:14px;font-weight:600;color:#173731;border-bottom:2px solid #D2AB76;padding-bottom:5px;margin-bottom:6px">Recrutements confirmés par source</div>
          <div style="font-size:11px;color:#aaa;margin-bottom:12px">D'où viennent les ${totalRecrutes} profils recrutés ?</div>
          ${recrutesBySourceHtml}
        </div>

        <!-- TAUX DE CONVERSION -->
        <div style="margin-bottom:24px;background:#F5F3EF;border-radius:10px;padding:20px 22px;border:1px solid #E8E4DD">
          <div style="font-size:15px;font-weight:700;color:#173731;margin-bottom:3px">Taux de conversion par étape</div>
          <div style="font-size:11px;color:#aaa;margin-bottom:14px">% de profils passant d'une étape à la suivante</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${conversionsHtml}${conversionFootnote}</table>
        </div>

        <!-- PIPELINE PAR SOURCE -->
        <div style="margin-bottom:24px">
          <div style="font-size:14px;font-weight:600;color:#173731;border-bottom:2px solid #D2AB76;padding-bottom:5px;margin-bottom:6px">Pipeline actuel par source</div>
          <div style="font-size:11px;color:#aaa;margin-bottom:12px">Répartition des <strong style="color:#173731">${totalActivePipeline} profils actifs</strong> dans le pipeline par canal d'acquisition</div>
          ${pipelineParSourceHtml}
        </div>

        <!-- COUVERTURE GÉO -->
        <div style="margin-bottom:8px">
          <div style="font-size:14px;font-weight:600;color:#173731;border-bottom:2px solid #D2AB76;padding-bottom:5px;margin-bottom:6px">Couverture géographique du pipeline</div>
          <div style="font-size:11px;color:#aaa;margin-bottom:12px">Profils actifs par région (hors Chute / Pas intéressé / Archivé)</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            ${geoHtml}${geoZeroHtml}
          </table>
        </div>

      </div>
    </div>`

    return new Response(
      JSON.stringify({
        success: true,
        html: emailHtml,
        subject: '🎯 Rapport Hebdo — Semaine du ' + fmtFR(fmt(monday))
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
