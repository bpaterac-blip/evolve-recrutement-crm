import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Permet de tester avec une date spécifique via ?date=YYYY-MM-DD
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

    // R1 cette semaine
    const { data: r1 } = await supabase
      .from('profiles')
      .select('first_name, last_name, company, city, next_event_date, owner_full_name')
      .eq('next_event_label', 'R1')
      .gte('next_event_date', fmt(monday))
      .lte('next_event_date', fmt(friday))
      .order('next_event_date')

    // Tous les R1 programmés
    const { data: allR1 } = await supabase
      .from('profiles')
      .select('first_name, last_name, company, city, next_event_date, owner_full_name')
      .eq('next_event_label', 'R1')
      .order('next_event_date')

    // Points d'étape cette semaine
    const { data: pointsEtape } = await supabase
      .from('profiles')
      .select('first_name, last_name, company, city, next_event_date, owner_full_name')
      .eq('next_event_label', "Point d'étape")
      .gte('next_event_date', fmt(monday))
      .lte('next_event_date', fmt(friday))
      .order('next_event_date')

    // Tous les points d'étape
    const { data: allPointsEtape } = await supabase
      .from('profiles')
      .select('first_name, last_name, company, city, next_event_date, owner_full_name')
      .eq('next_event_label', "Point d'étape")
      .order('next_event_date')

    // R2 Amaury cette semaine
    const { data: r2 } = await supabase
      .from('profiles')
      .select('first_name, last_name, company, city, next_event_date, owner_full_name')
      .eq('next_event_label', 'R2 Amaury')
      .gte('next_event_date', fmt(monday))
      .lte('next_event_date', fmt(friday))
      .order('next_event_date')

    // Points Business Plan cette semaine
    const { data: pointsBP } = await supabase
      .from('profiles')
      .select('first_name, last_name, company, city, next_event_date, owner_full_name')
      .eq('next_event_label', 'Point Business Plan')
      .gte('next_event_date', fmt(monday))
      .lte('next_event_date', fmt(friday))
      .order('next_event_date')

    // Sessions à venir (2 prochaines, exclure les passées)
    const { data: sessions } = await supabase
      .from('sessions_formation')
      .select('*')
      .neq('statut', 'passée')
      .order('date_debut', { ascending: true, nullsFirst: false })
      .limit(2)

    // Profils liés à une session
    const { data: profilsSession } = await supabase
      .from('profiles')
      .select('first_name, last_name, city, stage, maturity, owner_full_name, integration_confirmed, session_formation_id')
      .not('session_formation_id', 'is', null)
      .not('stage', 'in', '("R0","R1","Pas intéressé","Chute")')
      .not('maturity', 'eq', 'Chute')

    // Recrutés 2026
    const { data: recrutes } = await supabase
      .from('profiles')
      .select('first_name, last_name, owner_full_name')
      .eq('stage', 'Recruté')

    const totalRecrutes = recrutes?.length || 0
    const recrutesAurelien = recrutes?.filter(r => 
      r.owner_full_name?.includes('Goutard') || r.owner_full_name?.includes('Aurélien')
    ).length || 0
    const recrutesBaptiste = recrutes?.filter(r => 
      r.owner_full_name?.includes('PATERAC') || r.owner_full_name?.includes('Baptiste')
    ).length || 0

    const profileRow = (p: any) => 
      `<tr>
        <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#1A1A1A">${p.first_name} ${p.last_name}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.company || '—'}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.city || '—'}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.next_event_date ? fmtFR(p.next_event_date) : '—'}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.owner_full_name || '—'}</td>
      </tr>`

    const tableStart = `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px">
      <thead><tr style="background:#173731;color:#D2AB76">
        <th style="padding:8px 14px;text-align:left;font-weight:500">Nom</th>
        <th style="padding:8px 14px;text-align:left;font-weight:500">Entreprise</th>
        <th style="padding:8px 14px;text-align:left;font-weight:500">Ville</th>
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
      const allProfiles = profilsSession?.filter(p => p.session_formation_id === session.id) || []
      const sessionConfirmes = allProfiles.filter(p => p.integration_confirmed === true)
      const sessionPotentiels = allProfiles.filter(p => p.integration_confirmed !== true)

      const confirmeRows = sessionConfirmes.length > 0
        ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px">
            <thead><tr style="background:#173731;color:#D2AB76">
              <th style="padding:8px 14px;text-align:left;font-weight:500">Nom</th>
              <th style="padding:8px 14px;text-align:left;font-weight:500">Ville</th>
              <th style="padding:8px 14px;text-align:left;font-weight:500">Référent</th>
            </tr></thead><tbody>
            ${sessionConfirmes.map(p => `<tr>
              <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD">${p.first_name} ${p.last_name}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.city || '—'}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.owner_full_name || '—'}</td>
            </tr>`).join('')}
            </tbody></table>`
        : '<p style="color:#999;font-size:13px;margin:4px 0">Aucun confirmé</p>'

      const potentielRows = sessionPotentiels.length > 0
        ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px">
            <thead><tr style="background:#F5F3EF;color:#173731">
              <th style="padding:8px 14px;text-align:left;font-weight:500">Nom</th>
              <th style="padding:8px 14px;text-align:left;font-weight:500">Ville</th>
              <th style="padding:8px 14px;text-align:left;font-weight:500">Maturité</th>
              <th style="padding:8px 14px;text-align:left;font-weight:500">Référent</th>
            </tr></thead><tbody>
            ${sessionPotentiels.map(p => `<tr>
              <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD">${p.first_name} ${p.last_name}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #E8E4DD;color:#555">${p.city || '—'}</td>
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
