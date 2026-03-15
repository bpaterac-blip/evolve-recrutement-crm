import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase Admin (service role).
 * Utilise VITE_SUPABASE_SERVICE_KEY ou VITE_SUPABASE_SERVICE_ROLE_KEY.
 */
export function getSupabaseAdmin() {
  const url = import.meta.env.VITE_SUPABASE_URL || ''
  const serviceKey =
    import.meta.env.VITE_SUPABASE_SERVICE_KEY ||
    import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  if (!url || !serviceKey) {
    throw new Error('VITE_SUPABASE_SERVICE_KEY (ou VITE_SUPABASE_SERVICE_ROLE_KEY) manquante.')
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
