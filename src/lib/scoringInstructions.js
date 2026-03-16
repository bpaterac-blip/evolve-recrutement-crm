/**
 * Instructions permanentes pour le scoring CGP
 * Injectées dans tous les appels Claude liés au scoring
 */

import { supabase } from './supabase'

const STORAGE_KEY = 'scoring_feedback_updated'

/** Charge les instructions depuis Supabase (première ligne par updated_at desc) */
export async function fetchScoringInstructions() {
  const { data } = await supabase
    .from('scoring_instructions')
    .select('content')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const instructions = (data?.content || '').trim()
  if (instructions) {
    console.log('Instructions scoring chargées:', instructions.substring(0, 100) + '...')
  }
  return instructions
}

/** Charge les instructions avec métadonnées (content, updated_at) */
export async function fetchScoringInstructionsWithMeta() {
  const { data } = await supabase
    .from('scoring_instructions')
    .select('content, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const content = (data?.content || '').trim()
  if (content) {
    console.log('Instructions scoring chargées:', content.substring(0, 100) + '...')
  }
  return { content, updated_at: data?.updated_at }
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
