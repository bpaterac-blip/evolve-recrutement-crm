import { supabase } from './supabase'

let _config = null

const DEFAULT_CONFIG = {
  weight_employer: 50,
  weight_title: 30,
  weight_seniority: 20,
  bonus_cgp_experience: 20,
  threshold_priority: 70,
  threshold_towork: 50,
}

export async function loadScoringConfig() {
  try {
    const { data } = await supabase.from('scoring_config').select('*').limit(1).single()
    _config = data || DEFAULT_CONFIG
    return _config
  } catch {
    _config = DEFAULT_CONFIG
    return _config
  }
}

export function getScoringConfig() {
  return _config || DEFAULT_CONFIG
}

export function setScoringConfig(c) {
  _config = c
}
