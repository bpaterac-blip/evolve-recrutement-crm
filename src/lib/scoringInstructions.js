/**
 * Instructions permanentes pour le scoring CGP
 * Injectées dans tous les appels Claude liés au scoring
 */

import { supabase } from './supabase'

const STORAGE_KEY = 'scoring_feedback_updated'

/** Charge toutes les instructions (lignes séparées), concaténées pour le prompt IA */
export async function fetchScoringInstructions() {
  const { data } = await supabase
    .from('scoring_instructions')
    .select('content')
    .order('updated_at', { ascending: false })
  const parts = (data || []).map((r) => (r.content || '').trim()).filter(Boolean)
  const instructions = parts.join('\n\n')
  if (instructions) {
    console.log('Instructions scoring chargées:', instructions.substring(0, 100) + '...')
  }
  return instructions
}

/** Agrégat de toutes les lignes + date de la ligne la plus récente */
export async function fetchScoringInstructionsWithMeta() {
  const { data } = await supabase
    .from('scoring_instructions')
    .select('content, updated_at')
    .order('updated_at', { ascending: false })
  const rows = data || []
  const parts = rows.map((r) => (r.content || '').trim()).filter(Boolean)
  const content = parts.join('\n\n')
  const updated_at = rows[0]?.updated_at
  return { content, updated_at }
}

/** Sauvegarde les instructions (update la première ligne, sinon insert) */
export async function saveScoringInstructions(content) {
  const { data: existing } = await supabase
    .from('scoring_instructions')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const { data } = await supabase
      .from('scoring_instructions')
      .update({
        content: content || '',
        updated_at: new Date().toISOString(),
        updated_by: 'Baptiste',
      })
      .eq('id', existing.id)
      .select('updated_at')
      .single()
    return data?.updated_at
  } else {
    const { data } = await supabase
      .from('scoring_instructions')
      .insert({
        content: content || '',
        updated_by: 'Baptiste',
      })
      .select('updated_at')
      .single()
    return data?.updated_at
  }
}

/** Signale qu'une correction a été enregistrée (pour recharger AdminScoringLearning) */
export function notifyScoringFeedbackUpdated() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch (_) {}
}

/** Écoute les mises à jour de scoring_feedback (cross-tab) */
export function onScoringFeedbackUpdated(callback) {
  const handler = (e) => {
    if (e.key === STORAGE_KEY && e.newValue) callback()
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}

/** Vérifie si une mise à jour a eu lieu (même onglet) et réinitialise */
export function checkAndClearScoringFeedbackUpdated() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v) {
      localStorage.removeItem(STORAGE_KEY)
      return true
    }
  } catch (_) {}
  return false
}
