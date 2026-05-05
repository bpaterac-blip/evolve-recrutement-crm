import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const PRIORITY_OPTS = [
  { label: 'Contact immédiat', color: '#065F46', bg: '#D1FAE5', border: '#34D399' },
  { label: 'Prioritaire', color: '#15803d', bg: '#dcfce7', border: '#86efac' },
  { label: 'À travailler', color: '#a16207', bg: '#fefce8', border: '#fde68a' },
  { label: 'À écarter', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
]

const SUGGESTIONS = [
  'A déjà travaillé en cabinet CGP',
  'Employeur non reconnu dans les listes',
  'Titre de poste mal interprété',
  'Ancienneté incorrecte',
  'Profil hors cible',
]

export default function ScoreCorrectionModal({ profile, onClose, onSaved, useSupabase }) {
  const { user, userProfile } = useAuth()
  const [correctedScore, setCorrectedScore] = useState(profile?.sc ?? 0)
  const [priorityLabel, setPriorityLabel] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const capFirst = (str) => (str && typeof str === 'string' ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '')

  const addSuggestion = (s) => {
    setReason((prev) => (prev ? `${prev}\n${s}` : s))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (useSupabase) {
        const finalReason = reason.trim() || 'Correction manuelle'
        await supabase.from('scoring_feedback').insert({
          profile_id: profile.id,
          previous_score: profile.sc ?? 0,
          new_score: correctedScore,
          feedback_note: finalReason,
          reason: finalReason,
          priority_label: priorityLabel || null,
          author: userProfile?.full_name?.trim() || user?.email || null,
          consolidated: false,
        })
        await supabase.from('profiles').update({ score: correctedScore }).eq('id', profile.id)
        await supabase.from('activities').insert({
          profile_id: profile.id,
          activity_type: 'score_corrected',
          old_value: String(profile.sc ?? 0),
          new_value: `Score corrigé : ${profile.sc ?? 0} → ${correctedScore} — ${finalReason.slice(0, 100)}`,
        })
      }
      onSaved?.({ correctedScore, reason: reason.trim(), priorityLabel })
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50" onClick={() => !saving && onClose()}>
      <div
        className="w-full max-w-[500px] rounded-[14px] border shadow-xl p-6"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-lg mb-1" style={{ color: '#173731' }}>
          Corriger le scoring
        </h2>
        <p className="text-[13px] mb-5" style={{ color: '#6B7280' }}>
          {capFirst(profile?.fn)} {capFirst(profile?.ln)} · Score actuel : <strong style={{ color: '#173731' }}>{profile?.sc ?? '—'}/100</strong>
        </p>

        {/* Score slider */}
        <div className="mb-5">
          <label className="block text-[12px] font-semibold mb-2" style={{ color: '#374151' }}>
            Score corrigé (0–100)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={correctedScore}
              onChange={(e) => setCorrectedScore(Number(e.target.value))}
              className="flex-1"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={correctedScore}
              onChange={(e) => setCorrectedScore(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className="w-14 py-1.5 px-2 rounded-lg border text-center text-[13px] font-semibold"
              style={{ borderColor: 'var(--border)', color: '#173731' }}
            />
          </div>
        </div>

        {/* Visual category buttons */}
        <div className="mb-5">
          <label className="block text-[12px] font-semibold mb-2" style={{ color: '#374151' }}>
            Catégorie réelle
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PRIORITY_OPTS.map((opt) => {
              const isSelected = priorityLabel === opt.label
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setPriorityLabel(isSelected ? '' : opt.label)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `2px solid ${isSelected ? opt.border : '#E5E7EB'}`,
                    background: isSelected ? opt.bg : 'white',
                    color: isSelected ? opt.color : '#6B7280',
                    fontSize: 13,
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: isSelected ? opt.color : '#D1D5DB',
                      flexShrink: 0,
                    }}
                  />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Reason textarea */}
        <div className="mb-3">
          <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#374151' }}>
            Raison de la correction <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optionnelle)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex : Banque Courtois non reconnue, mais c'est bien une banque…"
            rows={3}
            className="w-full py-2 px-3 rounded-lg border text-[13px] resize-y"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
          />
        </div>

        {/* Suggestion chips */}
        <div className="mb-5 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addSuggestion(s)}
              className="py-1 px-2.5 rounded text-[11px] border cursor-pointer hover:bg-[#FFF7ED]"
              style={{ borderColor: '#F97316', color: '#F97316' }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="py-2 px-4 rounded-lg text-[13px] font-medium border cursor-pointer"
            style={{ borderColor: 'var(--border)', color: 'var(--t2)' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="py-2 px-4 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: '#173731' }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
