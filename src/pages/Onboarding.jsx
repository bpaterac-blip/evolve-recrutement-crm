import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ── Couleurs ──────────────────────────────────────────────────────────────────
const ACCENT = '#173731'
const GOLD   = '#D2AB76'
const BG     = '#F5F0E8'

// ── Liens Drive & externes ────────────────────────────────────────────────────
const L = {
  dossier:         { label: 'Dossier NOS COURTIERS', url: 'https://drive.google.com/drive/folders/1KRSJpvMFD9vkPnGU6k8qymnlvBGR_XMz' },
  statuts_sas:     { label: 'Statuts SAS', url: 'https://docs.google.com/document/d/1gA0FzqEB79lG4oI1uOJ4YzUnUwuS8Qmy/edit' },
  statuts_sarl:    { label: 'Statuts SARL', url: 'https://docs.google.com/document/d/1_jjDXaz4-X7mLx5LXJ4x7SWS4lWPVXwa8czM7Fd_d8c/edit' },
  pacte:           { label: 'Pacte d\'associés', url: 'https://docs.google.com/document/d/1z-FUO7iBc5dER5-5CYek78WQUuekaF5z/edit' },
  declaration:     { label: 'Déclaration actionnariale', url: 'https://docs.google.com/document/d/1jpHUEHrrPdppFwbGDJB1gBkfG3O_z_SE/edit' },
  rbe:             { label: 'Formulaire RBE', url: 'https://drive.google.com/file/d/1bXixeh7H20uDH1PqBYyL-uplktEvQIX5/view' },
  lettre_acces:    { label: 'Lettre d\'accès', url: 'https://drive.google.com/file/d/1IXsYc3GSxJf-zrJw5mWwMtBUPvpBDMVu/view' },
  cnpm:            { label: 'Formulaire CNPM', url: 'https://www.medconsodev.eu/demande-adhesion-pro.php' },
  cncef:           { label: 'Formulaire CNCEF', url: 'https://inscription.cncef.org/assurance' },
  orias:           { label: 'Formulaire ORIAS', url: 'https://www.orias.fr/public/enregistrement/index' },
  convention_sas:  { label: 'Convention SAS', url: 'https://docs.google.com/document/d/1tt9Gbu6-0YyxOGPkyAfQibwPlH3VnjWy/edit' },
  convention_sarl: { label: 'Convention SARL (YouSign)', url: 'https://yousign.app/auth/workspace/workflows' },
}

// ── Remplace les placeholders {{…}} par les données du profil ─────────────────
function fillMail(tpl, p) {
  if (!tpl) return null
  const year = new Date().getFullYear()
  const replace = (s) => s
    .replace(/\{\{prenom\}\}/g, p.fn)
    .replace(/\{\{nom\}\}/g, p.ln)
    .replace(/\{\{societe\}\}/g, `${p.fn} ${p.ln} Courtage`)
    .replace(/\{\{email\}\}/g, p.email || '')
    .replace(/\{\{telephone\}\}/g, p.phone || '(téléphone)')
    .replace(/\{\{siren\}\}/g, p.siren || '...........')
    .replace(/\{\{responsable\}\}/g, p.owner)
    .replace(/\{\{annee\}\}/g, String(year))
  return { to: replace(tpl.to), cc: tpl.cc || '', subject: replace(tpl.subject), body: replace(tpl.body) }
}

// Corps du mail en HTML : convertit \n → <br> et préserve le HTML si déjà présent
function bodyToHtml(body) {
  if (/<[a-z][\s\S]*>/i.test(body)) return body
  return body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
}

// Copier dans le presse-papier avec formatage HTML préservé
function copyAsHtml(htmlStr, plainStr) {
  try {
    const htmlBlob  = new Blob([htmlStr],  { type: 'text/html' })
    const plainBlob = new Blob([plainStr], { type: 'text/plain' })
    navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': plainBlob })])
  } catch (_) {
    navigator.clipboard.writeText(plainStr).catch(() => {})
  }
}

// ── Étapes d'onboarding ───────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  {
    id: 1,
    short: 'Création société',
    name: 'Lancement démarche de création',
    optional: false,
    yousign: false,
    waitAttestation: true,
    mailTemplate: {
      to: 'florian.nardoux@l-expert-comptable.com',
      cc: '',
      subject: 'CRÉATION SOCIÉTÉ / {{societe}}',
      body: `<p>Hello Florian,</p><p>Comment tu vas ?</p><p>Peux-tu, s'il te plaît, prendre contact avec {{prenom}} {{nom}} pour fixer un RDV en visioconférence avec l'expert-comptable et lancer les démarches de création ?</p><p>Tu trouveras ses coordonnées ci-dessous :</p><ul><li>Numéro : {{telephone}}</li><li>Mail : {{email}}</li></ul><p>Enfin, je t’envoie en pièce jointe les statuts constitutifs avec les informations mises à jour.</p><p>Nous souhaitons une date d’immatriculation au 01 du M+1.</p><p>Je reste à ta disposition si besoin.</p><p>Bien à toi,</p><p><strong>METTRE EN PJ LES STATUTS MODIFIÉS </strong></p><p>{{responsable}}</p>`,
    },
    tasks: [
      { id: 't1_1', label: 'Créer dossier {{prenom}} {{nom}} COURTAGE dans JURIDIQUE → NOS COURTIERS', links: ['dossier'] },
      { id: 't1_2', label: 'Copier + modifier les statuts (SAS ou SARL) avec les infos du gérant → exporter en PDF', links: ['statuts_sas', 'statuts_sarl'] },
      { id: 't1_3', label: 'Envoyer le mail à Florian NARDOUX (statuts en PJ, responsable réseau en CC)', links: [] },
      { id: 't1_4', label: 'Suivi : dépôt de capital + signature des statuts', links: [] },
      { id: 't1_5', label: 'Attendre immatriculation avant de passer à l\'étape suivante', links: [] },
    ],
  },
  {
    id: 2,
    short: 'Pacte d\'associés',
    name: 'Validation immatriculation + Pacte d\'associés',
    optional: false,
    yousign: true,
    waitAttestation: false,
    mailTemplate: {
      to: '{{email}}',
      cc: '',
      subject: '{{societe}} / VALIDATION IMMATRICULATION SOCIETE',
      body: `<p>Bonjour {{prenom}},</p><p>J’espère que tu vas bien.</p><p><strong>Félicitations pour l’immatriculation de ta société {{societe}} !</strong></p><p>La première étape réalisée, nous allons donc pouvoir avancer dans le processus de création.</p><p><strong>Tu vas recevoir dans la journée/soirée le pacte d’associés par mail qui sera à signer électroniquement.</strong></p><p>De notre côté, Amaury va également recevoir ce document pour signature.</p><p>Je reviens vers toi après la signature du pacte pour les prochaines étapes.</p><p>Bonne journée !</p><p>{{responsable}}</p>`,
    },
    tasks: [
      { id: 't2_1', label: 'Recevoir mail de validation de l\'immatriculation', links: [] },
      { id: 't2_2', label: 'Envoyer mail de confirmation au gérant', links: [] },
      { id: 't2_3', label: 'Mettre à jour le dossier Drive (CNI, KBIS, Pacte, Statuts, Convention)', links: ['dossier'] },
      { id: 't2_4', label: 'Copier + modifier les cases jaunes du Pacte d\'associés', links: ['pacte'] },
      { id: 't2_5', label: 'Envoyer via YouSign à Amaury + gérant (paraphes + "lu et approuvé")', links: [] },
    ],
  },
  {
    id: 3,
    short: 'Compte Pro',
    name: 'Préparation compte Pro gérant',
    optional: true,
    yousign: true,
    waitAttestation: false,
    mailTemplate: {
      to: '{{email}}',
      cc: '',
      subject: '{{societe}} / PREPARATION DOCUMENTS COMPTE PRO',
      body: `<p>Bonjour {{prenom}},</p><p>J’espère que tu vas bien.</p><p>Nous avons bien reçu le pacte d’associés signé par Amaury et toi-même, je te remercie.</p><p>Pour anticiper les demandes prochaines de Tiime (Outil de L’Expert-comptable)  concernant l’ouverture du compte professionnel, voici un récapitulatif des documents à préparer :</p><ul><li><strong>Déclaration actionnariale</strong></li><li><strong>Extrait Kbis Evolve Courtage de moins de 3 mois</strong></li><li><strong>Registre des bénéficiaires effectifs</strong></li></ul><p>Tu viens de recevoir un mail de YouSign pour signer la <strong>déclaration actionnariale, ainsi que les demandes pour obtenir le Registre des Bénéficiaires Effectifs.</strong></p><p>Tu trouveras en pièce jointe l'extrait <strong>Kbis d'Evolve Courtage.</strong></p><p>Concernant le <strong>Registre des bénéficiaires effectifs</strong> il te faudra ensuite, en tant que gérant de la société, <strong>envoyer le dossier de demande signé et ta CNI par mail à l’adresse suivante </strong>: <a href="mailto:certificatbe@infogreffe-siege.fr">certificatbe@infogreffe-siege.fr</a>, en indiquant :</p><ul><li>en objet du mail : <strong>{{societe}} - SIREN {{siren}}</strong>.</li><li>en corps du mail :</li></ul><p><em>“Bonjour, </em></p><p><em>Ayant besoin de mon Registre des Bénéficiaires Effectifs afin de pouvoir réaliser l’ouverture de mon compte professionnel, vous pouvez retrouver en PJ le dossier de demande d’accès signé.</em></p><p><em>De plus, en tant que gérant de la société pour laquelle je vous fait parvenir cette demande, vous pouvez également retrouver ma pièce d’identité en PJ.</em></p><p><em>Je vous remercie par avance.</em></p><p><em>Bonne journée”</em></p><p><strong>Lorsque tu auras reçu le document d’Infogreffe, pourrais-tu me le transmettre, s'il te plaît ?</strong></p><p>Une fois en possession de tous les documents, tu n’auras plus qu’à attendre le mail de Tiime te demandant ces pièces pour leur transmettre en retour.</p><p>Je te souhaite une bonne journée.</p><p>Bien à toi,</p><p>{{responsable}}</p>`,
    },
    tasks: [
      { id: 't3_1', label: 'Copier + remplir la Déclaration actionnariale dans le dossier Drive', links: ['declaration'] },
      { id: 't3_2', label: 'Télécharger + remplir formulaire RBE + lettre de demande d\'accès', links: ['rbe', 'lettre_acces'] },
      { id: 't3_3', label: 'Envoyer RBE + lettre de demande via YouSign au courtier', links: [] },
      { id: 't3_4', label: 'Envoyer déclaration actionnariale via YouSign (demande séparée)', links: [] },
      { id: 't3_5', label: 'Envoyer mail récapitulatif au gérant', links: [] },
    ],
  },
  {
    id: 4,
    short: 'RCP IAS',
    name: 'Inscription RCP IAS',
    optional: false,
    yousign: true,
    waitAttestation: true,
    mailTemplate: {
      to: '{{email}}',
      cc: '',
      subject: '{{societe}} / RESPONSABILITÉ CIVILE PROFESSIONNELLE',
      body: `<p>Bonjour {{prenom}},</p><p>J’espère que tu vas bien.</p><p>Tu viens de recevoir les demandes d'adhésions RC Pro à signer et parapher électroniquement.</p><p>Tu peux retrouver en PJ un dossier compressé avec les documents obligatoires à transmettre.</p><p><strong>Peux-tu rajouter à ce dossier s'il te plaît :</strong></p><p><strong>- La demande d'adhésion signée et paraphée</strong></p><p><strong>- Ton RIB</strong></p><p><strong>Après avoir intégré ces documents aux autres dans le dossier merci de le compresser et de l'envoyer par mail à :</strong></p><p>Yann ARNOUD : yarnoud@verspieren.com</p><p><strong>En mettant en copie :</strong></p><p>ntouadi@verspieren.com</p><p><a href="mailto:rjarlot@verspieren.com">rjarlot@verspieren.com</a></p><p>En indiquant :</p><p>Objet : ADHÉSION {{societe}} - SIREN {{siren}}</p><p><em>&quot;Bonjour,</em></p><p><em>Vous pouvez retrouver mon dossier d'adhésion complet sous format compressé en pièce jointe.</em></p><p><em>Je reste à votre disposition pour tout complément d'information</em></p><p><em>Bonne journée à vous&quot;</em></p><p><strong>Merci de me transmettre l'attestation lorsque tu auras reçu celle-ci</strong></p><p>Bonne journée !</p><p>{{responsable}}</p>`,
    },
    tasks: [
      { id: 't4_1', label: 'Remplir le document d\'adhésion RCP IAS', links: [] },
      { id: 't4_2', label: 'Préparer dossier compressé : CNI Amaury, CNI Gérant, CV Gérant, CV Amaury, KBIS Evolve Courtage, KBIS société, Statuts signés', links: ['dossier'] },
      { id: 't4_3', label: 'Envoyer document d\'adhésion via YouSign au CGP (se mettre en copie destinataire)', links: [] },
      { id: 't4_4', label: 'Envoyer mail au CGP → il transfère à Yann ARNOUD (yarnoud@verspieren.com)', links: [] },
      { id: 't4_5', label: 'Attendre attestation RCP IAS → l\'intégrer au dossier Drive', links: ['dossier'] },
    ],
  },
  {
    id: 5,
    short: 'CNPM',
    name: 'Adhésion CNPM (Médiateur)',
    optional: false,
    yousign: false,
    waitAttestation: true,
    mailTemplate: {
      to: '{{email}}',
      cc: '',
      subject: '{{societe}} / MEDIATEUR',
      body: `<p>Bonjour {{prenom}},</p><p>Nous venons de demander ton adhésion au médiateur MEDCONSO.</p><p><em>En effet, depuis le 1er janvier 2016, et conformément aux articles L.611-1 et suivants et R.612 et suivants du Code de la Consommation, les professionnels ont l’obligation de proposer à tout consommateur le recours à la médiation de la consommation afin de résoudre leurs différends dans le cadre de l'exécution d'un contrat de vente ou d'une prestation de service.</em></p><ul><li>Tu vas recevoir un mail de MEDCONSO, il te faudra ensuite aller sur :<a href="https://www.cnpm-mediation-consommation.eu/"> </a>https://www.medconsodev.eu/</li><li>Puis, cliquer en haut à droite sur ACCÈS PROFESSIONNEL </li><li><strong>Après t’être connecté, tu pourras visualiser le projet de convention et régler la cotisation d’adhésion.</strong></li></ul><p>Voici tes identifiants pour te connecter :</p><ul><li>ID : {{email}}</li><li>MDP : #{{prenom}}{{annee}}</li></ul><p><strong>Ensuite, il te faudra télécharger l’attestation de convention sur ton espace et me la transmettre par mail.</strong></p><p>Je reste à ta disposition si besoin,</p><p>Bonne journée !</p><p>{{responsable}}</p>`,
    },
    tasks: [
      { id: 't5_1', label: 'Remplir le formulaire CNPM (affiliation : ADHÉRENT CNCEF — PAIEMENT ANNUEL)', links: ['cnpm'] },
      { id: 't5_2', label: 'Créer identifiant avec mail du gérant + mot de passe #NomAnnée (ex: #Garcia2025)', links: [] },
      { id: 't5_3', label: 'Envoyer mail au gérant avec ses identifiants CNPM', links: [] },
      { id: 't5_4', label: 'Attendre attestation CNPM → l\'intégrer au dossier Drive', links: ['dossier'] },
    ],
  },
  {
    id: 6,
    short: 'CNCEF + ORIAS',
    name: 'Adhésion CNCEF + Immatriculation ORIAS',
    optional: false,
    yousign: false,
    waitAttestation: true,
    mailTemplate: null,
    mailTemplates: [
      {
        label: 'CNCEF',
        to: '{{email}}',
        cc: '',
        subject: '{{societe}} / CNCEF - ASSOCIATION PROFESSIONNELLE',
        body: `<p>Bonjour {{prenom}},</p><p>J’espère que tu vas bien.</p><p>Nous venons de finaliser la demande d’adhésion à la CNCEF (association professionnelle).</p><p><em>En effet, depuis le 1er avril 2022, l’adhésion à une association professionnelle est obligatoire pour tous les professionnels souhaitant s’immatriculer à l’ORIAS en tant que courtiers ou mandataires de courtiers.</em></p><p>Tu devrais donc recevoir prochainement un email de leur part. Si tu as besoin d’informations complémentaires, n’hésite pas à me transférer leurs messages. Une fois que tu auras reçu l’attestation, je te serais reconnaissant de me la transmettre.</p><p>Merci à toi et bonne journée !</p><p>{{responsable}}</p>`,
      },
      {
        label: 'ORIAS',
        to: '{{email}}',
        cc: '',
        subject: '{{societe}} / IMMATRICULATION ORIAS',
        body: `<p>Bonjour {{prenom}},</p><p>Comment tu vas ?</p><p>Suite à la validation de ton adhésion à la CNCEF, il faut désormais que tu puisses <strong>t’immatriculer à l’ORIAS.</strong></p><p>Pour ce faire, je te laisse finaliser ton dossier suite au mail que tu as reçu de la part de l’ORIAS.</p><p>Voici quelques indications pour la bonne finalisation :</p><ul><li>“Je déclare que l’on ne me confie pas de fonds”</li><li>“Je déclare ne pas avoir de liens étroits avec des entités de l’ORIAS”</li><li>“Activité exercée à titre principal”</li><li>Déposer ton KBIS</li><li>Déposer ton attestation de responsabilité civile professionnelle (VERSPIERREN)</li><li>Déposer ton attestation de capacité professionnelle (Attestation employeur d’expérience OU Diplôme si Master 2 OU Certification 150h IAS 1) -&gt; n’hésite pas à me contacter si besoin</li><li>Déposer ton attestation CNCEF</li></ul><p>Je reste à ta disposition si besoin d’éléments complémentaires</p><p>Bonne journée à toi !</p><p>{{responsable}}</p>`,
      },
    ],
    tasks: [
      { id: 't6_1', label: 'Remplir formulaire CNCEF', links: ['cncef'] },
      { id: 't6_2', label: 'Envoyer mail CNCEF', links: [] },
      { id: 't6_3', label: 'Remplir formulaire ORIAS', links: ['orias'] },
      { id: 't6_4', label: 'Envoyer mail ORIAS', links: [] },
      { id: 't6_5', label: 'Attendre attestation CNCEF → l\'intégrer au dossier Drive', links: ['dossier'] },
      { id: 't6_6', label: 'Attendre attestation ORIAS → l\'intégrer au dossier Drive', links: ['dossier'] },
    ],
  },
  {
    id: 7,
    short: 'Convention',
    name: 'Signature convention de partenariat',
    optional: false,
    yousign: true,
    waitAttestation: false,
    mailTemplate: {
      to: '{{email}}',
      cc: '',
      subject: '{{societe}} / CONVENTION DE PARTENARIAT',
      body: `<p>Hello {{prenom}},</p><p>Suite à la validation de ton immatriculation à l’ORIAS, tu viens de recevoir une demande de signature électronique concernant la convention de partenariat entre EVOLVE et ta société.</p><p>À la suite de cette signature, nous pourrons entamer les démarches d’ouvertures de tes codes d’accès chez les assureurs.</p><p>Bonne journée à toi !</p><p>{{responsable}}</p>`,
    },
    tasks: [
      { id: 't7_1', label: 'Modifier la convention de partenariat (attention : modèle SAS, pas SARL)', links: ['convention_sas', 'convention_sarl'] },
      { id: 't7_2', label: 'Envoyer via YouSign (formulaire → 3 petits points → remplir le formulaire)', links: [] },
      { id: 't7_3', label: 'Envoyer mail de confirmation au gérant', links: [] },
    ],
  },
  {
    id: 8,
    short: 'Codes assureurs',
    name: 'Ouverture des codes assureurs',
    optional: false,
    yousign: true,
    waitAttestation: false,
    mailTemplate: null,
    tasks: [
      { id: 't8_1', label: 'Créer l\'adresse mail professionnelle du CGP', links: [] },
      { id: 't8_2', label: 'Abeille : remplir les deux documents + envoyer via YouSign', links: [] },
      { id: 't8_3', label: 'MMA : démarches d\'ouverture de codes', links: [] },
      { id: 't8_4', label: 'SwissLife : démarches d\'ouverture de codes', links: [] },
    ],
  },
]

// ── Données de démo ────────────────────────────────────────────────────────────
const MOCK_PROFILES = [
  { id: 1, fn: 'Florent',  ln: 'Comte',   co: 'Crédit Agricole',   email: 'florent.comte@ca-centrest.fr',      phone: '06 12 34 56 78', siren: '123 456 789', owner: 'Baptiste',  step: 1, start: '2026-04-15', session: 'Mai 2026',     done: {} },
  { id: 2, fn: 'Marie',    ln: 'Dupont',   co: 'BNP Paribas',       email: 'marie.dupont@bnpparibas.com',       phone: '06 23 45 67 89', siren: '234 567 890', owner: 'Aurélien',  step: 2, start: '2026-04-08', session: 'Juin 2026',    done: { t2_1: true, t2_2: true } },
  { id: 3, fn: 'Thomas',   ln: 'Martin',   co: 'Société Générale',  email: 'thomas.martin@sg.com',              phone: '06 34 56 78 90', siren: '345 678 901', owner: 'Baptiste',  step: 4, start: '2026-03-25', session: 'Juillet 2026', done: { t4_1: true, t4_2: true } },
  { id: 4, fn: 'Sophie',   ln: 'Bernard',  co: 'La Banque Postale', email: 'sophie.bernard@labanquepostale.fr', phone: '06 45 67 89 01', siren: '456 789 012', owner: 'Aurélien',  step: 6, start: '2026-03-10', session: 'Mai 2026',     done: { t6_1: true, t6_2: true, t6_3: true } },
  { id: 5, fn: 'Lucas',    ln: 'Petit',    co: 'Crédit Mutuel',     email: 'lucas.petit@creditmutuel.fr',       phone: '06 56 78 90 12', siren: '567 890 123', owner: 'Baptiste',  step: 8, start: '2026-02-20', session: 'Mai 2026',     done: { t8_1: true } },
]

// ── Helpers ────────────────────────────────────────────────────────────────────
function daysSince(d) { return Math.round((new Date() - new Date(d)) / 864e5) }
function getInitials(fn, ln) { return `${fn?.[0] || ''}${ln?.[0] || ''}`.toUpperCase() }

const OWNER_STYLE = {
  Baptiste:   { bg: '#EEF2FF', color: '#4338CA' },
  'Aurélien': { bg: '#F0FDF4', color: '#16a34a' },
}

// ── Helpers DB ────────────────────────────────────────────────────────────────
function rowToProfile(row) {
  return {
    id:      row.profile_id,
    fn:      row.fn,
    ln:      row.ln,
    co:      row.co || '',
    email:   row.email || '',
    phone:   row.phone || '',
    siren:   row.siren || '',
    owner:   row.owner || '',
    step:    row.current_step,
    start:   row.start_date,
    session: row.session || '',
    done:    row.done || {},
    step_notes: row.step_notes || {},
    task_notes: row.task_notes || {},
  }
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function Onboarding() {
  const location = useLocation()
  const [showOptional, setShowOptional]   = useState(false)
  const [selectedId,   setSelectedId]     = useState(null)
  const [profiles,     setProfiles]       = useState([])
  const [completed,    setCompleted]      = useState([])
  const [loading,      setLoading]        = useState(true)
  const [newProfileBanner, setNewProfileBanner] = useState(null)
  const noteTimers = useRef({})  // debounce timers pour les notes

  // ── Init : chargement + injection éventuelle depuis Pipeline ────────────
  useEffect(() => {
    const incoming = location.state?.onboardingProfile
    if (incoming) window.history.replaceState({}, document.title)

    async function init() {
      setLoading(true)
      const today = new Date().toISOString().split('T')[0]

      // 1. Si un profil arrive depuis la Pipeline → upsert d'abord
      if (incoming) {
        const row = {
          profile_id:   incoming.id,
          fn:           incoming.fn,
          ln:           incoming.ln,
          co:           incoming.co || '',
          email:        incoming.email || '',
          phone:        incoming.phone || '',
          siren:        incoming.siren || '',
          owner:        incoming.owner || 'Baptiste',
          current_step: 1,
          start_date:   today,
          session:      '',
          done:         {},
          step_notes:   {},
          task_notes:   {},
        }
        const { error: upsertErr } = await supabase
          .from('onboarding_profiles')
          .upsert(row, { onConflict: 'profile_id', ignoreDuplicates: true })
        if (upsertErr) console.error('Onboarding upsert error:', upsertErr)
      }

      // 2. Charger tous les profils (incluant celui qu'on vient d'upsert)
      const { data, error } = await supabase
        .from('onboarding_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Onboarding load error:', error)
        // Fallback : si la table n'existe pas encore, afficher le profil entrant localement
        if (incoming) {
          const fallback = {
            id: incoming.id, fn: incoming.fn, ln: incoming.ln, co: incoming.co || '',
            email: incoming.email || '', phone: incoming.phone || '', siren: '',
            owner: incoming.owner || 'Baptiste', step: 1, start: today,
            session: '', done: {}, step_notes: {}, task_notes: {},
          }
          setProfiles([fallback])
          setNewProfileBanner(fallback)
          setSelectedId(incoming.id)
        }
        setLoading(false)
        return
      }

      const active = (data || []).filter((r) => !r.is_completed).map(rowToProfile)
      const done   = (data || []).filter((r) =>  r.is_completed).map(rowToProfile)
      setProfiles(active)
      setCompleted(done)

      if (incoming) {
        const added = active.find((p) => p.id === incoming.id)
        if (added) { setNewProfileBanner(added); setSelectedId(added.id) }
      }

      setLoading(false)
    }

    init()
  }, [])  // eslint-disable-line

  const visibleSteps = ONBOARDING_STEPS.filter((s) => showOptional || !s.optional)

  // ── toggleTask ─────────────────────────────────────────────────────────────
  const toggleTask = useCallback((profileId, taskId) => {
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === profileId)
      if (!p) return prev
      const newDone = { ...p.done, [taskId]: !p.done[taskId] }
      // Persist
      supabase.from('onboarding_profiles')
        .update({ done: newDone })
        .eq('profile_id', profileId)
        .then(({ error }) => { if (error) console.error('toggleTask error:', error) })
      return prev.map((x) => x.id === profileId ? { ...x, done: newDone } : x)
    })
  }, [])

  // ── notes avec debounce 800ms ──────────────────────────────────────────────
  const setTaskNote = useCallback((profileId, taskId, value) => {
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === profileId)
      if (!p) return prev
      const newNotes = { ...p.task_notes, [taskId]: value }
      const key = `${profileId}-task-${taskId}`
      clearTimeout(noteTimers.current[key])
      noteTimers.current[key] = setTimeout(() => {
        supabase.from('onboarding_profiles')
          .update({ task_notes: newNotes })
          .eq('profile_id', profileId)
          .then(({ error }) => { if (error) console.error('taskNote error:', error) })
      }, 800)
      return prev.map((x) => x.id === profileId ? { ...x, task_notes: newNotes } : x)
    })
  }, [])

  const setStepNote = useCallback((profileId, stepId, value) => {
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === profileId)
      if (!p) return prev
      const newNotes = { ...p.step_notes, [`s${stepId}`]: value }
      const key = `${profileId}-step-${stepId}`
      clearTimeout(noteTimers.current[key])
      noteTimers.current[key] = setTimeout(() => {
        supabase.from('onboarding_profiles')
          .update({ step_notes: newNotes })
          .eq('profile_id', profileId)
          .then(({ error }) => { if (error) console.error('stepNote error:', error) })
      }, 800)
      return prev.map((x) => x.id === profileId ? { ...x, step_notes: newNotes } : x)
    })
  }, [])

  // ── avancer d'étape ────────────────────────────────────────────────────────
  const advanceStep = useCallback((profileId) => {
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === profileId)
      if (!p) return prev
      let next = p.step + 1
      if (!showOptional && next === 3) next = 4
      if (next > 8) {
        // Marquer comme complété en DB
        supabase.from('onboarding_profiles')
          .update({ is_completed: true, completed_at: new Date().toISOString(), current_step: 9 })
          .eq('profile_id', profileId)
          .then(({ error }) => { if (error) console.error('complete error:', error) })
        setCompleted((c) => [...c, { ...p, step: 9 }])
        return prev.filter((x) => x.id !== profileId)
      }
      // Avancer l'étape + reset done
      supabase.from('onboarding_profiles')
        .update({ current_step: next, done: {} })
        .eq('profile_id', profileId)
        .then(({ error }) => { if (error) console.error('advanceStep error:', error) })
      return prev.map((x) => x.id === profileId ? { ...x, step: next, done: {} } : x)
    })
    setSelectedId(null)
  }, [showOptional])

  const selectedProfile = profiles.find((p) => p.id === selectedId)

  // Adapter les clés de notes pour le SidePanel (qui attend stepNotes/taskNotes comme maps globales)
  const stepNotes = Object.fromEntries(
    profiles.flatMap((p) =>
      Object.entries(p.step_notes || {}).map(([k, v]) => [`${p.id}-${k}`, v])
    )
  )
  const taskNotes = Object.fromEntries(
    profiles.flatMap((p) =>
      Object.entries(p.task_notes || {}).map(([k, v]) => [`${p.id}-${k}`, v])
    )
  )

  if (loading) return (
    <div style={{ display: 'flex', height: '100%', background: BG, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: '#aaa' }}>Chargement…</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100%', background: BG, overflow: 'hidden' }}>

      {/* ── Zone Kanban ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Palatino, serif', fontSize: 20, fontWeight: 600, color: ACCENT }}>
                Onboarding CGP
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                {profiles.length} CGP{profiles.length > 1 ? 's' : ''} en cours
                {completed.length > 0 && ` · ${completed.length} complété${completed.length > 1 ? 's' : ''}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${showOptional ? ACCENT : '#E5E0D8'}`,
                background: showOptional ? ACCENT : 'white', color: showOptional ? 'white' : '#666',
              }}
            >
              {showOptional ? '✓ Étape Compte Pro visible' : '+ Afficher étape Compte Pro'}
            </button>
          </div>
        </div>

        {/* Kanban board */}
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '0 24px 24px' }}>
          <div style={{ display: 'flex', gap: 10, height: '100%', minWidth: 'max-content', paddingTop: 4, alignItems: 'flex-start' }}>
            {visibleSteps.map((step, idx) => {
              const colProfiles = profiles.filter((p) => {
                if (!showOptional && p.step === 3) return false
                return p.step === step.id
              })
              return (
                <KanbanColumn key={step.id} step={step} idx={idx} profiles={colProfiles}
                  selectedId={selectedId} onSelect={setSelectedId} />
              )
            })}

            {/* Colonne Complétés */}
            <div style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
              <div style={{ background: 'white', borderRadius: '10px 10px 0 0', border: '1px solid #BBF7D0', borderTop: '3px solid #16a34a', padding: '10px 12px', marginBottom: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#DCFCE7', color: '#16a34a', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>Complétés</span>
                </div>
                <div style={{ fontSize: 10, color: '#aaa', paddingLeft: 26 }}>{completed.length} profil{completed.length > 1 ? 's' : ''}</div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', background: '#F0FDF4', border: '1px solid #BBF7D0', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 8, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120 }}>
                {completed.map((p) => (
                  <div key={p.id} style={{ background: 'white', borderRadius: 8, border: '1px solid #BBF7D0', padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>✓ {p.fn} {p.ln}</div>
                    <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{p.co}</div>
                    <div style={{ fontSize: 10, color: '#16a34a', marginTop: 4 }}>📅 {p.session}</div>
                  </div>
                ))}
                {completed.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 11, color: '#bbb' }}>Aucun pour l'instant</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Banner nouveau profil ajouté ── */}
      {newProfileBanner && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: ACCENT, color: 'white', borderRadius: 10, padding: '12px 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 12, minWidth: 320 }}>
          <span style={{ fontSize: 18 }}>🎉</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{newProfileBanner.fn} {newProfileBanner.ln} ajouté à l'onboarding</div>
            <div style={{ fontSize: 11, color: GOLD, marginTop: 2 }}>Étape 1 — Création société</div>
          </div>
          <button type="button" onClick={() => setNewProfileBanner(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 16, cursor: 'pointer', padding: 2 }}>✕</button>
        </div>
      )}

      {/* ── Panneau latéral ── */}
      {selectedProfile && (
        <SidePanel
          profile={selectedProfile}
          steps={visibleSteps}
          stepNotes={stepNotes}
          taskNotes={taskNotes}
          onClose={() => setSelectedId(null)}
          onToggleTask={toggleTask}
          onAdvance={advanceStep}
          onTaskNote={setTaskNote}
          onStepNote={setStepNote}
        />
      )}
    </div>
  )
}

// ── Colonne Kanban ─────────────────────────────────────────────────────────────
function KanbanColumn({ step, idx, profiles, selectedId, onSelect }) {
  return (
    <div style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
      <div style={{ background: 'white', border: `1px solid #E5E0D8`, borderTop: `3px solid ${step.optional ? '#C4B5FD' : ACCENT}`, borderRadius: '10px 10px 0 0', padding: '10px 12px', marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: step.optional ? '#EDE9FE' : ACCENT, color: step.optional ? '#7C3AED' : GOLD, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {idx + 1}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, lineHeight: 1.3 }}>{step.short}</span>
          {step.optional && <span style={{ fontSize: 9, background: '#EDE9FE', color: '#7C3AED', padding: '1px 5px', borderRadius: 8, fontWeight: 600 }}>Opt.</span>}
        </div>
        <div style={{ fontSize: 10, color: '#aaa', paddingLeft: 26 }}>{profiles.length} profil{profiles.length > 1 ? 's' : ''}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: '#EDE9E0', border: '1px solid #E5E0D8', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 8, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120 }}>
        {profiles.map((profile) => (
          <ProfileCard key={profile.id} profile={profile} step={step} isSelected={selectedId === profile.id} onSelect={onSelect} />
        ))}
        {profiles.length === 0 && <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 11, color: '#bbb' }}>Aucun CGP</div>}
      </div>
    </div>
  )
}

// ── Carte profil ───────────────────────────────────────────────────────────────
function ProfileCard({ profile, step, isSelected, onSelect }) {
  const days = daysSince(profile.start)
  const ownerStyle = OWNER_STYLE[profile.owner] || { bg: '#F3F4F6', color: '#666' }
  const totalTasks = step.tasks.length
  const doneTasks  = step.tasks.filter((t) => profile.done[t.id]).length
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  return (
    <div onClick={() => onSelect(isSelected ? null : profile.id)} style={{ background: 'white', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', border: `1px solid ${isSelected ? ACCENT : '#E5E0D8'}`, boxShadow: isSelected ? `0 0 0 2px ${ACCENT}18` : '0 1px 3px rgba(0,0,0,0.05)', transition: 'all 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: ACCENT, color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          {getInitials(profile.fn, profile.ln)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.fn} {profile.ln}</div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.co}</div>
        </div>
      </div>
      <div style={{ background: BG, borderRadius: 6, padding: '4px 8px', fontSize: 10, color: ACCENT, fontWeight: 600, marginBottom: 8 }}>📅 {profile.session}</div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: '#aaa' }}>Tâches</span>
          <span style={{ fontSize: 9, color: '#555', fontWeight: 600 }}>{doneTasks}/{totalTasks}</span>
        </div>
        <div style={{ height: 3, background: '#F0EDE8', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 2, transition: 'width 0.3s', width: `${pct}%`, background: pct === 100 ? '#16a34a' : ACCENT }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: ownerStyle.bg, color: ownerStyle.color }}>{profile.owner}</span>
        <span style={{ fontSize: 9, fontWeight: days > 30 ? 700 : 400, color: days > 30 ? '#ef4444' : days > 14 ? '#f59e0b' : '#aaa' }}>
          {days > 30 ? '⚠ ' : ''}J+{days}
        </span>
      </div>
    </div>
  )
}


// ── Bloc mail pré-rédigé (réutilisable) ───────────────────────────────────────
function MailBlock({ mail, label, onCopy, onGmail }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '0.5px solid #DBEAFE', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: '#EEF2FF', cursor: 'pointer' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#4338CA' }}>✉ Mail — {label}</span>
        <span style={{ fontSize: 10, color: '#4338CA' }}>{open ? '▴' : '▾'}</span>
      </div>
      {open && (
        <div style={{ padding: '10px 12px', background: 'white' }}>
          {[
            { lbl: 'À', val: mail.to },
            mail.cc ? { lbl: 'CC', val: mail.cc } : null,
            { lbl: 'Objet', val: mail.subject },
          ].filter(Boolean).map(({ lbl, val }) => (
            <div key={lbl} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{lbl}</div>
              <div style={{ fontSize: 10, color: '#333', background: '#F5F5F5', borderRadius: 4, padding: '4px 8px' }}>{val}</div>
            </div>
          ))}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Corps</div>
            <div
              style={{ fontSize: 10, color: '#333', background: '#F5F5F5', borderRadius: 4, padding: '6px 8px', lineHeight: 1.6, maxHeight: 220, overflowY: 'auto', userSelect: 'text' }}
              dangerouslySetInnerHTML={{ __html: bodyToHtml(mail.body) }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={onCopy} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: '0.5px solid #D5D0C8', background: 'white', fontSize: 10, fontWeight: 600, color: '#555', cursor: 'pointer' }}>
              Copier le corps
            </button>
            <button type="button" onClick={onGmail} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', background: ACCENT, fontSize: 10, fontWeight: 600, color: 'white', cursor: 'pointer' }}>
              Gmail + copier ↗
            </button>
          </div>
          <div style={{ fontSize: 9, color: '#aaa', marginTop: 4, textAlign: 'center' }}>
            Gmail s'ouvre avec À + Objet pré-remplis — colle le corps avec Ctrl+V
          </div>
        </div>
      )}
    </div>
  )
}

// ── Panneau latéral ────────────────────────────────────────────────────────────
function SidePanel({ profile, steps, stepNotes, taskNotes, onClose, onToggleTask, onAdvance, onTaskNote, onStepNote }) {
  const days = daysSince(profile.start)
  const currentStepDef = ONBOARDING_STEPS.find((s) => s.id === profile.step)
  const totalTasks = currentStepDef?.tasks.length || 0
  const doneTasks  = currentStepDef?.tasks.filter((t) => profile.done[t.id]).length || 0
  const allDone    = doneTasks === totalTasks && totalTasks > 0
  const isLastStep = profile.step === 8
  const currentVisibleIdx = steps.findIndex((s) => s.id === profile.step)
  const filledMails = currentStepDef ? (currentStepDef.mailTemplates || (currentStepDef.mailTemplate ? [currentStepDef.mailTemplate] : [])).map(t => fillMail(t, profile)) : []

  const copyMailBody = (mail) => {
    if (!mail) return
    const html = bodyToHtml(mail.body)
    copyAsHtml(html, mail.body)
  }

  const openGmail = (mail) => {
    if (!mail) return
    // Ouvre Gmail avec destinataire + objet pré-remplis — coller le corps avec Ctrl+V après
    const params = new URLSearchParams({ to: mail.to, su: mail.subject })
    if (mail.cc) params.set('cc', mail.cc)
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`, '_blank')
    // Copie simultanée du corps dans le presse-papier
    copyMailBody(mail)
  }

  // Replace task label placeholders
  const fillLabel = (label) => label
    .replace(/\{\{prenom\}\}/g, profile.fn)
    .replace(/\{\{nom\}\}/g, profile.ln)

  return (
    <div style={{ width: 390, flexShrink: 0, background: 'white', borderLeft: '1px solid #E5E0D8', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E0D8', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: ACCENT }}>{profile.fn} {profile.ln}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{profile.co}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 10, background: BG, color: ACCENT, padding: '3px 9px', borderRadius: 10, fontWeight: 600 }}>📅 {profile.session}</span>
              <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, fontWeight: 600, background: days > 30 ? '#FEE2E2' : BG, color: days > 30 ? '#ef4444' : '#888' }}>
                {days > 30 ? '⚠ ' : ''}J+{days} dans le process
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#bbb', cursor: 'pointer', padding: 4, flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progression globale</span>
            <span style={{ fontSize: 10, color: ACCENT, fontWeight: 700 }}>Étape {currentVisibleIdx + 1}/{steps.length}</span>
          </div>
          <div style={{ height: 5, background: '#F0EDE8', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, transition: 'width 0.3s', width: `${steps.length > 0 ? (currentVisibleIdx / steps.length) * 100 : 0}%`, background: GOLD }} />
          </div>
        </div>
      </div>

      {/* Corps : timeline */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {steps.map((step, idx) => {
          const status = step.id < profile.step ? 'done' : step.id === profile.step ? 'active' : 'todo'
          const isActive = status === 'active'
          const stepNoteKey = `${profile.id}-s${step.id}`

          return (
            <div key={step.id} style={{ marginBottom: 10 }}>

              {/* En-tête étape */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: isActive ? BG : 'transparent', border: isActive ? `1px solid ${GOLD}` : '1px solid transparent' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: status === 'done' ? ACCENT : status === 'active' ? GOLD : '#F0EDE8', color: status === 'done' ? GOLD : status === 'active' ? ACCENT : '#bbb' }}>
                  {status === 'done' ? '✓' : idx + 1}
                </div>
                <span style={{ fontSize: 11, flex: 1, lineHeight: 1.3, fontWeight: isActive ? 700 : 500, color: status === 'done' ? '#aaa' : status === 'active' ? ACCENT : '#ccc', textDecoration: status === 'done' ? 'line-through' : 'none' }}>
                  {step.short}
                  {step.optional && <span style={{ fontSize: 9, background: '#EDE9FE', color: '#7C3AED', padding: '1px 5px', borderRadius: 8, marginLeft: 5, fontWeight: 600 }}>Opt.</span>}
                </span>
                {isActive && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {(step.mailTemplate || step.mailTemplates?.length > 0) && <span style={{ fontSize: 9, background: '#EEF2FF', color: '#4338CA', padding: '2px 6px', borderRadius: 8, fontWeight: 600 }}>✉</span>}
                    {step.yousign       && <span style={{ fontSize: 9, background: '#FEF3C7', color: '#D97706', padding: '2px 6px', borderRadius: 8, fontWeight: 600 }}>✍</span>}
                    {step.waitAttestation && <span style={{ fontSize: 9, background: '#F0FDF4', color: '#16a34a', padding: '2px 6px', borderRadius: 8, fontWeight: 600 }}>⏳</span>}
                  </div>
                )}
              </div>

              {/* Checklist (étape active uniquement) */}
              {isActive && (
                <div style={{ marginLeft: 11, paddingLeft: 19, borderLeft: `2px solid ${GOLD}`, marginTop: 4 }}>

                  {step.tasks.map((task) => {
                    const done = !!profile.done[task.id]
                    const noteKey = `${profile.id}-${task.id}`
                    const noteVal = taskNotes[noteKey] || ''

                    return (
                      <div key={task.id} style={{ marginBottom: 4 }}>
                        {/* Ligne tâche */}
                        <div onClick={() => onToggleTask(profile.id, task.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: done ? '#F0FDF4' : 'transparent', transition: 'background 0.1s' }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1, border: `1.5px solid ${done ? '#16a34a' : '#D5D0C8'}`, background: done ? '#16a34a' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                            {done && <span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 11, color: done ? '#16a34a' : '#444', lineHeight: 1.5, textDecoration: done ? 'line-through' : 'none' }}>
                            {fillLabel(task.label)}
                          </span>
                        </div>

                        {/* Liens Drive sous la tâche */}
                        {task.links && task.links.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 32, marginTop: 2, marginBottom: 2 }}>
                            {task.links.map((key) => {
                              const link = L[key]
                              if (!link) return null
                              const isDrive = link.url.includes('drive.google') || link.url.includes('docs.google')
                              return (
                                <a key={key} href={link.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, color: isDrive ? '#1967D2' : '#0F6E56', background: isDrive ? '#E8F0FE' : '#E1F5EE', padding: '2px 7px', borderRadius: 10, textDecoration: 'none', fontWeight: 500 }}>
                                  {isDrive ? '📄' : '🔗'} {link.label}
                                </a>
                              )
                            })}
                          </div>
                        )}

                        {/* Note courte inline */}
                        <div style={{ paddingLeft: 32, marginTop: 2 }} onClick={(e) => e.stopPropagation()}>
                          <input
                            value={noteVal}
                            onChange={(e) => onTaskNote(profile.id, task.id, e.target.value)}
                            placeholder="Note courte…"
                            style={{ fontSize: 10, border: '0.5px solid #E5E0D8', borderRadius: 4, padding: '2px 7px', width: '100%', background: noteVal ? '#FFFDF5' : 'transparent', color: '#555', outline: 'none', fontFamily: 'inherit' }}
                          />
                        </div>
                      </div>
                    )
                  })}

                  {/* Note d'étape */}
                  <div style={{ margin: '10px 0 6px', borderLeft: `3px solid ${GOLD}`, borderRadius: '0 6px 6px 0', background: 'white', border: `0.5px solid ${GOLD}`, borderLeftWidth: 3, padding: '7px 10px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#9A7D4A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Note sur cette étape</div>
                    <textarea
                      value={stepNotes[stepNoteKey] || ''}
                      onChange={(e) => onStepNote(profile.id, step.id, e.target.value)}
                      placeholder="Contexte, blocage, info particulière…"
                      rows={2}
                      style={{ width: '100%', fontSize: 11, border: 'none', resize: 'none', background: 'transparent', color: '#444', lineHeight: 1.5, outline: 'none', fontFamily: 'inherit' }}
                    />
                  </div>

                  {/* Blocs mails pré-rédigés */}
                  {filledMails.map((mail, mIdx) => (
                    <MailBlock
                      key={mIdx}
                      mail={mail}
                      label={mail.label || step.short}
                      onCopy={() => copyMailBody(mail)}
                      onGmail={() => openGmail(mail)}
                    />
                  ))}

                  {/* Bouton avancer */}
                  <button type="button" onClick={() => { if (allDone) onAdvance(profile.id) }}
                    style={{ marginTop: 4, width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', background: allDone ? ACCENT : '#F0EDE8', color: allDone ? 'white' : '#bbb', fontSize: 12, fontWeight: 600, cursor: allDone ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
                    {allDone
                      ? isLastStep ? '🎉 Marquer comme complété' : `Passer à l'étape ${idx + 2} →`
                      : `${doneTasks}/${totalTasks} tâches complétées`}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
