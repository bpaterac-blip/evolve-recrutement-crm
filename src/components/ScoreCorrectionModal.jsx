import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const PRIORITY_OPTS = ['Contact immédiat', 'Prioritaire', 'À travailler', 'À écarter']
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
    if (!reason.trim()) return
    setSaving(true)
    try {
      if (useSupabase) {
        await supabase.from('scoring_feedback').insert({
          profile_id: profile.id,
          previous_score: profile.sc ?? 0,
          new_score: correctedScore,
          feedback_note: reason.trim(),
          reason: reason.trim(),
          priority_label: priorityLabel || null,
          author: userProfile?.full_name?.trim() || user?.email || null,
          consolidated: false,
        })
        await supabase.from('profiles').update({ score: correctedScore }).eq('id', profile.id)
        await supabase.from('activities').insert({
          profile_id: profile.id,
          activity_type: 'score_corrected',
          old_value: String(profile.sc ?? 0),
          new_value: `Score corrigé : ${profile.sc ?? 0} → ${correctedScore} — ${reason.trim().slice(0, 100)}`,
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
        className="w-full max-w-[480px] rounded-[12px] border shadow-xl p-6"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-lg mb-4" style={{ color: '#173731' }}>
          Corriger le scoring de {capFirst(profile?.fn)} {capFirst(profile?.ln)}
        </h2>
        <div className="mb-4 text-[13px] text-[var(--t3)]">
          Score actuel : <span className="font-medium text-[var(--t2)]">{profile?.sc ?? '—'}</span>
        </div>
        <div className="mb-4">
          <label className="block text-[12px] font-medium text-[var(--t3)] mb-1.5">Score que tu aurais donné (0-100)</label>
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
              className="w-14 py-1.5 px-2 rounded border text-center text-[13px]"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-[12px] font-medium text-[var(--t3)] mb-1.5">Niveau de priorité réel</label>
          <select
            value={priorityLabel}
            onChange={(e) => setPriorityLabel(e.target.value)}
            className="w-full py-2 px-3 rounded-lg border text-[13px]"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
          >
            <option value="">—</option>
            {PRIORITY_OPTS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-[12px] font-medium text-[var(--t3)] mb-1.5">Pourquoi ce score est inexact ? *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Décris la raison de la correction…"
            rows={4}
            required
            className="w-full py-2 px-3 rounded-lg border text-[13px] resize-y"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
          />
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
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
            disabled={saving || !reason.trim()}
            className="py-2 px-4 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: '#D2AB76' }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer la correction'}
          </button>
        </div>
      </div>
    </div>
  )
}
