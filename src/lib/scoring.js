/**
 * Scoring CGP Evolve : employeur captif, intitulé, ancienneté, expériences passées, formation
 * Employeur captif = 50pts | CGP/BP = 30pts | Ancienneté 3-10 ans = 20pts
 * BONUS: CGP dans exp passées = +20pts | Formation Master/Gestion Patrimoine = +10pts
 */
const CGP_TITLE_KEYWORDS = ['cgp', 'conseiller en gestion de patrimoine', 'conseiller gestion patrimoine', 'gestionnaire patrimoine', 'banquier privé', 'conseiller patrimonial', 'wealth', 'conseiller en gestion']
const BANK_KEYWORDS = ['crédit agricole', 'bnp', 'société générale', 'axa', 'generali', 'lcl', "caisse d'épargne", 'banque populaire', 'crédit mutuel', 'swiss life', 'ag2r', 'groupama']
const FORMATION_CGP = ['master', 'ms ', 'mastère', 'gestion de patrimoine', 'gestionnaire patrimoine', 'cgp', 'conseiller patrimoine']

const CAPTIF_EMPLOYER = 50
const CGP_TITLE = 30
const TENURE_3_10 = 20
const PAST_CGP_BONUS = 20
const FORMATION_BONUS = 10

function parseTenureYears(dur) {
  if (!dur || typeof dur !== 'string') return 0
  const m = dur.match(/(\d+)\s*ans?/i)
  if (m) return parseInt(m[1], 10)
  const mo = dur.match(/(\d+)\s*mois/i)
  if (mo) return parseInt(mo[1], 10) / 12
  return 0
}

export function calculateScore(profile) {
  let score = 0
  const ti = (profile.ti || profile.title || '').toLowerCase()
  const co = (profile.co || profile.company || '').toLowerCase()
  const dur = profile.dur || profile.duration || ''
  const experiences = Array.isArray(profile.experiences) ? profile.experiences : []
  const formation = (profile.formation || '').toLowerCase()

  if (BANK_KEYWORDS.some((k) => co.includes(k))) score += CAPTIF_EMPLOYER
  else if (co && co !== '—') score += 25

  if (CGP_TITLE_KEYWORDS.some((k) => ti.includes(k))) score += CGP_TITLE
  else if (ti.includes('conseiller') || ti.includes('gestionnaire') || ti.includes('banquier')) score += 15

  const years = parseTenureYears(dur)
  if (years >= 3 && years <= 10) score += TENURE_3_10
  else if (years > 10) score += 10
  else if (years >= 1) score += 5

  const hasPastCGP = experiences.some((e) => {
    const t = (e.title || '').toLowerCase()
    return CGP_TITLE_KEYWORDS.some((k) => t.includes(k)) || t.includes('conseiller en gestion de patrimoine')
  })
  if (hasPastCGP) score += PAST_CGP_BONUS

  if (FORMATION_CGP.some((k) => formation.includes(k))) score += FORMATION_BONUS

  return Math.min(100, Math.max(0, Math.round(score)))
}
