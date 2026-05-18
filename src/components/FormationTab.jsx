import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ACCENT = '#173731'
const GOLD   = '#D2AB76'
const BG     = '#F5F0E8'

// ── Helpers date ──────────────────────────────────────────────────────────────
function addMonths(dateStr, n) {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + n)
  return d
}
function subDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - n)
  return d
}
function ymd(d) {
  return d.toISOString().split('T')[0]
}
function formatDateFr(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
function daysFromNow(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr); target.setHours(0,0,0,0)
  return Math.round((target - today) / 86400000)
}

// ── Définition des 4 jalons ───────────────────────────────────────────────────
const JALON_DEFS = [
  {
    type: 'M2',
    label: 'M-2',
    title: 'Book pré-intégration',
    desc: 'Book pré-intégration + Excel contacts',
    computeDate: (ds) => ymd(addMonths(ds, -2)),
    individual: true,
  },
  {
    type: 'M1',
    label: 'M-1',
    title: 'Planning formation',
    desc: 'Envoi du planning via Brevo',
    computeDate: (ds) => ymd(addMonths(ds, -1)),
    brevo: true,
  },
  {
    type: 'J15',
    label: 'J-15',
    title: 'Book modèle économique',
    desc: 'Comprendre ta rémunération',
    computeDate: (ds) => ymd(subDays(ds, 15)),
    individual: true,
  },
  {
    type: 'J7',
    label: 'J-7',
    title: 'Récap agenda + promo',
    desc: 'Agenda, participants, infos pratiques',
    computeDate: (ds) => ymd(subDays(ds, 7)),
    group: true,
  },
]

// ── Templates mail (HTML exact depuis les .docx) ─────────────────────────────

function openGmailCompose(to, subject) {
  window.open(
    `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}`,
    '_blank'
  )
}

function copyHtml(htmlStr) {
  // Méthode execCommand : copie le HTML rendu, préserve le formatage dans Gmail
  try {
    const div = document.createElement('div')
    div.contentEditable = 'true'
    div.innerHTML = htmlStr
    div.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;background:white;color:#000'
    document.body.appendChild(div)
    div.focus()
    const range = document.createRange()
    range.selectNodeContents(div)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    document.execCommand('copy')
    sel.removeAllRanges()
    document.body.removeChild(div)
    return
  } catch (_) {}
  // Fallback : texte brut
  const plainStr = htmlStr.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
  navigator.clipboard.writeText(plainStr).catch(() => {})
}

// Pièces jointes J-15
const PJ_J15 = [
  {
    label: '📎 Comprendre ta rémunération',
    downloadUrl: 'https://drive.google.com/file/d/1AJhXlJVZEIhR40EX_oFQfP88EPbXZkpu/view?usp=drive_link',
  },
]

// Pièces jointes M-2 — s'ouvrent dans Drive/Sheets, télécharger depuis là
const PJ_M2 = [
  {
    label: '📎 Book pré-intégration',
    downloadUrl: 'https://drive.google.com/file/d/1UeN-i9eqSWBCXaBeJvzScREBW6pKV3S8/view?usp=drive_link',
  },
  {
    label: '📎 Excel contacts (3 listes)',
    downloadUrl: 'https://docs.google.com/spreadsheets/d/1pSeUYzgIkcQNxEW4B_ADHN23xz6paNv94LMLjPnfD4k/edit?usp=drive_link',
  },
]

function htmlM2(profile) {
  const fn = profile.first_name || ''
  return `<p>${fn},</p>
<p>Nous sommes à 2 mois du début de la formation !</p>
<p>Les dates précises te seront communiquées très prochainement.</p>
<p>En attendant, tu peux retrouver en pièce jointe ton <strong>book de pré-intégration</strong>.</p>
<p>Prends le temps de le lire tranquillement, il y a tout ce qu'il faut savoir avant la formation : comment fonctionne Evolve, les premiers mois d'activité et les témoignages de ceux qui sont passés par là avant toi.</p>
<p>La seule chose que tu as à faire d'ici la formation : <strong>préparer tes trois listes de contacts</strong>. Tu peux également retrouver en PJ un tableau Excel avec un fichier tout prêt : <strong>c'est simple et ça change tout au démarrage</strong>.</p>
<p>Pour les démarches administratives, on s'occupe de tout. Tu n'as rien à gérer de ton côté, et tu recevras les informations au fil de l'eau.</p>
<p>Je reste disponible si tu as des questions.</p>
<p>Bonne journée à toi !</p>`
}

function subjectM2(profile) {
  return `${profile.first_name || ''} ${profile.last_name || ''} / Book pré-intégration`
}

function htmlJ15(profile) {
  const fn = profile.first_name || ''
  return `<p>Bonjour ${fn},</p>
<p><strong>J-15 ! Dans deux semaines, ton aventure commence.</strong></p>
<p>On est vraiment contents de t'accueillir dans l'équipe Evolve, et on a hâte de te voir construire quelque chose de grand. Les conseillers qui réussissent ici ne sont pas forcément ceux qui en savent le plus au départ. Ce sont ceux qui comprennent vite <strong>les règles du jeu</strong>.</p>
<p>C'est exactement pour ça qu'on t'envoie ce document en avance : <strong>« Comprendre ta rémunération »</strong>. Pas pour t'assommer de chiffres, mais pour que tu arrives en formation avec une vision claire de ce que tu peux construire, et surtout de comment.</p>
<p>Un bon mois chez Evolve, ça ressemble à quoi concrètement ? Qu'est-ce qui génère vraiment de la rémunération ? Quels sont les leviers sur lesquels jouer dès le départ ? Ce document répond à tout ça.</p>
<p>Prends le temps de le lire avant la formation, tu verras que ça aide vraiment sur la façon d'aborder les premières semaines.</p>
<p>Et si quelque chose te questionne à la lecture, note-le. On en parlera ensemble.</p>
<p>À dans 15 jours !</p>`
}

function subjectJ15(profile) {
  return `${profile.first_name || ''} ${profile.last_name || ''} / Book modèle économique`
}

const PROGRAMME_TABLE = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px">
  <tr style="background:#f5f5f5">
    <th style="border:1px solid #ddd;padding:8px;text-align:left">Jour</th>
    <th style="border:1px solid #ddd;padding:8px;text-align:left">Horaires</th>
    <th style="border:1px solid #ddd;padding:8px;text-align:left">Au programme</th>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:8px">Lundi</td>
    <td style="border:1px solid #ddd;padding:8px">9h00 · 18h00</td>
    <td style="border:1px solid #ddd;padding:8px">Accueil &amp; petit déjeuner · Présentation Evolve · L'environnement de la gestion de patrimoine · Le marché de l'épargne</td>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:8px">Mardi</td>
    <td style="border:1px solid #ddd;padding:8px">9h30 · 18h00</td>
    <td style="border:1px solid #ddd;padding:8px">Approche fiscale et juridique du patrimoine</td>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:8px">Mercredi</td>
    <td style="border:1px solid #ddd;padding:8px">9h30 · 18h00</td>
    <td style="border:1px solid #ddd;padding:8px">Méthodologie de vente · Mécanisme de rémunération · Gamme produits</td>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:8px">Jeudi</td>
    <td style="border:1px solid #ddd;padding:8px">9h30 · 18h00</td>
    <td style="border:1px solid #ddd;padding:8px">Découverte des supports d'épargne · Classes d'actifs · Présentation des sociétés de gestion · Afterwork</td>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:8px">Vendredi</td>
    <td style="border:1px solid #ddd;padding:8px">10h00 · 16h00</td>
    <td style="border:1px solid #ddd;padding:8px">Evolve Office · Parcours réglementaire · Atelier RDV</td>
  </tr>
</table>`

function htmlJ7(sessionCgps, sessionLabel) {
  const participantList = sessionCgps.map(c =>
    `<p><strong>${c.first_name} ${c.last_name}</strong>  ·  ${c.city || '—'}<br><em>[Une à deux phrases sur son parcours, d'où il vient]</em></p>`
  ).join('\n')
  return `<p>Bonjour à tous !</p>
<p>Plus que 7 jours ! La promotion <strong>${sessionLabel}</strong> est sur le point de démarrer et franchement, on a vraiment hâte de vous retrouver tous ensemble la semaine prochaine.</p>
<p>On commence la semaine comme il se doit : autour d'un <strong>petit déjeuner d'accueil lundi matin à 9h15 !</strong> C'est le moment pour se retrouver, faire connaissance et démarrer dans la bonne ambiance avant de rentrer dans le vif du sujet.</p>
<p><em>Adresse : 13 Bd Malesherbes – 75008 Paris</em></p>
<p>Si ce n'est pas encore fait, prenez quelques minutes cette semaine pour <strong>finaliser le remplissage de vos contacts</strong> sur votre tableau. On va travailler dessus directement pendant la formation, et plus votre liste est complète, plus les exercices seront concrets et utiles pour vous.</p>
<p><strong>Rappel du programme de la semaine</strong></p>
${PROGRAMME_TABLE}
<br>
<p><strong>Votre promotion !</strong></p>
<p>Vous serez <strong>${sessionCgps.length} conseillers</strong> à démarrer ensemble cette semaine ! Pour que vous puissiez vous retrouver lundi en vous connaissant déjà un peu, voici un rapide tour de table :</p>
${participantList}
<p>On est vraiment impatients de vous voir démarrer cette semaine ! C'est le début d'une superbe aventure, alors profitez-en à fond.</p>
<p><strong>À lundi !</strong></p>`
}

function subjectJ7(sessionLabel) {
  return `Promotion ${sessionLabel} · On se retrouve dans 7 jours !`
}

// ── Composant JalonRow ────────────────────────────────────────────────────────
function JalonRow({ def, dueDate, sent, onMarkSent, htmlBody, gmailTo, gmailSubject, pjList }) {
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)
  const today = ymd(new Date())
  const diff = daysFromNow(dueDate)
  const isOverdue = !sent && dueDate < today
  const isToday   = !sent && dueDate === today
  const isSoon    = !sent && diff > 0 && diff <= 5

  let rowBg = '#FAFAF8'; let borderLeft = '3px solid transparent'
  let tagColor = '#999'; let tagLabel = `Dans ${diff} jour${Math.abs(diff) > 1 ? 's' : ''}`
  if (sent)        { rowBg = '#F0FDF4'; borderLeft = '3px solid #BBF7D0'; tagColor = '#059669'; tagLabel = 'Envoyé ✓' }
  else if (isOverdue){ rowBg = '#FEF2F2'; borderLeft = '3px solid #FECACA'; tagColor = '#DC2626'; tagLabel = `En retard (${Math.abs(diff)}j)` }
  else if (isToday)  { rowBg = '#FFFBEB'; borderLeft = '3px solid #FDE68A'; tagColor = '#D97706'; tagLabel = "Aujourd'hui !" }
  else if (isSoon)   { rowBg = '#FFFBEB'; borderLeft = '3px solid #FDE68A'; tagColor = '#D97706'; tagLabel = `Dans ${diff} jour${diff > 1 ? 's' : ''}` }

  const handleCopy = () => {
    if (htmlBody) {
      copyHtml(htmlBody)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{ borderRadius: 6, border: '0.5px solid #E5E0D8', borderLeft, background: rowBg, overflow: 'hidden' }}>
      {/* Ligne principale */}
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', alignItems: 'center', gap: 12, padding: '8px 14px' }}>
        {/* Tag date */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: tagColor }}>{tagLabel}</div>
          <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>{formatDateFr(dueDate)}</div>
        </div>

        {/* Content */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{def.title}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{def.desc}</div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Boutons téléchargement PJ (M-2) */}
          {!sent && pjList && pjList.map(pj => (
            <a
              key={pj.label}
              href={pj.downloadUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '0.5px solid #D2AB76', background: '#FEFBF5', color: '#92713A', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              {pj.label}
            </a>
          ))}
          {sent ? (
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, background: '#DCFCE7', color: '#059669', border: '0.5px solid #BBF7D0' }}>✓ Envoyé</span>
          ) : def.brevo ? (
            <button onClick={onMarkSent} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: `0.5px solid ${ACCENT}`, background: 'white', color: ACCENT, cursor: 'pointer', fontFamily: 'inherit' }}>
              Marquer envoyé (Brevo)
            </button>
          ) : (
            <>
              {/* Bouton prévisualiser */}
              <button onClick={() => setShowPreview(p => !p)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '0.5px solid #D5CFC5', background: 'white', color: '#666', cursor: 'pointer', fontFamily: 'inherit' }}>
                {showPreview ? '▲ Masquer' : '▼ Voir le mail'}
              </button>
              {/* Copier */}
              <button onClick={handleCopy} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: `0.5px solid ${ACCENT}`, background: copied ? '#DCFCE7' : 'white', color: copied ? '#059669' : ACCENT, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s' }}>
                {copied ? '✓ Copié !' : 'Copier le corps'}
              </button>
              {/* Ouvrir Gmail */}
              <button onClick={() => openGmailCompose(gmailTo, gmailSubject)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: 'none', background: ACCENT, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                {def.group ? 'Gmail promo' : 'Ouvrir Gmail'}
              </button>
              {/* Marquer envoyé */}
              <button onClick={onMarkSent} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '0.5px solid #aaa', background: 'white', color: '#666', cursor: 'pointer', fontFamily: 'inherit' }}>
                ✓ Envoyé
              </button>
            </>
          )}
        </div>
      </div>

      {/* Prévisualisation du mail */}
      {showPreview && htmlBody && (
        <div style={{ borderTop: '0.5px solid #E5E0D8', padding: '12px 16px', background: 'white' }}>
          <div style={{ fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
            Aperçu · {def.group ? 'Tous les CGPs de la session' : 'Mail individuel'} · <em style={{ fontWeight: 400 }}>Copier le corps puis coller dans Gmail</em>
          </div>
          <div
            style={{ fontSize: 13, lineHeight: 1.7, color: '#333', maxHeight: 400, overflowY: 'auto', padding: '4px 0' }}
            dangerouslySetInnerHTML={{ __html: htmlBody }}
          />
        </div>
      )}
    </div>
  )
}

// ── Composant CgpCard ─────────────────────────────────────────────────────────
function CgpCard({ profile, session, sessionCgps, jalonsMap, onMarkSent }) {
  const [open, setOpen] = useState(false)
  const ds = session.date_session

  const jalon_defs_with_dates = JALON_DEFS.map(def => ({
    ...def,
    dueDate: def.computeDate(ds),
    sent: !!(jalonsMap[profile.id]?.[def.type]?.sent_at),
  }))

  const hasOverdue = jalon_defs_with_dates.some(j => !j.sent && j.dueDate < ymd(new Date()))
  const hasToday   = jalon_defs_with_dates.some(j => !j.sent && j.dueDate === ymd(new Date()))
  const allOk      = jalon_defs_with_dates.every(j => j.sent)
  const sentCount  = jalon_defs_with_dates.filter(j => j.sent).length

  const initials = ((profile.first_name || '')[0] || '') + ((profile.last_name || '')[0] || '')
  const sessionLabel = session.periode ? `${session.periode} ${session.annee || ''}`.trim() : formatDateFr(ds)
  const today = ymd(new Date())
  const diffSession = daysFromNow(ds)

  let borderLeft = '3px solid #E5E0D8'
  let pillBg = '#F5F0E8'; let pillColor = '#888'; let pillLabel = `${sentCount}/4 envoyés`
  if (allOk)        { borderLeft = '3px solid #16a34a'; pillBg = '#DCFCE7'; pillColor = '#059669'; pillLabel = '✓ Tout envoyé' }
  else if (hasOverdue){ borderLeft = '3px solid #DC2626'; pillBg = '#FEE2E2'; pillColor = '#DC2626'; pillLabel = 'En retard' }
  else if (hasToday)  { borderLeft = '3px solid #D97706'; pillBg = '#FEF3C7'; pillColor = '#D97706'; pillLabel = "À envoyer auj." }

  const getMailProps = (def) => {
    if (def.type === 'M2')  return { htmlBody: htmlM2(profile),  gmailTo: profile.email || '', gmailSubject: subjectM2(profile), pjList: PJ_M2 }
    if (def.type === 'J15') return { htmlBody: htmlJ15(profile), gmailTo: profile.email || '', gmailSubject: subjectJ15(profile), pjList: PJ_J15 }
    if (def.type === 'J7')  return { htmlBody: htmlJ7(sessionCgps, sessionLabel), gmailTo: sessionCgps.map(c => c.email).filter(Boolean).join(', '), gmailSubject: subjectJ7(sessionLabel) }
    return {}
  }

  return (
    <div style={{ background: 'white', border: '0.5px solid #E5E0D8', borderLeft, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#E8E4DC', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>{profile.first_name} {profile.last_name}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{profile.city || '—'} · J-{Math.max(0, diffSession)} avant formation</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 12, background: pillBg, color: pillColor }}>{pillLabel}</span>
          <span style={{ fontSize: 10, color: '#aaa' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Jalons */}
      {open && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {jalon_defs_with_dates.map(def => (
            <JalonRow
              key={def.type}
              def={def}
              dueDate={def.dueDate}
              sent={def.sent}
              onMarkSent={() => onMarkSent(profile.id, session.id, def.type)}
              {...getMailProps(def)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Composant principal FormationTab ──────────────────────────────────────────
export default function FormationTab() {
  const { userProfile } = useAuth()
  const [sessions, setSessions]     = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [cgps, setCgps]             = useState([])
  const [jalonsMap, setJalonsMap]   = useState({})  // { profileId: { M2: row, M1: row, ... } }
  const [loading, setLoading]       = useState(true)
  const [cgpsLoading, setCgpsLoading] = useState(false)

  // Charger les sessions
  useEffect(() => {
    supabase.from('sessions_formation')
      .select('*')
      .order('date_session', { ascending: true })
      .then(({ data }) => {
        const all = data || []
        setSessions(all)
        if (all.length > 0) {
          // Sélectionner la prochaine session à venir (ou la 1ère si toutes passées)
          const today = ymd(new Date())
          const next = all.find(s => s.date_session >= today) || all[0]
          setSelectedId(next.id)
        }
        setLoading(false)
      })
  }, [])

  // Charger les CGPs et jalons de la session sélectionnée
  const loadSession = useCallback(async (sessionId) => {
    if (!sessionId) return
    setCgpsLoading(true)
    // Charger uniquement les profils confirmés en onboarding pour cette session
    // (stage = 'Recruté' + integration_confirmed = true, exclure archivés)
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, city, region, stage, maturity, integration_confirmed')
      .eq('session_formation_id', sessionId)
      .eq('stage', 'Recruté')
      .eq('integration_confirmed', true)
      .neq('maturity', 'Archivé')

    const profiles = profilesData || []
    setCgps(profiles)

    // Charger les jalons existants pour ces profils
    if (profiles.length > 0) {
      const ids = profiles.map(p => p.id)
      const { data: jalonsData } = await supabase
        .from('formation_jalons')
        .select('*')
        .in('profile_id', ids)

      // Indexer par profileId -> type
      const map = {}
      ;(jalonsData || []).forEach(j => {
        if (!map[j.profile_id]) map[j.profile_id] = {}
        map[j.profile_id][j.type] = j
      })
      setJalonsMap(map)
    } else {
      setJalonsMap({})
    }
    setCgpsLoading(false)
  }, [])

  useEffect(() => {
    loadSession(selectedId)
  }, [selectedId, loadSession])

  // Marquer un jalon comme envoyé
  const markSent = useCallback(async (profileId, sessionId, type) => {
    const sentBy = userProfile?.full_name?.trim() || 'Baptiste'
    const sentAt = new Date().toISOString()
    await supabase.from('formation_jalons').upsert(
      { profile_id: profileId, session_id: sessionId, type, sent_at: sentAt, sent_by: sentBy },
      { onConflict: 'profile_id,type' }
    )
    // Mettre à jour localement
    setJalonsMap(prev => ({
      ...prev,
      [profileId]: {
        ...(prev[profileId] || {}),
        [type]: { profile_id: profileId, session_id: sessionId, type, sent_at: sentAt, sent_by: sentBy }
      }
    }))
  }, [userProfile])

  const selectedSession = sessions.find(s => s.id === selectedId)
  const today = ymd(new Date())

  // Stats de la session sélectionnée
  const totalJalons = cgps.length * 4
  const sentJalons  = Object.values(jalonsMap).reduce((acc, types) =>
    acc + Object.values(types).filter(j => j.sent_at).length, 0)
  const overdueCount = cgps.reduce((acc, p) => {
    return acc + JALON_DEFS.filter(def => {
      if (!selectedSession) return false
      const due = def.computeDate(selectedSession.date_session)
      return !jalonsMap[p.id]?.[def.type]?.sent_at && due < today
    }).length
  }, 0)
  const todayCount = cgps.reduce((acc, p) => {
    return acc + JALON_DEFS.filter(def => {
      if (!selectedSession) return false
      const due = def.computeDate(selectedSession.date_session)
      return !jalonsMap[p.id]?.[def.type]?.sent_at && due === today
    }).length
  }, 0)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, color: '#aaa', fontSize: 13 }}>
      Chargement…
    </div>
  )

  if (sessions.length === 0) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
      Aucune session de formation trouvée. Créez une session depuis le Pipeline.
    </div>
  )

  const sessionLabel = selectedSession?.periode
    ? `${selectedSession.periode} ${selectedSession.annee || ''}`.trim()
    : formatDateFr(selectedSession?.date_session)

  return (
    <div style={{ padding: '0 24px 24px' }}>

      {/* Sélecteur de sessions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {sessions.map(s => {
          const label = s.periode ? `${s.periode} ${s.annee || ''}`.trim() : formatDateFr(s.date_session)
          const isPast = s.date_session < today
          return (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${s.id === selectedId ? ACCENT : '#D5CFC5'}`,
                background: s.id === selectedId ? ACCENT : 'white',
                color: s.id === selectedId ? 'white' : (isPast ? '#aaa' : '#444'),
                opacity: isPast ? 0.7 : 1,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Bannière alerte si retard ou envoi du jour */}
      {(overdueCount > 0 || todayCount > 0) && (
        <div style={{ background: overdueCount > 0 ? '#FEF2F2' : '#FFFBEB', border: `0.5px solid ${overdueCount > 0 ? '#FECACA' : '#FDE68A'}`, borderRadius: 8, padding: '9px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ fontSize: 14 }}>{overdueCount > 0 ? '⚠' : '→'}</span>
          <span style={{ color: overdueCount > 0 ? '#991B1B' : '#92400E' }}>
            {overdueCount > 0 && <><strong>{overdueCount} jalon{overdueCount > 1 ? 's' : ''} en retard</strong> pour la session {sessionLabel}. </>}
            {todayCount > 0 && <><strong>{todayCount} envoi{todayCount > 1 ? 's' : ''} à faire aujourd'hui.</strong></>}
          </span>
        </div>
      )}

      {/* Stats */}
      {selectedSession && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'CGPs inscrits', value: cgps.length, color: ACCENT },
            { label: 'En retard', value: overdueCount, color: overdueCount > 0 ? '#DC2626' : '#888' },
            { label: "Aujourd'hui", value: todayCount, color: todayCount > 0 ? '#D97706' : '#888' },
            { label: 'Jalons envoyés', value: `${sentJalons} / ${totalJalons}`, color: '#059669' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', border: '0.5px solid #E5E0D8', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Date de formation */}
      {selectedSession && (
        <div style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>
          Formation · <strong style={{ color: ACCENT }}>{formatDateFr(selectedSession.date_session)}</strong>
          {selectedSession.lieu ? ` · ${selectedSession.lieu}` : ''}
        </div>
      )}

      {/* Liste CGPs */}
      {cgpsLoading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Chargement…</div>
      ) : cgps.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
          Aucun CGP inscrit sur cette session.<br />
          <span style={{ fontSize: 11 }}>Assignez des CGPs à cette session depuis le Pipeline.</span>
        </div>
      ) : (
        <div>
          {cgps.map(profile => (
            <CgpCard
              key={profile.id}
              profile={profile}
              session={selectedSession}
              sessionCgps={cgps}
              jalonsMap={jalonsMap}
              onMarkSent={markSent}
            />
          ))}
        </div>
      )}
    </div>
  )
}
