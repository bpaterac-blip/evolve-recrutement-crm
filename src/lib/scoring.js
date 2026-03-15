/**
 * Scoring CGP Evolve : employeur captif, intitulé, ancienneté, expériences passées
 * Poids configurables via scoring_config (Supabase) - chargés au démarrage
 */

import { getScoringConfig } from './scoringConfig'

const BANQUES_CAPTIVES = [
  'bnp paribas', 'société générale', 'credit agricole',
  'crédit agricole', 'lcl', 'banque populaire',
  "caisse d'épargne", 'bred', 'cic', 'hsbc',
  'la banque postale', 'credit mutuel', 'crédit mutuel',
  'boursorama', 'hello bank', 'orange bank',
  'banque de savoie', 'banque palatine', 'tarneaud',
  'laydernier', 'nuger', 'kolb', 'rhône alpes',
  'sgpb', 'société générale private banking',
  'credit du nord', 'crédit du nord', 'groupe credit du nord',
  'louvre banque', 'louvre banque privee', 'louvre banque privée',
  'societe generale', 'sg privee', 'banque privee by ca', 'banque privée by ca',
  'ca31', 'credit agricole du nord', 'crédit agricole du nord',
  'credit agricole normandie', 'credit agricole bretagne',
  'credit agricole centre', 'credit agricole sud',
  'credit agricole toulouse', 'credit agricole occitanie',
  'credit agricole paca', 'credit agricole alpes',
  'credit agricole rhone', 'credit agricole loire',
  'credit agricole atlantique', 'credit agricole charente',
  'credit agricole berry', 'credit agricole brie',
  'credit agricole champagne', 'credit agricole alsace',
  'credit agricole lorraine', 'credit agricole franche',
  'banque privee', 'banque privée',
  'banque de gestion privee', 'banque de gestion privée',
  'bgpi', 'oddo bhf', 'rothschild', 'lazard',
  'neuflize', 'pictet', 'lombard odier', 'ubs',
  'jp morgan', 'goldman sachs', 'merrill lynch',
  'credit suisse', 'deutsche bank', 'barclays',
  'banque transatlantique', 'banque martin maurel',
  'banque richelieu', 'banque leonard de vinci',
  'banque sba', 'banque cic', 'banque tarneaud',
  'banque laydernier', 'banque nuger', 'banque kolb',
  'banque rhone alpes', 'banque populaire aura',
  'banque populaire occitanie', 'banque populaire aquitaine',
  'banque populaire bourgogne', 'banque populaire alsace',
  'banque populaire nord', 'banque populaire atlantic',
  'banque populaire val de france', 'banque populaire grand ouest',
  'banque populaire mediterranee', 'banque populaire rives',
  'caisse epargne', "caisse d'epargne", 'cepac',
  'caisse epargne paca', 'caisse epargne rhone alpes',
  'caisse epargne occitanie', 'caisse epargne bretagne',
  'caisse epargne normandie', 'caisse epargne hauts',
  'caisse epargne ile de france', 'caisse epargne bourgogne',
  'caisse epargne grand est', 'caisse epargne loire',
  'caisse epargne midi', 'caisse epargne languedoc',
  'caisse epargne aquitaine', 'caisse epargne poitou',
]

const ASSURANCES_CAPTIVES = [
  'axa', 'allianz', 'generali', 'groupama', 'maif',
  'macif', 'mma', 'ag2r', 'malakoff', 'predica',
  'cardif', 'gan', 'aviva', 'swisslife', 'swiss life',
  'apicil', 'humanis', 'mutex', 'maaf', 'pacifica',
  'franfinance', 'sogecap', 'antarius', 'oradea',
  'spirica', 'suravenir', 'generali vie',
]

/** Normalise une chaîne pour comparaison : minuscules, sans accents, espaces unifiés */
function normalize(str) {
  if (!str || typeof str !== 'string') return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[''`]/g, "'")
    .trim()
}

const TITRES_CGP_RAW = [
  'conseiller en gestion de patrimoine',
  'conseiller patrimonial',
  'consultant en gestion de patrimoine',
  'conseiller en strategie patrimoniale',
  'conseiller en stratégie patrimoniale',
  'conseiller gestion privee',
  'conseiller gestion privée',
  'conseiller en gestion privee',
  'conseiller en gestion privée',
  'conseiller senior gestion de patrimoine',
  'senior conseiller patrimonial',
  'conseiller patrimoine senior',
  'conseiller patrimoine financier',
  'conseiller en investissement',
  'conseiller en placements financiers',
  'conseiller en strategie financiere',
  'conseiller en stratégie financière',
  'banquier prive',
  'banquier privé',
  'private banker',
  'banque privee',
  'banque privée',
  'conseiller banque privee',
  'conseiller banque privée',
  'wealth manager',
  'wealth advisor',
  'senior wealth advisor',
  'senior wealth manager',
  'wealth consultant',
  'wealth planning advisor',
  'financial wealth advisor',
  'private wealth advisor',
  'head of wealth management',
  'head of private banking',
  'financial advisor',
  'financial planner',
  'investment advisor',
  'investment consultant',
  'financial consultant',
  'senior financial advisor',
  'investment manager',
  'portfolio advisor',
  'portfolio manager',
  'gestionnaire de portefeuille',
  'gestionnaire patrimonial',
  'gestionnaire de patrimoine',
  'gestionnaire clientele patrimoniale',
  'gestionnaire clientèle patrimoniale',
  'gestionnaire fortune',
  'private client advisor',
  'private client manager',
  'client advisor private banking',
  'relationship manager private banking',
  'investment relationship manager',
  'senior relationship manager',
  'conseiller clientele patrimoniale',
  'conseiller clientèle patrimoniale',
  'charge de clientele patrimoniale',
  'chargé de clientèle patrimoniale',
  'conseiller clientele privee',
  'conseiller clientèle privée',
  'conseillere clientele privee',
  'conseillère clientèle privée',
  'conseiller de clientele privee',
  'conseiller de clientèle privée',
  'conseillere relation clientele privee',
  'conseillère relation clientèle privée',
  'conseiller relation clientele privee',
  'conseiller relation clientèle privée',
  'conseiller prive',
  'conseiller privé',
  'conseillere privee',
  'conseillère privée',
  'responsable clientele privee',
  'responsable clientèle privée',
  'responsable gestion de patrimoine',
  'responsable banque privee',
  'responsable banque privée',
  'responsable developpement patrimonial',
  'responsable développement patrimonial',
  'responsable clientele patrimoniale',
  'responsable clientèle patrimoniale',
  'courtier en gestion de patrimoine',
  'courtier financier',
  'courtier en epargne',
  'courtier en épargne',
  'inspecteur patrimonial',
  'inspecteur en gestion de patrimoine',
  "charge d'affaires patrimonial",
  "chargé d'affaires patrimonial",
  'conseiller en investissements financiers',
  'cif',
  'family officer',
  'junior family officer',
  'conseiller family office',
  'conseiller en planification financiere',
  'conseiller en planification financière',
  'financial planning advisor',
  'cgp',
  'cgpi',
]

const TITRES_MOYENS_RAW = [
  'conseiller clientele premium',
  'conseiller clientèle premium',
  'charge de clientele premium',
  'chargé de clientèle premium',
  'conseiller clientele haut de gamme',
  'conseiller clientèle haut de gamme',
  'responsable clientele premium',
  'responsable clientèle premium',
  'conseiller clientele particuliers',
  'conseiller clientèle particuliers',
  'charge de clientele particuliers',
  'chargé de clientèle particuliers',
  'responsable clientele particuliers',
  'responsable clientèle particuliers',
  "charge d'affaires particuliers",
  "chargé d'affaires particuliers",
  'conseiller financier',
  'conseiller en epargne',
  'conseiller en épargne',
  'conseiller retraite',
  'courtier en assurance',
  'conseiller en protection sociale',
  'conseiller en prevoyance',
  'conseiller en prévoyance',
  'conseiller en assurance de personnes',
  'conseiller assurance vie',
  'agent general assurance',
  'agent général assurance',
  "agent d'assurance",
  'inspecteur commercial assurance',
  'conseiller banque de detail',
  'conseiller banque de détail',
  'charge d\'affaires professionnels',
  'chargé d\'affaires professionnels',
  'conseiller professionnels banque',
  'charge d\'affaires entreprises',
  'chargé d\'affaires entreprises',
  'conseiller clientele entreprises',
  'conseiller clientèle entreprises',
  'conseiller clientele professionnels',
  'conseiller clientèle professionnels',
  'relationship manager',
  'conseiller clientele',
  'conseiller clientèle',
  'charge de clientele',
  'chargé de clientèle',
  'directeur agence',
  'responsable secteur',
  'conseiller commercial',
]

const TITRES_CGP = TITRES_CGP_RAW.map(normalize)
const TITRES_MOYENS = TITRES_MOYENS_RAW.map(normalize)

const CGP_TITLE_KEYWORDS = ['prive', 'privee', 'patrimoine', 'wealth', 'cgp', 'banquier prive', 'private bank', 'family office', 'gestion de fortune']
const ADVISOR_TITLE_KEYWORDS = ['conseiller', 'gestionnaire', 'responsable', 'advisor', 'manager', 'banker', 'chargé', 'charge', 'directeur']
const BANK_COMPANY_KEYWORDS = ['banque', 'credit', 'caisse']
const INSURANCE_COMPANY_KEYWORDS = ['assurance', 'prevoyance', 'mutuelle']

function hasCGPTitleKeyword(titleNorm) {
  return CGP_TITLE_KEYWORDS.some((k) => titleNorm.includes(normalize(k)))
}
function hasAdvisorTitleKeyword(titleNorm) {
  return ADVISOR_TITLE_KEYWORDS.some((k) => titleNorm.includes(normalize(k)))
}
function hasBankCompanyKeyword(companyNorm) {
  return BANK_COMPANY_KEYWORDS.some((k) => companyNorm.includes(k))
}
function hasInsuranceCompanyKeyword(companyNorm) {
  return INSURANCE_COMPANY_KEYWORDS.some((k) => companyNorm.includes(k))
}

const MOTS_CABINET_INDEPENDANT = [
  'cabinet', 'indépendant', 'courtier', 'broker',
  'patrimoine conseil', 'conseil en patrimoine',
  'gestion privée indépendante', 'cgpi',
]

function parseTenureYears(dur) {
  if (!dur || typeof dur !== 'string') return 0
  const m = dur.match(/(\d+)\s*ans?/i)
  if (m) return parseInt(m[1], 10)
  const mo = dur.match(/(\d+)\s*mois/i)
  if (mo) return parseInt(mo[1], 10) / 12
  return 0
}

export function scoreProfile(profile, experiences = []) {
  let score = 0
  const signals = []

  const company = (profile.company || profile.co || profile.companyName || '').toLowerCase()
  const companyNorm = normalize(company)
  const titleNorm = normalize(profile.title || profile.ti || profile.jobTitle || '')

  console.log('Scoring profil:', {
    company: profile.company || profile.co || profile.companyName,
    title: profile.title || profile.ti || profile.jobTitle,
    linkedin: profile.li || profile.linkedinUrl,
  })
  const dur = profile.dur || profile.duration || ''
  const exps = Array.isArray(experiences) ? experiences : []

  const cfg = getScoringConfig()
  const wEmployer = cfg.weight_employer ?? 50
  const wTitle = cfg.weight_title ?? 30
  const wSeniority = cfg.weight_seniority ?? 20
  const bonusCGP = cfg.bonus_cgp_experience ?? 20
  const thPriority = cfg.threshold_priority ?? 70
  const thTowork = cfg.threshold_towork ?? 50

  // 1. EMPLOYEUR ACTUEL (listes explicites + fallback mots-clés)
  const isBanqueList = BANQUES_CAPTIVES.some((b) => companyNorm.includes(normalize(b)))
  const isAssuranceList = ASSURANCES_CAPTIVES.some((a) => companyNorm.includes(normalize(a)))
  const isBanque = isBanqueList || (!isAssuranceList && hasBankCompanyKeyword(companyNorm))
  const isAssurance = isAssuranceList || (!isBanqueList && hasInsuranceCompanyKeyword(companyNorm))

  if (isBanque) {
    score += wEmployer
    signals.push('Banque captive')
  } else if (isAssurance) {
    score += wEmployer
    signals.push('Assurance captive')
  } else if (MOTS_CABINET_INDEPENDANT.some((c) => companyNorm.includes(normalize(c)))) {
    score += Math.round(wEmployer * 0.2)
    signals.push('Cabinet indépendant')
  }

  // 2. INTITULÉ ACTUEL (détection par mots-clés)
  const hasCGPKeyword = hasCGPTitleKeyword(titleNorm) || TITRES_CGP.some((t) => titleNorm.includes(t))
  const hasAdvisorKeyword = hasAdvisorTitleKeyword(titleNorm) || TITRES_MOYENS.some((t) => titleNorm.includes(t))

  if (hasCGPKeyword) {
    score += wTitle
    signals.push('Titre CGP / Banquier privé')
  } else if (hasAdvisorKeyword) {
    score += Math.round(wTitle * 0.5)
    signals.push('Titre conseiller')
  }

  // 3. ANCIENNETÉ
  let years = 0
  if (exps.length > 0) {
    const currentExp = exps.find((e) => e.isCurrent)
    if (currentExp?.startYear) {
      years = new Date().getFullYear() - currentExp.startYear
      if (years >= 3 && years <= 7) {
        score += wSeniority
        signals.push(`Ancienneté idéale : ${years} ans`)
      } else if (years >= 8 && years <= 12) {
        score += Math.round(wSeniority * 0.75)
        signals.push(`Ancienneté bonne : ${years} ans`)
      } else if (years >= 1 && years < 3) {
        score += Math.round(wSeniority * 0.5)
        signals.push(`Ancienneté courte : ${years} ans`)
      } else {
        score += Math.round(wSeniority * 0.25)
        signals.push(`Ancienneté : ${years} ans`)
      }
    }
  } else if (dur) {
    years = parseTenureYears(dur)
    if (years >= 3 && years <= 10) score += wSeniority
    else if (years > 10) score += Math.round(wSeniority * 0.75)
    else if (years >= 1) score += Math.round(wSeniority * 0.5)
    else score += Math.round(wSeniority * 0.25)
  }

  // 4. BONUS EXPÉRIENCES PASSÉES
  if (exps.length > 1) {
    const pastExperiences = exps.filter((e) => !e.isCurrent)

    const hadCGP = pastExperiences.some((exp) => {
      const tNorm = normalize(exp.title || '')
      const cNorm = normalize(exp.company || '')
      return (
        hasCGPTitleKeyword(tNorm) ||
        TITRES_CGP.some((x) => tNorm.includes(x)) ||
        MOTS_CABINET_INDEPENDANT.some((x) => cNorm.includes(normalize(x)))
      )
    })
    if (hadCGP) {
      score += bonusCGP
      signals.push('⚡ Expérience passée en cabinet CGP')
    }

    const hadBanque = pastExperiences.some((exp) => {
      const cNorm = normalize(exp.company || '')
      return (
        BANQUES_CAPTIVES.some((b) => cNorm.includes(normalize(b))) ||
        ASSURANCES_CAPTIVES.some((a) => cNorm.includes(normalize(a))) ||
        hasBankCompanyKeyword(cNorm) ||
        hasInsuranceCompanyKeyword(cNorm)
      )
    })
    if (hadBanque && !isBanque && !isAssurance) {
      score += Math.round(bonusCGP * 0.5)
      signals.push('Parcours banque/assurance passé')
    }
  }

  let priority = 'À écarter'
  if (score >= thPriority) priority = 'Prioritaire'
  else if (score >= thTowork) priority = 'À travailler'

  return { score: Math.min(100, Math.max(0, Math.round(score))), priority, signals }
}

/** Compatibilité : retourne le score numérique pour addProfile, Import, etc. */
export function calculateScore(profile) {
  const exps = Array.isArray(profile?.experiences) ? profile.experiences : []
  return scoreProfile(profile || {}, exps).score
}

/** Badge pour la timeline : 'cabinet' | 'captif' | null */
export function getExperienceBadge(exp) {
  const cNorm = normalize(exp.company || '')
  const tNorm = normalize(exp.title || '')
  const isCabinet =
    hasCGPTitleKeyword(tNorm) ||
    TITRES_CGP.some((x) => tNorm.includes(x)) ||
    MOTS_CABINET_INDEPENDANT.some((x) => cNorm.includes(normalize(x)))
  const isCaptif =
    BANQUES_CAPTIVES.some((b) => cNorm.includes(normalize(b))) ||
    ASSURANCES_CAPTIVES.some((a) => cNorm.includes(normalize(a))) ||
    hasBankCompanyKeyword(cNorm) ||
    hasInsuranceCompanyKeyword(cNorm)
  if (isCabinet) return 'cabinet'
  if (isCaptif) return 'captif'
  return null
}
