import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase Admin (service role) — À utiliser UNIQUEMENT côté serveur.
 * Pour la Console Admin : créer une API route / Netlify function / Vercel route
 * qui appelle inviteUser avec la clé service role.
 */
function getAdminClient() {
  const url = import.meta.env.VITE_SUPABASE_URL || ''
  const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !serviceRoleKey) {
    throw new Error('VITE_SUPABASE_SERVICE_ROLE_KEY manquante. inviteUser() doit être appelée depuis le serveur.')
  }
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

/**
 * Invite un utilisateur par email.
 * Utilise supabase.auth.admin.inviteUserByEmail().
 * ATTENTION : nécessite la clé service role. À appeler depuis une API backend
 * (Console Admin à venir), pas depuis le frontend public.
 */
export async function inviteUser(email, options = {}) {
  const supabaseAdmin = getAdminClient()
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: options.redirectTo || `${window.location.origin}/reset-password`,
    ...options,
  })
  if (error) throw error
  return data
}
