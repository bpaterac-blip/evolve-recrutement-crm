export const STAGES = ['R0', 'R1', "Point d'étape", 'R2 Amaury', 'Point juridique', 'Démission reconversion', 'Recruté']
export const MATURITIES = ['Froid', 'Tiède', 'Chaud', 'Très chaud', 'Archivé']
export const INTEG_OPTS = ['—', 'Janvier 2026', 'Avril 2026', 'Juin 2026', 'Juillet 2026', 'Septembre 2026', 'Novembre 2026', 'Janvier 2027', 'Avril 2027', 'Juin 2027', 'Septembre 2027', 'Novembre 2027', 'Intégré']
export const INTEG_ADD_DATE = '+ Ajouter une date...'

export const SOURCES = ['Chasse LinkedIn', 'Chasse Mail', 'Recommandation', 'Inbound', 'Ads', 'Chasse externe', 'Direct contact', 'Lemlist']

export const REGIONS = [
  'Paris / Île-de-France',
  'Grand Est',
  'Hauts-de-France',
  'Bourgogne-Franche-Comté',
  'Provence-Alpes-Côte d\'Azur',
  'Occitanie',
  'Nouvelle-Aquitaine',
  'Auvergne-Rhône-Alpes',
  'Centre-Val de Loire',
  'Pays de la Loire',
  'Bretagne',
  'Normandie',
  'Corse',
]

export const NOTE_TEMPLATES = {
  'Récapitulatif R0': `Date : 
Échange : 
Intérêt exprimé : 
Prochaine étape : `,
  'Récapitulatif R1': `Date : 
Présentation Evolve : 
Questions posées : 
Objections : 
Suite donnée : `,
  'Récapitulatif Point d\'étape': `Date : 
Avancement : 
Blocages : 
Prochaine étape : `,
  'Note libre': '',
}

export const EVENT_TYPES = ['R0', 'R1', "Point d'étape", 'R2 Amaury', 'Démission reconversion', 'Point juridique', 'Intégration', 'Autre']

export { MATURITY_COLORS, STAGE_COLORS } from './colors'

export const INITIAL_PROFILES = [
  { id: 1, fn: 'Thomas', ln: 'Dupont', co: 'Crédit Agricole', ti: 'CGP', city: 'Toulouse', src: 'Chasse LinkedIn', sc: 85, stg: 'R1', mat: 'Chaud', integ: '—', dt: '10 mars', mail: 't.dupont@ca.fr', li: 'linkedin.com/in/tdupont', notes: '', acts: [{ d: '13 mars', t: 'Lemlist', n: 'Entré séquence S1 — Banques Assurances LinkedIn', ico: 'link', type: 'lem' }, { d: '10 mars', t: 'Email envoyé', n: 'Séquence S1 — mail 1', ico: 'envelope', type: 'std' }, { d: '10 mars', t: 'Stade → R1', n: 'Passage de R0 à R1', ico: 'arrow_up', type: 'stg' }] },
  { id: 2, fn: 'Marine', ln: 'Laurent', co: 'AXA Banque', ti: 'Conseillère patrimoniale', city: 'Bordeaux', src: 'Chasse LinkedIn', sc: 80, stg: 'R2 Amaury', mat: 'Très chaud', integ: 'Juin 2026', dt: '8 mars', mail: 'm.laurent@axa.fr', li: 'linkedin.com/in/mlaurent', notes: 'Très motivée.', acts: [{ d: '8 mars', t: 'Stade → R2 Amaury', n: 'RDV planifié le 18 mars 10h', ico: 'arrow_up', type: 'stg' }] },
  { id: 3, fn: 'Julien', ln: 'Morel', co: 'Société Générale', ti: 'Banquier privé', city: 'Lyon', src: 'Recommandation', sc: 90, stg: 'Point juridique', mat: 'Très chaud', integ: 'Mai 2026', dt: '7 mars', mail: 'j.morel@sg.fr', li: 'linkedin.com/in/jmorel', notes: '', acts: [{ d: '7 mars', t: 'Point juridique lancé', n: 'Revue contrat', ico: 'document', type: 'std' }] },
  { id: 4, fn: 'Sophie', ln: 'Bernard', co: 'BNP Paribas', ti: 'CGP', city: 'Marseille', src: 'Chasse Mail', sc: 75, stg: "Point d'étape", mat: 'Tiède', integ: '—', dt: '6 mars', mail: 's.bernard@bnp.fr', li: 'linkedin.com/in/sbernard', notes: '', acts: [{ d: '6 mars', t: 'Appel 20min', n: 'Hésite sur le variable', ico: 'mappin', type: 'std' }] },
  { id: 5, fn: 'Alexandre', ln: 'Petit', co: 'Generali', ti: 'Conseiller financier', city: 'Nice', src: 'Inbound', sc: 68, stg: 'R1', mat: 'Tiède', integ: '—', dt: '5 mars', mail: 'a.petit@generali.fr', li: 'linkedin.com/in/apetit', notes: '', acts: [{ d: '5 mars', t: 'Formulaire inbound', n: 'Site Evolve', ico: 'document', type: 'std' }] },
  { id: 6, fn: 'Camille', ln: 'Rousseau', co: "Caisse d'Épargne", ti: 'Gestionnaire patrimoine', city: 'Nantes', src: 'Chasse LinkedIn', sc: 82, stg: 'R0', mat: 'Froid', integ: '—', dt: '12 mars', mail: 'c.rousseau@ce.fr', li: 'linkedin.com/in/crousseau', notes: '', acts: [{ d: '13 mars', t: 'Lemlist', n: 'Entré séquence S1', ico: 'link', type: 'lem' }] },
  { id: 7, fn: 'Nicolas', ln: 'Fontaine', co: 'LCL', ti: 'Conseiller clientèle privé', city: 'Montpellier', src: 'Chasse LinkedIn', sc: 78, stg: 'R0', mat: 'Froid', integ: '—', dt: '12 mars', mail: 'n.fontaine@lcl.fr', li: 'linkedin.com/in/nfontaine', notes: '', acts: [{ d: '13 mars', t: 'Lemlist', n: 'Séquence S1 démarrée', ico: 'link', type: 'lem' }] },
  { id: 8, fn: 'Pierre', ln: 'Lefebvre', co: 'Crédit Mutuel', ti: 'CGP senior', city: 'Aix-en-Provence', src: 'Recommandation', sc: 92, stg: 'Démission', mat: 'Très chaud', integ: 'Mai 2026', dt: '3 mars', mail: 'p.lefebvre@cm.fr', li: 'linkedin.com/in/plefebvre', notes: '', acts: [{ d: '3 mars', t: 'Démission annoncée', n: 'Préavis 2 mois', ico: 'document', type: 'std' }] },
  { id: 9, fn: 'Isabelle', ln: 'Roux', co: 'Banque Populaire', ti: "Chargée d'affaires", city: 'Bordeaux', src: 'Chasse LinkedIn', sc: 71, stg: 'R1', mat: 'Chaud', integ: '—', dt: '4 mars', mail: 'i.roux@bp.fr', li: 'linkedin.com/in/iroux', notes: '', acts: [{ d: '4 mars', t: 'R1 planifié', n: 'RDV le 15 mars 14h', ico: 'calendar', type: 'event' }] },
  { id: 10, fn: 'Laurent', ln: 'Simon', co: 'Swiss Life', ti: 'Conseiller patrimonial', city: 'Toulouse', src: 'Chasse LinkedIn', sc: 76, stg: 'R0', mat: 'Froid', integ: '—', dt: '13 mars', mail: 'l.simon@sl.fr', li: 'linkedin.com/in/lsimon', notes: '', acts: [{ d: '13 mars', t: 'Ajouté au CRM', n: 'Import batch mars', ico: 'plus', type: 'std' }] },
  { id: 11, fn: 'Clara', ln: 'Martin', co: 'Société Générale', ti: 'Banquière privée', city: 'Lyon', src: 'Chasse Mail', sc: 84, stg: 'R0', mat: 'Tiède', integ: '—', dt: '11 mars', mail: 'c.martin@sg.fr', li: 'linkedin.com/in/cmartin', notes: '', acts: [{ d: '13 mars', t: 'Lemlist', n: 'Email S1 ouvert ×2', ico: 'link', type: 'lem' }] },
  { id: 12, fn: 'Mathieu', ln: 'Girard', co: 'Crédit Agricole', ti: 'CGP', city: 'Nîmes', src: 'Direct contact', sc: 88, stg: 'Recruté', mat: 'Très chaud', integ: 'Intégré', dt: '15 jan', mail: 'm.girard@ca.fr', li: 'linkedin.com/in/mgirard', notes: '', acts: [{ d: '15 jan', t: 'Recruté ✓', n: 'Contrat signé', ico: 'star', type: 'std' }] },
  { id: 13, fn: 'Aurélie', ln: 'Leroy', co: 'AXA', ti: 'Conseillère CGP', city: 'Toulon', src: 'Inbound', sc: 79, stg: 'Recruté', mat: 'Très chaud', integ: 'Intégré', dt: '1 fév', mail: 'a.leroy@axa.fr', li: 'linkedin.com/in/aleroy', notes: '', acts: [{ d: '1 fév', t: 'Recruté ✓', n: 'Intégrée — zone PACA', ico: 'star', type: 'std' }] },
  { id: 14, fn: 'Étienne', ln: 'Thomas', co: 'BNP Paribas', ti: 'CGP senior', city: 'Marseille', src: 'Recommandation', sc: 91, stg: 'Recruté', mat: 'Très chaud', integ: 'Intégré', dt: '28 fév', mail: 'e.thomas@bnp.fr', li: 'linkedin.com/in/ethomas', notes: '', acts: [{ d: '28 fév', t: 'Recruté ✓', n: 'Contrat signé', ico: 'star', type: 'std' }] },
]

export const SCORING_RESULTS = [
  { fn: 'Yasmine', ln: 'Boudali', co: 'Crédit Agricole', ti: 'CGP', dur: '5 ans', sc: 95, pr: 'Prioritaire' },
  { fn: 'Marc', ln: 'Thibault', co: 'BNP Paribas', ti: 'Banquier privé', dur: '4 ans', sc: 88, pr: 'Prioritaire' },
  { fn: 'Inès', ln: 'Caramel', co: 'Société Générale', ti: 'Gestionnaire patrimoine', dur: '6 ans', sc: 82, pr: 'Prioritaire' },
  { fn: 'Kevin', ln: 'Durand', co: 'AXA Banque', ti: 'Conseiller financier', dur: '3 ans', sc: 78, pr: 'Prioritaire' },
  { fn: 'Pauline', ln: 'Vidal', co: 'Generali', ti: 'CGP', dur: '5 ans', sc: 75, pr: 'Prioritaire' },
  { fn: 'Tom', ln: 'Gros', co: 'Primonial', ti: 'Conseiller', dur: '2 ans', sc: 45, pr: 'À travailler' },
  { fn: 'Anne', ln: 'Castillo', co: 'Cabinet Castillo', ti: 'CGP indépendant', dur: '8 ans', sc: 38, pr: 'À travailler' },
  { fn: 'Jean', ln: 'Morin', co: 'Hors secteur', ti: 'Commercial', dur: '1 an', sc: 15, pr: 'À écarter' },
]
