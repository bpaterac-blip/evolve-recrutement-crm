import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { IconPencil } from './Icons'

const MAX_SCORE = 110

const ASPECTS_PERSONNELS = [
  { key: 'premiere_impression', label: 'Première impression' },
  { key: 'presentation_orale', label: 'Présentation orale' },
  { key: 'adequation_valeurs', label: "Adéquation avec les valeurs d'Evolve" },
  { key: 'dynamisme_commercial', label: 'Compétences et dynamisme commercial' },
  { key: 'degre_motivation', label: 'Degré de motivation' },
]

const ASPECTS_PROFESSIONNELS = [
  { key: 'annees_experience', label: "Années d'expérience" },
  { key: 'competences_techniques', label: 'Compétences techniques' },
  { key: 'vision_ambition', label: 'Vision et ambition' },
  { key: 'relation_independant', label: "Relation avec le statut d'indépendant" },
  { key: 'investissement_infos', label: 'Investissement pour obtenir des infos' },
  { key: 'tresorerie_avance', label: "Trésorerie d'avance pour se lancer" },
]

function getCaseStyle(n, currentValue) {
  const isSelected = currentValue === n
  if (n >= 0 && n <= 3) {
    return {
      background: isSelected ? '#ef4444' : '#fef2f2',
      color: isSelected ? '#fff' : '#fca5a5',
      borderColor: isSelected ? '#ef4444' : '#fecaca',
    }
  }
  if (n >= 4 && n <= 6) {
    return {
      background: isSelected ? '#f59e0b' : '#fefce8',
      color: isSelected ? '#fff' : '#fcd34d',
      borderColor: isSelected ? '#f59e0b' : '#fde68a',
    }
  }
  if (n >= 7 && n <= 9) {
    return {
      background: isSelected ? '#16a34a' : '#f0fdf4',
      color: isSelected ? '#fff' : '#86efac',
      borderColor: isSelected ? '#16a34a' : '#bbf7d0',
    }
  }
  // n === 10
  return {
    background: isSelected ? '#173731' : '#f0fdf4',
    color: isSelected ? '#D2AB76' : '#86efac',
    borderColor: isSelected ? '#173731' : '#bbf7d0',
  }
}

export default function GrilleNotationTab({ profile, updateProfile, useSupabase }) {
  const [commentModalOpen, setCommentModalOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState(profile?.grille_commentaires ?? '')
  const [saving, setSaving] = useState(false)
  const [moyenneTotale, setMoyenneTotale] = useState(null)

  const notation = profile?.grille_notation ?? {}
  const commentaires = profile?.grille_commentaires ?? ''

  const total = Object.values(notation)
    .filter((v) => v !== null && v !== undefined)
    .reduce((sum, v) => sum + Number(v), 0)

  useEffect(() => {
    if (!useSupabase) return
    const fetchMoyenne = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('grille_notation')
        .not('grille_notation', 'is', null)
      const profilesWithGrille = (data || []).filter(
        (p) => Object.keys(p.grille_notation || {}).length > 0
      )
      const scores = profilesWithGrille.map((p) =>
        Object.values(p.grille_notation || {})
          .filter((v) => v !== null)
          .reduce((a, b) => a + Number(b), 0)
      )
      if (scores.length > 0) {
        const moyenne = scores.reduce((sum, s) => sum + s, 0) / scores.length
        setMoyenneTotale(Math.round(moyenne * 10) / 10)
      } else {
        setMoyenneTotale(null)
      }
    }
    fetchMoyenne()
  }, [useSupabase, profile?.id])

  const handleScoreClick = async (critere, valeur) => {
    if (!profile?.id || !useSupabase) return
    const next = { ...notation, [critere]: valeur }
    updateProfile(profile.id, { grille_notation: next })
    await supabase.from('profiles').update({ grille_notation: next }).eq('id', profile.id)
  }

  const handleSaveComment = async () => {
    if (!profile?.id || !useSupabase) return
    setSaving(true)
    await supabase.from('profiles').update({ grille_commentaires: commentDraft }).eq('id', profile.id)
    updateProfile(profile.id, { grille_commentaires: commentDraft })
    setSaving(false)
    setCommentModalOpen(false)
  }

  const openCommentModal = () => {
    setCommentDraft(commentaires)
    setCommentModalOpen(true)
  }

  const diff = moyenneTotale != null ? total - moyenneTotale : null
  const badgeConfig =
    diff === null
      ? null
      : diff > 0
        ? { text: `+${Math.round(diff * 10) / 10} pts · Au-dessus de la moyenne`, color: '#15803d', bg: '#dcfce7' }
        : diff < 0
          ? { text: `${Math.round(diff * 10) / 10} pts · En dessous de la moyenne`, color: '#dc2626', bg: '#fef2f2' }
          : { text: 'Dans la moyenne', color: '#a16207', bg: '#fefce8' }

  const SectionTitle = ({ children }) => (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: '#bbb',
        paddingBottom: 8,
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  )

  const ScoreGrid = ({ critere, label }) => {
    const value = notation[critere]
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0',
          borderBottom: '1px solid rgba(0,0,0,0.04)',
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: '#555',
            width: 200,
            flexShrink: 0,
          }}
        >
          {label}
        </span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
            const style = getCaseStyle(n, value, value === n)
            return (
              <button
                key={n}
                type="button"
                onClick={() => handleScoreClick(critere, n)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: `1.5px solid ${style.borderColor}`,
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 600,
                  background: style.background,
                  color: style.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.1s',
                }}
              >
                {n}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', paddingLeft: 24 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: '#173731', borderRadius: 1 }} />

      {/* Header Score Total + Comparaison moyenne */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#173731' }}>
          {total} / {MAX_SCORE}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {moyenneTotale != null && (
            <>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>
                Moyenne des profils notés : {moyenneTotale}
              </div>
              {badgeConfig && (
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 20,
                    color: badgeConfig.color,
                    background: badgeConfig.bg,
                  }}
                >
                  {badgeConfig.text}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <SectionTitle>Aspects personnels</SectionTitle>
      {ASPECTS_PERSONNELS.map(({ key, label }) => (
        <ScoreGrid key={key} critere={key} label={label} />
      ))}

      <SectionTitle>Aspects professionnels</SectionTitle>
      {ASPECTS_PROFESSIONNELS.map(({ key, label }) => (
        <ScoreGrid key={key} critere={key} label={label} />
      ))}

      {/* Zone commentaires */}
      <div
        onClick={openCommentModal}
        style={{
          background: '#f9f7f4',
          borderRadius: 10,
          border: '1.5px dashed rgba(0,0,0,0.1)',
          padding: 14,
          marginTop: 16,
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        {commentaires ? (
          <>
            <div
              style={{
                fontSize: 12,
                color: '#555',
                whiteSpace: 'pre-wrap',
                maxHeight: 60,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                paddingRight: 28,
              }}
            >
              {commentaires}
            </div>
            <span
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D2AB76',
              }}
            >
              <IconPencil />
            </span>
          </>
        ) : (
          <>
            <div style={{ color: '#D2AB76', fontSize: 12, fontWeight: 600 }}>
              + Ajouter des commentaires
            </div>
            <div style={{ color: '#bbb', fontSize: 11, marginTop: 4 }}>
              Observations, points forts, points de vigilance…
            </div>
          </>
        )}
      </div>

      {commentModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setCommentModalOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 560,
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: '#173731', marginBottom: 16 }}>
              Commentaires et notes complémentaires
            </div>
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Observations, points forts, points de vigilance..."
              style={{
                width: '100%',
                minHeight: 300,
                padding: 12,
                borderRadius: 8,
                border: '1px solid #E5E0D8',
                fontSize: 13,
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setCommentModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: '#E5E0D8',
                  color: '#6B6B6B',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handleSaveComment}
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: '#D2AB76',
                  color: '#173731',
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
