/**
 * Enrichissement Netrows via Supabase Edge Function (évite CORS)
 */

import { supabase } from './supabase'

export async function enrichProfileWithNetrows(linkedinUrl) {
  if (!linkedinUrl) throw new Error('URL LinkedIn manquante')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  // Récupérer le token de session actuel
  const { data: { session } } = await supabase.auth.getSession()
  const authToken = session?.access_token || supabaseKey

  const response = await fetch(
    `${supabaseUrl}/functions/v1/netrows-enrich`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ linkedinUrl }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Erreur Edge Function: ${response.status} - ${err}`)
  }

  const data = await response.json()
  if (!data.success) throw new Error(data.error || 'Erreur Netrows')

  return data
}
