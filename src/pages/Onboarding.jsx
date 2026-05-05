import { useState } from 'react'

// ── Couleurs ──────────────────────────────────────────────────────────────────
const ACCENT = '#173731'
const GOLD   = '#D2AB76'
const BG     = '#F5F0E8'

// ── Définition des étapes ─────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  {
    id: 1,
    short: 'Création société',
    name: 'Lancement démarche de création',
    optional: false,
    mailTemplate: true,
    yousign: false,
    waitAttestation: false,
    tasks: [
      { id: 't1_1', label: 'Créer dossier PRENOM NOM COURTAGE sur Drive (JURIDIQUE → NOS COURTIERS)' },
      { id: 't1_2', label: 'Copier + modifier les statuts avec les infos du gérant → exporter en PDF' },
      { id: 't1_3', label: 'Envoyer mail à Florian NARDOUX (statuts en PJ, responsable réseau en CC)' },
      { id: 't1_4', label: 'Suivi : dépôt de capital + signature des statuts' },
      { id: 't1_5', label: 'Attendre immatriculation avant de passer à l\'étape suivante' },
    ],
  },
  {
    id: 2,
    short: 'Pacte d\'associés',
    name: 'Validation immatriculation + Pacte d\'associés',
    optional: false,
    mailTemplate: true,
    yousign: true,
    waitAttestation: false,
    tasks: [
      { id: 't2_1', label: 'Recevoir mail de validation de l\'immatriculation de la société' },
      { id: 't2_2', label: 'Envoyer mail de confirmation au gérant' },
      { id: 't2_3', label: 'Mettre à jour le dossier Drive (CNI, KBIS, Pacte, Statuts, Convention)' },
      { id: 't2_4', label: 'Copier + modifier les cases jaunes du Pacte d\'associés' },
      { id: 't2_5', label: 'Envoyer via YouSign à Amaury + gérant (paraphes + "lu et approuvé")' },
    ],
  },
  {
    id: 3,
    short: 'Compte Pro',
    name: 'Préparation compte Pro gérant',
    optional: true,
    mailTemplate: true,
    yousign: true,
    waitAttestation: false,
    tasks: [
      { id: 't3_1', label: 'Copier + remplir la Déclaration actionnariale dans le dossier Drive' },
      { id: 't3_2', label: 'Télécharger + remplir formulaire RBE + lettre de demande d\'accès' },
      { id: 't3_3', label: 'Envoyer RBE + lettre de demande via YouSign au courtier' },
      { id: 't3_4', label: 'Envoyer déclaration actionnariale via YouSign (demande séparée)' },
      { id: 't3_5', label: 'Envoyer mail récapitulatif au gérant' },
    ],
  },
  {
    id: 4,
    short: 'RCP IAS',
    name: 'Inscription RCP IAS',
    optional: false,
    mailTemplate: true,
    yousign: true,
    waitAttestation: true,
    tasks: [
      { id: 't4_1', label: 'Remplir le document d\'adhésion RCP IAS' },
      { id: 't4_2', label: 'Préparer dossier compressé : CNI Amaury, CNI Gérant, CV Gérant, CV Amaury, KBIS Evolve Courtage, KBIS société, Statuts signés' },
      { id: 't4_3', label: 'Envoyer document d\'adhésion via YouSign au CGP (se mettre en copie destinataire)' },
      { id: 't4_4', label: 'Envoyer mail à Yann ARNOUD — yarnoud@verspieren.com' },
      { id: 't4_5', label: 'Attendre attestation RCP IAS → l\'intégrer au dossier Drive' },
    ],
  },
  {
    id: 5,
    short: 'CNPM',
    name: 'Adhésion CNPM (Médiateur)',
    optional: false,
    mailTemplate: true,
    yousign: false,
    waitAttestation: true,
    tasks: [
      { id: 't5_1', label: 'Remplir formulaire CNPM (affiliation : ADHÉRENT CNCEF — PAIEMENT ANNUEL)' },
      { id: 't5_2', label: 'Créer identifiant avec mail du gérant + mot de passe #NomAnnée (ex: #Garcia2025)' },
      { id: 't5_3', label: 'Envoyer mail au gérant avec ses identifiants CNPM' },
      { id: 't5_4', label: 'Attendre attestation CNPM → l\'intégrer au dossier Drive' },
    ],
  },
  {
    id: 6,
    short: 'CNCEF + ORIAS',
    name: 'Adhésion CNCEF + Immatriculation ORIAS',
    optional: false,
    mailTemplate: true,
    yousign: false,
    waitAttestation: true,
    tasks: [
      { id: 't6_1', label: 'Remplir formulaire CNCEF' },
      { id: 't6_2', label: 'Envoyer mail CNCEF' },
      { id: 't6_3', label: 'Remplir formulaire ORIAS' },
      { id: 't6_4', label: 'Envoyer mail ORIAS' },
      { id: 't6_5', label: 'Attendre attestation CNCEF → l\'intégrer au dossier Drive' },
      { id: 't6_6', label: 'Attendre attestation ORIAS → l\'intégrer au dossier Drive' },
    ],
  },
  {
    id: 7,
    short: 'Convention',
    name: 'Signature convention de partenariat',
    optional: false,
    mailTemplate: true,
    yousign: true,
    waitAttestation: false,
    tasks: [
      { id: 't7_1', label: 'Modifier la convention de partenariat (attention : modèle SAS, pas SARL)' },
      { id: 't7_2', label: 'Envoyer via YouSign (formulaire → 3 petits points → remplir le formulaire)' },
      { id: 't7_3', label: 'Envoyer mail de confirmation au gérant' },
    ],
  },
  {
    id: 8,
    short: 'Codes assureurs',
    name: 'Ouverture des codes assureurs',
    optional: false,
    mailTemplate: false,
    yousign: true,
    waitAttestation: false,
    tasks: [
      { id: 't8_1', label: 'Créer l\'adresse mail professionnelle du CGP' },
      { id: 't8_2', label: 'Abeille : remplir les deux documents + envoyer via YouSign' },
      { id: 't8_3', label: 'MMA : démarches d\'ouverture de codes' },
      { id: 't8_4', label: 'SwissLife : démarches d\'ouverture de codes' },
    ],
  },
]

// ── Données de démo (remplacées par Supabase en production) ───────────────────
const MOCK_PROFILES = [
  {
    id: 1, fn: 'Florent', ln: 'Comte',
    company: 'Crédit Agricole Centre-est',
    owner: 'Baptiste', currentStep: 1,
    startDate: '2026-04-15', session: 'Mai 2026',
    tasksDone: {},
  },
  {
    id: 2, fn: 'Marie', ln: 'Dupont',
    company: 'BNP Paribas',
    owner: 'Aurélien', currentStep: 2,
    startDate: '2026-04-08', session: 'Juin 2026',
    tasksDone: { t2_1: true, t2_2: true },
  },
  {
    id: 3, fn: 'Thomas', ln: 'Martin',
    company: 'Société Générale',
    owner: 'Baptiste', currentStep: 4,
    startDate: '2026-03-25', session: 'Juillet 2026',
    tasksDone: { t4_1: true, t4_2: true },
  },
  {
    id: 4, fn: 'Sophie', ln: 'Bernard',
    company: 'La Banque Postale',
    owner: 'Aurélien', currentStep: 6,
    startDate: '2026-03-10', session: 'Mai 2026',
    tasksDone: { t6_1: true, t6_2: true, t6_3: true },
  },
  {
    id: 5, fn: 'Lucas', ln: 'Petit',
    company: 'Crédit Mutuel',
    owner: 'Baptiste', currentStep: 8,
    startDate: '2026-02-20', session: 'Mai 2026',
    tasksDone: { t8_1: true },
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────
function daysSince(dateStr) {
  return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24))
}

function getInitials(fn, ln) {
  return `${fn?.[0] || ''}${ln?.[0] || ''}`.toUpperCase()
}

const OWNER_STYLE = {
  Baptiste:  { bg: '#EEF2FF', color: '#4338CA' },
  'Aurélien': { bg: '#F0FDF4', color: '#16a34a' },
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function Onboarding() {
  const [showOptional, setShowOptional]     = useState(false)
  const [selectedId, setSelectedId]         = useState(null)
  const [profiles, setProfiles]             = useState(MOCK_PROFILES)
  const [completed, setCompleted]           = useState([])

  const visibleSteps = ONBOARDING_STEPS.filter((s) => showOptional || !s.optional)

  const toggleTask = (profileId, taskId) => {
    setProfiles((prev) => prev.map((p) =>
      p.id !== profileId ? p : { ...p, tasksDone: { ...p.tasksDone, [taskId]: !p.tasksDone[taskId] } }
    ))
  }

  const advanceStep = (profileId) => {
    setProfiles((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== profileId) return p
        let next = p.currentStep + 1
        if (!showOptional && next === 3) next = 4   // sauter étape 3 si masquée
        if (next > 8) {
          setCompleted((c) => [...c, { ...p, currentStep: 9 }])
          return null
        }
        return { ...p, currentStep: next, tasksDone: {} }
      })
      return updated.filter(Boolean)
    })
    setSelectedId(null)
  }

  const selectedProfile = profiles.find((p) => p.id === selectedId)

  return (
    <div style={{ display: 'flex', height: '100%', background: BG, overflow: 'hidden' }}>

      {/* ── Zone Kanban ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Palatino, serif', fontSize: 20, fontWeight: 600, color: ACCENT }}>
                🚀 Onboarding CGP
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
                cursor: 'pointer', transition: 'all 0.15s',
                border: `1px solid ${showOptional ? ACCENT : '#E5E0D8'}`,
                background: showOptional ? ACCENT : 'white',
                color: showOptional ? 'white' : '#666',
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
                if (!showOptional && p.currentStep === 3) return false
                return p.currentStep === step.id
              })

              return (
                <KanbanColumn
                  key={step.id}
                  step={step}
                  idx={idx}
                  profiles={colProfiles}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )
            })}

            {/* Colonne Complétés */}
            <div style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
              <div style={{
                background: 'white', borderRadius: '10px 10px 0 0',
                border: '1px solid #BBF7D0', borderTop: '3px solid #16a34a',
                padding: '10px 12px', marginBottom: 2,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#DCFCE7', color: '#16a34a',
                    fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>✓</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>Complétés</span>
                </div>
                <div style={{ fontSize: 10, color: '#aaa', paddingLeft: 26 }}>
                  {completed.length} profil{completed.length > 1 ? 's' : ''}
                </div>
              </div>
              <div style={{
                flex: 1, overflowY: 'auto', background: '#F0FDF4',
                border: '1px solid #BBF7D0', borderTop: 'none',
                borderRadius: '0 0 10px 10px', padding: 8,
                display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120,
              }}>
                {completed.map((p) => (
                  <div key={p.id} style={{
                    background: 'white', borderRadius: 8, border: '1px solid #BBF7D0', padding: '10px 12px',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>✓ {p.fn} {p.ln}</div>
                    <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{p.company}</div>
                    <div style={{ fontSize: 10, color: '#16a34a', marginTop: 4 }}>📅 {p.session}</div>
                  </div>
                ))}
                {completed.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 11, color: '#bbb' }}>
                    Aucun pour l'instant
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Panneau latéral ── */}
      {selectedProfile && (
        <SidePanel
          profile={selectedProfile}
          steps={visibleSteps}
          onClose={() => setSelectedId(null)}
          onToggleTask={toggleTask}
          onAdvance={advanceStep}
        />
      )}
    </div>
  )
}

// ── Colonne Kanban ─────────────────────────────────────────────────────────────
function KanbanColumn({ step, idx, profiles, selectedId, onSelect }) {
  return (
    <div style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
      {/* Header colonne */}
      <div style={{
        background: 'white',
        border: `1px solid #E5E0D8`,
        borderTop: `3px solid ${step.optional ? '#C4B5FD' : ACCENT}`,
        borderRadius: '10px 10px 0 0',
        padding: '10px 12px', marginBottom: 2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            background: step.optional ? '#EDE9FE' : ACCENT,
            color: step.optional ? '#7C3AED' : GOLD,
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{idx + 1}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, lineHeight: 1.3 }}>{step.short}</span>
          {step.optional && (
            <span style={{ fontSize: 9, background: '#EDE9FE', color: '#7C3AED', padding: '1px 5px', borderRadius: 8, fontWeight: 600 }}>
              Optionnel
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: '#aaa', paddingLeft: 26 }}>
          {profiles.length} profil{profiles.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Cartes */}
      <div style={{
        flex: 1, overflowY: 'auto', background: '#EDE9E0',
        border: '1px solid #E5E0D8', borderTop: 'none',
        borderRadius: '0 0 10px 10px', padding: 8,
        display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120,
      }}>
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            step={step}
            isSelected={selectedId === profile.id}
            onSelect={onSelect}
          />
        ))}
        {profiles.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 11, color: '#bbb' }}>
            Aucun CGP
          </div>
        )}
      </div>
    </div>
  )
}

// ── Carte profil ───────────────────────────────────────────────────────────────
function ProfileCard({ profile, step, isSelected, onSelect }) {
  const days = daysSince(profile.startDate)
  const ownerStyle = OWNER_STYLE[profile.owner] || { bg: '#F3F4F6', color: '#666' }
  const totalTasks = step.tasks.length
  const doneTasks  = step.tasks.filter((t) => profile.tasksDone[t.id]).length
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  return (
    <div
      onClick={() => onSelect(isSelected ? null : profile.id)}
      style={{
        background: 'white', borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
        border: `1px solid ${isSelected ? ACCENT : '#E5E0D8'}`,
        boxShadow: isSelected ? `0 0 0 2px ${ACCENT}18` : '0 1px 3px rgba(0,0,0,0.05)',
        transition: 'all 0.15s',
      }}
    >
      {/* Avatar + nom */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: ACCENT, color: GOLD,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>
          {getInitials(profile.fn, profile.ln)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {profile.fn} {profile.ln}
          </div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {profile.company}
          </div>
        </div>
      </div>

      {/* Session */}
      <div style={{
        background: BG, borderRadius: 6, padding: '4px 8px',
        fontSize: 10, color: ACCENT, fontWeight: 600, marginBottom: 8,
      }}>
        📅 {profile.session}
      </div>

      {/* Barre de progression */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: '#aaa' }}>Tâches</span>
          <span style={{ fontSize: 9, color: '#555', fontWeight: 600 }}>{doneTasks}/{totalTasks}</span>
        </div>
        <div style={{ height: 3, background: '#F0EDE8', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, transition: 'width 0.3s',
            width: `${pct}%`,
            background: pct === 100 ? '#16a34a' : ACCENT,
          }} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
          background: ownerStyle.bg, color: ownerStyle.color,
        }}>
          {profile.owner}
        </span>
        <span style={{
          fontSize: 9, fontWeight: days > 30 ? 700 : 400,
          color: days > 30 ? '#ef4444' : days > 14 ? '#f59e0b' : '#aaa',
        }}>
          J+{days}
        </span>
      </div>
    </div>
  )
}

// ── Panneau latéral ────────────────────────────────────────────────────────────
function SidePanel({ profile, steps, onClose, onToggleTask, onAdvance }) {
  const days = daysSince(profile.startDate)
  const currentStepDef = ONBOARDING_STEPS.find((s) => s.id === profile.currentStep)
  const totalTasks = currentStepDef?.tasks.length || 0
  const doneTasks  = currentStepDef?.tasks.filter((t) => profile.tasksDone[t.id]).length || 0
  const allDone    = doneTasks === totalTasks && totalTasks > 0
  const isLastStep = profile.currentStep === 8

  const currentVisibleIdx = steps.findIndex((s) => s.id === profile.currentStep)

  return (
    <div style={{
      width: 370, flexShrink: 0,
      background: 'white', borderLeft: '1px solid #E5E0D8',
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E0D8', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: ACCENT }}>
              {profile.fn} {profile.ln}
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{profile.company}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <span style={{
                fontSize: 10, background: BG, color: ACCENT,
                padding: '3px 9px', borderRadius: 10, fontWeight: 600,
              }}>📅 {profile.session}</span>
              <span style={{
                fontSize: 10, padding: '3px 9px', borderRadius: 10, fontWeight: 600,
                background: days > 30 ? '#FEE2E2' : BG,
                color: days > 30 ? '#ef4444' : '#888',
              }}>
                {days > 30 ? '⚠️ ' : ''}J+{days} dans le process
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, color: '#bbb', cursor: 'pointer', padding: 4, flexShrink: 0 }}
          >✕</button>
        </div>

        {/* Progression globale */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Progression globale
            </span>
            <span style={{ fontSize: 10, color: ACCENT, fontWeight: 700 }}>
              Étape {currentVisibleIdx + 1}/{steps.length}
            </span>
          </div>
          <div style={{ height: 5, background: '#F0EDE8', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3, transition: 'width 0.3s',
              width: `${steps.length > 0 ? ((currentVisibleIdx) / steps.length) * 100 : 0}%`,
              background: GOLD,
            }} />
          </div>
        </div>
      </div>

      {/* Corps : timeline des étapes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {steps.map((step, idx) => {
          const status = step.id < profile.currentStep ? 'done'
            : step.id === profile.currentStep ? 'active'
            : 'todo'
          const isActive = status === 'active'

          return (
            <div key={step.id} style={{ marginBottom: 10 }}>

              {/* En-tête étape */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                borderRadius: 8,
                background: isActive ? BG : 'transparent',
                border: isActive ? `1px solid ${GOLD}` : '1px solid transparent',
              }}>
                {/* Indicateur */}
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                  background: status === 'done' ? ACCENT : status === 'active' ? GOLD : '#F0EDE8',
                  color: status === 'done' ? GOLD : status === 'active' ? ACCENT : '#bbb',
                }}>
                  {status === 'done' ? '✓' : idx + 1}
                </div>

                {/* Nom */}
                <span style={{
                  fontSize: 11, flex: 1, lineHeight: 1.3,
                  fontWeight: isActive ? 700 : 500,
                  color: status === 'done' ? '#aaa' : status === 'active' ? ACCENT : '#ccc',
                  textDecoration: status === 'done' ? 'line-through' : 'none',
                }}>
                  {step.short}
                  {step.optional && (
                    <span style={{ fontSize: 9, background: '#EDE9FE', color: '#7C3AED', padding: '1px 5px', borderRadius: 8, marginLeft: 5, fontWeight: 600 }}>
                      Optionnel
                    </span>
                  )}
                </span>

                {/* Badges outils */}
                {isActive && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {step.mailTemplate && (
                      <span style={{ fontSize: 9, background: '#EEF2FF', color: '#4338CA', padding: '2px 6px', borderRadius: 8, fontWeight: 600 }}>✉️</span>
                    )}
                    {step.yousign && (
                      <span style={{ fontSize: 9, background: '#FEF3C7', color: '#D97706', padding: '2px 6px', borderRadius: 8, fontWeight: 600 }}>🖊️</span>
                    )}
                    {step.waitAttestation && (
                      <span style={{ fontSize: 9, background: '#F0FDF4', color: '#16a34a', padding: '2px 6px', borderRadius: 8, fontWeight: 600 }}>⏳</span>
                    )}
                  </div>
                )}
              </div>

              {/* Checklist (uniquement étape active) */}
              {isActive && (
                <div style={{ marginLeft: 11, paddingLeft: 19, borderLeft: `2px solid ${GOLD}`, marginTop: 4 }}>

                  {step.tasks.map((task) => {
                    const done = !!profile.tasksDone[task.id]
                    return (
                      <div
                        key={task.id}
                        onClick={() => onToggleTask(profile.id, task.id)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                          background: done ? '#F0FDF4' : 'transparent',
                          marginBottom: 2, transition: 'background 0.1s',
                        }}
                      >
                        {/* Checkbox */}
                        <div style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                          border: `1.5px solid ${done ? '#16a34a' : '#D5D0C8'}`,
                          background: done ? '#16a34a' : 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {done && <span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{
                          fontSize: 11, color: done ? '#16a34a' : '#444',
                          lineHeight: 1.5,
                          textDecoration: done ? 'line-through' : 'none',
                        }}>
                          {task.label}
                        </span>
                      </div>
                    )
                  })}

                  {/* Bouton passer à l'étape suivante */}
                  <button
                    type="button"
                    onClick={() => { if (allDone) onAdvance(profile.id) }}
                    style={{
                      marginTop: 10, width: '100%',
                      padding: '9px 0', borderRadius: 8, border: 'none',
                      background: allDone ? ACCENT : '#F0EDE8',
                      color: allDone ? 'white' : '#bbb',
                      fontSize: 12, fontWeight: 600,
                      cursor: allDone ? 'pointer' : 'not-allowed',
                      transition: 'all 0.15s',
                    }}
                  >
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
