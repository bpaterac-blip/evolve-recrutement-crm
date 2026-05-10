import { useState } from 'react'
import { IconClose } from './Icons'

const PAGE_STYLE = {
  bg: 'rgba(0,0,0,0.45)',
  cardBg: '#ffffff',
  border: '#E5E0D8',
  accent: '#173731',
  gold: '#D2AB76',
  surface: '#F8F5F1',
  textSecondary: '#6B6B6B',
  textTertiary: '#9A9A9A',
}

// ─── helpers ───────────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 600,
      color: PAGE_STYLE.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      borderBottom: `0.5px solid ${PAGE_STYLE.border}`,
      paddingBottom: 6,
      marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: PAGE_STYLE.textSecondary, marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || ''}
      style={{
        width: '100%',
        fontSize: 13,
        color: '#1A1A1A',
        background: PAGE_STYLE.surface,
        border: `0.5px solid ${PAGE_STYLE.border}`,
        borderRadius: 4,
        padding: '5px 8px',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  )
}

function TextArea({ value, onChange, placeholder, minHeight = 52 }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || ''}
      rows={3}
      style={{
        width: '100%',
        fontSize: 13,
        color: '#1A1A1A',
        background: PAGE_STYLE.surface,
        border: `0.5px solid ${PAGE_STYLE.border}`,
        borderRadius: 4,
        padding: '5px 8px',
        resize: 'vertical',
        minHeight,
        fontFamily: 'inherit',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  )
}

function PillGroup({ options, selected, onToggle, color = 'info' }) {
  const colorMap = {
    info: { bg: '#E6F1FB', text: '#185FA5', borderOn: '#B5D4F4' },
    success: { bg: '#EAF3DE', text: '#3B6D11', borderOn: '#C0DD97' },
    warning: { bg: '#FAEEDA', text: '#854F0B', borderOn: '#FAC775' },
  }
  const c = colorMap[color] || colorMap.info
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
      {options.map(opt => {
        const on = selected.includes(opt)
        return (
          <span
            key={opt}
            onClick={() => onToggle(opt)}
            style={{
              fontSize: 12,
              padding: '3px 10px',
              borderRadius: 20,
              cursor: 'pointer',
              userSelect: 'none',
              border: `0.5px solid ${on ? c.borderOn : PAGE_STYLE.border}`,
              background: on ? c.bg : '#F8F5F1',
              color: on ? c.text : PAGE_STYLE.textSecondary,
              transition: 'all 0.1s',
            }}
          >
            {opt}
          </span>
        )
      })}
    </div>
  )
}

function MaturitePicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={() => onChange(n === value ? null : n)}
          style={{
            width: 28, height: 28, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', userSelect: 'none',
            border: `0.5px solid ${n === value ? PAGE_STYLE.gold : PAGE_STYLE.border}`,
            background: n === value ? PAGE_STYLE.gold : PAGE_STYLE.surface,
            color: n === value ? PAGE_STYLE.accent : PAGE_STYLE.textSecondary,
          }}
        >
          {n}
        </span>
      ))}
    </div>
  )
}

function TwoCol({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {children}
    </div>
  )
}

// ─── HTML serializer ────────────────────────────────────────────────────────

function badge(label, color = '#185FA5', bg = '#E6F1FB') {
  return `<span style="font-size:11px;font-weight:600;background:${bg};color:${color};padding:2px 9px;border-radius:20px;display:inline-block">${label}</span>`
}

function sectionHtml(title, content) {
  if (!content) return ''
  return `
<div style="margin-bottom:14px">
  <div style="font-size:10px;font-weight:600;color:#9A9A9A;text-transform:uppercase;letter-spacing:0.07em;border-bottom:0.5px solid #E5E0D8;padding-bottom:4px;margin-bottom:8px">${title}</div>
  ${content}
</div>`
}

function fieldHtml(label, value) {
  if (!value) return ''
  return `<div style="font-size:13px;margin-bottom:5px"><span style="color:#6B6B6B">${label} :</span> ${value}</div>`
}

function pillsHtml(selected) {
  if (!selected.length) return ''
  return `<div style="margin-bottom:6px">${selected.map(s => `<span style="font-size:11px;background:#E6F1FB;color:#185FA5;border-radius:20px;padding:2px 8px;margin-right:4px">${s}</span>`).join('')}</div>`
}

function buildR0Html(f) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const header = `
<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #E5E0D8">
  ${badge('R0')}
  <div>
    <div style="font-size:14px;font-weight:600;color:#1A1A1A">Récapitulatif R0</div>
    <div style="font-size:12px;color:#6B6B6B;margin-top:2px">${f.date || today}${f.duree ? ` · ${f.duree}` : ''}</div>
  </div>
</div>`

  const s1 = sectionHtml('1. Situation actuelle',
    pillsHtml(f.statuts) +
    fieldHtml('Employeur', f.employeur) +
    fieldHtml('Ancienneté', f.anciennete) +
    (f.contexte ? `<div style="font-size:13px;color:#6B6B6B;margin-bottom:4px">Contexte :</div><div style="font-size:13px;color:#1A1A1A;white-space:pre-wrap">${f.contexte}</div>` : '')
  )

  const s2 = sectionHtml('2. Clientèle',
    fieldHtml('Profil clients', f.profilClients) +
    fieldHtml('Portefeuille', f.portefeuille) +
    fieldHtml('Encours moyen', f.encours) +
    fieldHtml('Produits', f.produits)
  )

  const s3 = sectionHtml('3. Objectifs',
    fieldHtml('Revenus an 1', f.revenusAn1) +
    fieldHtml('Revenus an 3', f.revenusAn3) +
    fieldHtml('Nouveaux clients / an', f.nouveauxClients) +
    fieldHtml('Ambitions long terme', f.ambitions)
  )

  const s4 = sectionHtml('4. Besoins & attentes',
    (f.besoins ? `<div style="font-size:13px;color:#1A1A1A;white-space:pre-wrap;margin-bottom:6px">${f.besoins}</div>` : '') +
    (f.attentesEvolve ? `<div style="font-size:13px;color:#6B6B6B;margin-bottom:2px">Attentes Evolve :</div><div style="font-size:13px;color:#1A1A1A;white-space:pre-wrap">${f.attentesEvolve}</div>` : '')
  )

  const s5 = sectionHtml('5. Craintes & freins',
    (f.freins ? `<div style="font-size:13px;color:#1A1A1A;white-space:pre-wrap;margin-bottom:6px">${f.freins}</div>` : '') +
    (f.blocage ? `<div style="font-size:13px;color:#6B6B6B;margin-bottom:2px">Blocage réel :</div><div style="font-size:13px;color:#1A1A1A;white-space:pre-wrap">${f.blocage}</div>` : '')
  )

  const maturiteLabel = f.maturiteNote ? ` — Note ${f.maturiteNote}/5` : ''
  const s6 = sectionHtml('6. Maturité du projet',
    pillsHtml(f.maturites) +
    fieldHtml('Horizon départ', f.horizon) +
    (f.maturiteNote ? `<div style="font-size:13px;margin-bottom:5px"><span style="color:#6B6B6B">Maturité :</span> <strong>${f.maturiteNote}/5</strong></div>` : '')
  )

  const synth = f.resume || f.blocagePrincipal || f.actionAvantR1 ? `
<div style="background:#F8F5F1;border-radius:8px;padding:12px 14px;margin-top:4px">
  <div style="font-size:10px;font-weight:600;color:#9A9A9A;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">Synthèse & next step</div>
  ${f.resume ? `<div style="font-size:13px;color:#1A1A1A;white-space:pre-wrap;margin-bottom:8px">${f.resume}</div>` : ''}
  ${fieldHtml('Blocage principal', f.blocagePrincipal)}
  ${fieldHtml('Action avant R1', f.actionAvantR1)}
</div>` : ''

  return `<div style="font-family:inherit">${header}${s1}${s2}${s3}${s4}${s5}${s6}${synth}</div>`
}

function buildR1Html(f) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const header = `
<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #E5E0D8">
  ${badge('R1', '#3B6D11', '#EAF3DE')}
  <div>
    <div style="font-size:14px;font-weight:600;color:#1A1A1A">Récapitulatif R1</div>
    <div style="font-size:12px;color:#6B6B6B;margin-top:2px">${f.date || today}${f.duree ? ` · ${f.duree}` : ''}</div>
  </div>
</div>`

  const s1 = sectionHtml('Présentation Evolve',
    pillsHtml(f.pointsPres)
  )
  const s2 = sectionHtml('Questions posées',
    f.questions ? `<div style="font-size:13px;color:#1A1A1A;white-space:pre-wrap">${f.questions}</div>` : ''
  )
  const s3 = sectionHtml('Objections',
    pillsHtml(f.objections) +
    (f.objectionDetail ? `<div style="font-size:13px;color:#1A1A1A;white-space:pre-wrap;margin-top:4px">${f.objectionDetail}</div>` : '')
  )

  const synth = `
<div style="background:#F8F5F1;border-radius:8px;padding:12px 14px;margin-top:4px">
  <div style="font-size:10px;font-weight:600;color:#9A9A9A;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">Suite donnée</div>
  ${pillsHtml(f.decision)}
  ${fieldHtml('Prochaine étape', f.prochaineEtape)}
  ${f.resume ? `<div style="font-size:13px;color:#1A1A1A;white-space:pre-wrap;margin-top:4px">${f.resume}</div>` : ''}
</div>`

  return `<div style="font-family:inherit">${header}${s1}${s2}${s3}${synth}</div>`
}

function buildEtapeHtml(f) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const header = `
<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #E5E0D8">
  ${badge("Point d'étape", '#854F0B', '#FAEEDA')}
  <div>
    <div style="font-size:14px;font-weight:600;color:#1A1A1A">Point d'étape</div>
    <div style="font-size:12px;color:#6B6B6B;margin-top:2px">${f.date || today}${f.duree ? ` · ${f.duree}` : ''}</div>
  </div>
</div>`
  return `<div style="font-family:inherit">${header}
${sectionHtml('Avancement', f.avancement ? `<div style="font-size:13px;white-space:pre-wrap">${f.avancement}</div>` : '')}
${sectionHtml('Blocages', f.blocages ? `<div style="font-size:13px;white-space:pre-wrap">${f.blocages}</div>` : '')}
${sectionHtml('Prochaine étape', f.prochaineEtape ? `<div style="font-size:13px;white-space:pre-wrap">${f.prochaineEtape}</div>` : '')}
</div>`
}

// ─── R0 Form ─────────────────────────────────────────────────────────────────

function R0Form({ onSave, onCancel }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [duree, setDuree] = useState('')
  const [statuts, setStatuts] = useState([])
  const [employeur, setEmployeur] = useState('')
  const [anciennete, setAnciennete] = useState('')
  const [contexte, setContexte] = useState('')
  const [profilClients, setProfilClients] = useState('')
  const [portefeuille, setPortefeuille] = useState('')
  const [encours, setEncours] = useState('')
  const [produits, setProduits] = useState('')
  const [revenusAn1, setRevenusAn1] = useState('')
  const [revenusAn3, setRevenusAn3] = useState('')
  const [nouveauxClients, setNouveauxClients] = useState('')
  const [ambitions, setAmbitions] = useState('')
  const [besoins, setBesoins] = useState('')
  const [attentesEvolve, setAttentesEvolve] = useState('')
  const [freins, setFreins] = useState('')
  const [blocage, setBlocage] = useState('')
  const [maturites, setMaturites] = useState([])
  const [horizon, setHorizon] = useState('')
  const [maturiteNote, setMaturiteNote] = useState(null)
  const [resume, setResume] = useState('')
  const [blocagePrincipal, setBlocagePrincipal] = useState('')
  const [actionAvantR1, setActionAvantR1] = useState('')

  const toggle = (arr, setArr) => (val) => {
    setArr(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])
  }

  const handleSave = () => {
    const html = buildR0Html({
      date: new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      duree, statuts, employeur, anciennete, contexte,
      profilClients, portefeuille, encours, produits,
      revenusAn1, revenusAn3, nouveauxClients, ambitions,
      besoins, attentesEvolve, freins, blocage,
      maturites, horizon, maturiteNote,
      resume, blocagePrincipal, actionAvantR1,
    })
    onSave(html, 'Récapitulatif R0')
  }

  return (
    <>
      <TwoCol>
        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', fontSize: 13, padding: '5px 8px', borderRadius: 4, border: `0.5px solid ${PAGE_STYLE.border}`, background: PAGE_STYLE.surface, outline: 'none' }} /></Field>
        <Field label="Durée"><TextInput value={duree} onChange={setDuree} placeholder="ex. 35 min" /></Field>
      </TwoCol>

      <div style={{ borderBottom: `0.5px solid ${PAGE_STYLE.border}`, margin: '12px 0' }} />

      <div style={{ marginBottom: 14 }}>
        <SectionTitle>1. Situation actuelle</SectionTitle>
        <PillGroup options={['Salarié cadre', 'Salarié non cadre', 'Déjà indépendant', 'En préavis', 'En cours de départ']} selected={statuts} onToggle={toggle(statuts, setStatuts)} />
        <TwoCol>
          <Field label="Employeur actuel"><TextInput value={employeur} onChange={setEmployeur} placeholder="Crédit Agricole…" /></Field>
          <Field label="Ancienneté"><TextInput value={anciennete} onChange={setAnciennete} placeholder="5 ans…" /></Field>
        </TwoCol>
        <Field label="Contexte / départ envisagé"><TextArea value={contexte} onChange={setContexte} placeholder="Contexte de l'échange, raison du départ…" /></Field>
      </div>

      <div style={{ marginBottom: 14 }}>
        <SectionTitle>2. Clientèle</SectionTitle>
        <TwoCol>
          <Field label="Profil clients visés"><TextInput value={profilClients} onChange={setProfilClients} placeholder="Particuliers, chefs d'entreprise…" /></Field>
          <Field label="Taille portefeuille estimée"><TextInput value={portefeuille} onChange={setPortefeuille} placeholder="~150 clients" /></Field>
        </TwoCol>
        <TwoCol>
          <Field label="Encours moyen / client"><TextInput value={encours} onChange={setEncours} placeholder="120 k€…" /></Field>
          <Field label="Produits maîtrisés"><TextInput value={produits} onChange={setProduits} placeholder="AV, PER, SCPI…" /></Field>
        </TwoCol>
      </div>

      <div style={{ marginBottom: 14 }}>
        <SectionTitle>3. Objectifs</SectionTitle>
        <TwoCol>
          <Field label="Revenus visés an 1"><TextInput value={revenusAn1} onChange={setRevenusAn1} placeholder="60 k€…" /></Field>
          <Field label="Revenus visés an 3"><TextInput value={revenusAn3} onChange={setRevenusAn3} placeholder="120 k€…" /></Field>
        </TwoCol>
        <TwoCol>
          <Field label="Nouveaux clients visés / an"><TextInput value={nouveauxClients} onChange={setNouveauxClients} placeholder="20…" /></Field>
          <Field label="Ambitions long terme"><TextInput value={ambitions} onChange={setAmbitions} placeholder="Cabinet propre…" /></Field>
        </TwoCol>
      </div>

      <div style={{ marginBottom: 14 }}>
        <SectionTitle>4. Besoins & attentes</SectionTitle>
        <Field label="Ce dont il a besoin pour se lancer"><TextArea value={besoins} onChange={setBesoins} placeholder="Accompagnement, structure juridique, accès produits…" /></Field>
        <Field label="Attentes spécifiques vis-à-vis d'Evolve"><TextArea value={attentesEvolve} onChange={setAttentesEvolve} placeholder="Comitaux, outils, accompagnement terrain…" /></Field>
      </div>

      <div style={{ marginBottom: 14 }}>
        <SectionTitle>5. Craintes & freins</SectionTitle>
        <Field label="Principaux freins exprimés"><TextArea value={freins} onChange={setFreins} placeholder="Revenus variables, isolement, perte d'avantages salariés…" /></Field>
        <Field label="Ce qui le bloque vraiment (dans ses mots)"><TextArea value={blocage} onChange={setBlocage} placeholder="" /></Field>
      </div>

      <div style={{ marginBottom: 14 }}>
        <SectionTitle>6. Maturité du projet</SectionTitle>
        <PillGroup options={['Découverte', 'En réflexion', 'Décidé', 'Prêt à signer']} selected={maturites} onToggle={toggle(maturites, setMaturites)} />
        <TwoCol>
          <Field label="Horizon de départ envisagé"><TextInput value={horizon} onChange={setHorizon} placeholder="Q4 2026…" /></Field>
          <Field label="Note de maturité (1–5)"><MaturitePicker value={maturiteNote} onChange={setMaturiteNote} /></Field>
        </TwoCol>
      </div>

      <div style={{ background: PAGE_STYLE.surface, borderRadius: 8, padding: '12px 14px' }}>
        <SectionTitle>Synthèse & next step</SectionTitle>
        <Field label="Résumé de l'appel"><TextArea value={resume} onChange={setResume} placeholder="Ce qu'il retient, l'impression générale…" minHeight={64} /></Field>
        <TwoCol>
          <Field label="Point de blocage principal"><TextArea value={blocagePrincipal} onChange={setBlocagePrincipal} /></Field>
          <Field label="Action avant le R1"><TextArea value={actionAvantR1} onChange={setActionAvantR1} placeholder="Envoyer le deck, relancer dans 2 sem…" /></Field>
        </TwoCol>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" onClick={onCancel} style={{ padding: '7px 14px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 8, background: 'transparent', color: PAGE_STYLE.textSecondary, cursor: 'pointer' }}>Annuler</button>
        <button type="button" onClick={handleSave} style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: PAGE_STYLE.gold, color: PAGE_STYLE.accent, cursor: 'pointer' }}>Enregistrer</button>
      </div>
    </>
  )
}

// ─── R1 Form ─────────────────────────────────────────────────────────────────

function R1Form({ onSave, onCancel }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [duree, setDuree] = useState('')
  const [pointsPres, setPointsPres] = useState(['Modèle économique', 'Plateforme produits'])
  const [questions, setQuestions] = useState('')
  const [objections, setObjections] = useState([])
  const [objectionDetail, setObjectionDetail] = useState('')
  const [decision, setDecision] = useState([])
  const [prochaineEtape, setProchaineEtape] = useState('')
  const [resume, setResume] = useState('')

  const toggle = (arr, setArr) => (val) => {
    setArr(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])
  }

  const handleSave = () => {
    const html = buildR1Html({
      date: new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      duree, pointsPres, questions, objections, objectionDetail, decision, prochaineEtape, resume,
    })
    onSave(html, 'Récapitulatif R1')
  }

  return (
    <>
      <TwoCol>
        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', fontSize: 13, padding: '5px 8px', borderRadius: 4, border: `0.5px solid ${PAGE_STYLE.border}`, background: PAGE_STYLE.surface, outline: 'none' }} /></Field>
        <Field label="Durée"><TextInput value={duree} onChange={setDuree} placeholder="45 min…" /></Field>
      </TwoCol>

      <div style={{ borderBottom: `0.5px solid ${PAGE_STYLE.border}`, margin: '12px 0' }} />

      <div style={{ marginBottom: 14 }}>
        <SectionTitle>Présentation Evolve</SectionTitle>
        <div style={{ fontSize: 11, color: PAGE_STYLE.textSecondary, marginBottom: 6 }}>Points abordés</div>
        <PillGroup
          options={['Modèle économique', 'Plateforme produits', 'Accompagnement', 'Rémunération', 'Juridique', 'Témoignages CGP']}
          selected={pointsPres}
          onToggle={toggle(pointsPres, setPointsPres)}
          color="success"
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <SectionTitle>Questions posées</SectionTitle>
        <TextArea value={questions} onChange={setQuestions} placeholder="Questions soulevées par le prospect…" minHeight={64} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <SectionTitle>Objections</SectionTitle>
        <PillGroup
          options={['Variable trop risqué', 'Contrainte contractuelle', 'Timing', 'Concurrence', 'Autre']}
          selected={objections}
          onToggle={toggle(objections, setObjections)}
        />
        <TextArea value={objectionDetail} onChange={setObjectionDetail} placeholder="Précisions sur les objections…" />
      </div>

      <div style={{ background: PAGE_STYLE.surface, borderRadius: 8, padding: '12px 14px' }}>
        <SectionTitle>Suite donnée</SectionTitle>
        <div style={{ fontSize: 11, color: PAGE_STYLE.textSecondary, marginBottom: 6 }}>Décision</div>
        <PillGroup
          options={['Intéressé', 'À relancer', 'En pause', 'Non']}
          selected={decision}
          onToggle={toggle(decision, setDecision)}
          color="success"
        />
        <Field label="Prochaine étape"><TextInput value={prochaineEtape} onChange={setProchaineEtape} placeholder="R2 Amaury, Point téléphonique…" /></Field>
        <Field label="Résumé & impression générale"><TextArea value={resume} onChange={setResume} minHeight={64} /></Field>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" onClick={onCancel} style={{ padding: '7px 14px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 8, background: 'transparent', color: PAGE_STYLE.textSecondary, cursor: 'pointer' }}>Annuler</button>
        <button type="button" onClick={handleSave} style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: PAGE_STYLE.gold, color: PAGE_STYLE.accent, cursor: 'pointer' }}>Enregistrer</button>
      </div>
    </>
  )
}

// ─── Point d'étape Form ───────────────────────────────────────────────────────

function EtapeForm({ onSave, onCancel }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [duree, setDuree] = useState('')
  const [avancement, setAvancement] = useState('')
  const [blocages, setBlocages] = useState('')
  const [prochaineEtape, setProchaineEtape] = useState('')

  const handleSave = () => {
    const html = buildEtapeHtml({
      date: new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      duree, avancement, blocages, prochaineEtape,
    })
    onSave(html, "Récapitulatif Point d'étape")
  }

  return (
    <>
      <TwoCol>
        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', fontSize: 13, padding: '5px 8px', borderRadius: 4, border: `0.5px solid ${PAGE_STYLE.border}`, background: PAGE_STYLE.surface, outline: 'none' }} /></Field>
        <Field label="Durée"><TextInput value={duree} onChange={setDuree} placeholder="20 min…" /></Field>
      </TwoCol>
      <div style={{ borderBottom: `0.5px solid ${PAGE_STYLE.border}`, margin: '12px 0' }} />
      <Field label="Avancement"><TextArea value={avancement} onChange={setAvancement} placeholder="Où en est le projet, ce qui a avancé…" minHeight={80} /></Field>
      <Field label="Blocages"><TextArea value={blocages} onChange={setBlocages} placeholder="Points de blocage identifiés…" minHeight={64} /></Field>
      <Field label="Prochaine étape"><TextArea value={prochaineEtape} onChange={setProchaineEtape} placeholder="Actions à mener, prochain RDV…" minHeight={64} /></Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" onClick={onCancel} style={{ padding: '7px 14px', fontSize: 13, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 8, background: 'transparent', color: PAGE_STYLE.textSecondary, cursor: 'pointer' }}>Annuler</button>
        <button type="button" onClick={handleSave} style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: PAGE_STYLE.gold, color: PAGE_STYLE.accent, cursor: 'pointer' }}>Enregistrer</button>
      </div>
    </>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  R0: { label: 'Récapitulatif R0', badge: 'R0', badgeBg: '#E6F1FB', badgeColor: '#185FA5', desc: 'Premier contact — situation, clientèle, objectifs, maturité' },
  R1: { label: 'Récapitulatif R1', badge: 'R1', badgeBg: '#EAF3DE', badgeColor: '#3B6D11', desc: 'Présentation Evolve — objections, questions, suite donnée' },
  etape: { label: "Point d'étape", badge: "Étape", badgeBg: '#FAEEDA', badgeColor: '#854F0B', desc: 'Suivi intermédiaire — avancement et blocages' },
}

export default function StructuredNoteModal({ type, profile, onClose, onSave }) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.R0

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: PAGE_STYLE.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        style={{ background: PAGE_STYLE.cardBg, border: `1px solid ${PAGE_STYLE.border}`, borderRadius: 12, width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${PAGE_STYLE.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, background: config.badgeBg, color: config.badgeColor, padding: '2px 9px', borderRadius: 20 }}>
              {config.badge}
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#1A1A1A' }}>{config.label}</div>
              <div style={{ fontSize: 12, color: PAGE_STYLE.textSecondary }}>
                {profile.fn} {profile.ln} · {profile.co}
              </div>
            </div>
          </div>
          <button type="button" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: PAGE_STYLE.textTertiary, lineHeight: 1 }} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
          {type === 'R0' && <R0Form onSave={onSave} onCancel={onClose} />}
          {type === 'R1' && <R1Form onSave={onSave} onCancel={onClose} />}
          {type === 'etape' && <EtapeForm onSave={onSave} onCancel={onClose} />}
        </div>
      </div>
    </div>
  )
}
