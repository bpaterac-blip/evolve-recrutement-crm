import { getSupabaseAdmin } from './supabaseAdmin'

function getAdminClient() {
  return getSupabaseAdmin()
}

/**
 * Invite un utilisateur par email avec un rôle optionnel.
 */
export async function inviteUser(email, options = {}) {
  const supabaseAdmin = getAdminClient()
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: options.redirectTo || `${window.location.origin}/reset-password`,
    ...options,
  })
  if (error) throw error
  const role = options.role || 'user'
  if (data?.user?.id) {
    await supabaseAdmin.from('user_roles').upsert(
      { user_id: data.user.id, role, status: 'invited' },
      { onConflict: 'user_id' }
    )
  }
  return data
}

/**
 * Liste tous les utilisateurs (pagination).
 */
export async function listUsers(page = 1, perPage = 50) {
  const supabaseAdmin = getAdminClient()
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
  if (error) throw error
  return data
}

/**
 * Liste les utilisateurs avec rôles et statuts.
 */
export async function getUsersWithRoles(page = 1, perPage = 50) {
  const supabaseAdmin = getAdminClient()
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
  if (authErr) throw authErr
  const users = authData?.users ?? []
  const ids = users.map((u) => u.id)
  if (ids.length === 0) return { users: [], roles: {}, statuses: {} }
  const { data: rolesData } = await supabaseAdmin
    .from('user_roles')
    .select('user_id, role, status')
    .in('user_id', ids)
  const roles = {}
  const statuses = {}
  ;(rolesData ?? []).forEach((r) => {
    roles[r.user_id] = r.role
    statuses[r.user_id] = r.status ?? 'active'
  })
  return {
    users,
    roles,
    statuses,
    total: authData?.total ?? users.length,
  }
}

/**
 * Met à jour le rôle d'un utilisateur dans user_roles.
 */
export async function updateUserRole(userId, role) {
  const supabaseAdmin = getAdminClient()
  const { error } = await supabaseAdmin
    .from('user_roles')
    .update({ role })
    .eq('user_id', userId)
  if (error) throw error
}

/**
 * Révoque l'accès en bannissant l'utilisateur.
 */
export async function revokeAccess(userId) {
  const supabaseAdmin = getAdminClient()
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: '876000h', // ~100 ans
  })
  if (error) throw error
}

/**
 * Réactive un utilisateur banni.
 */
export async function unbanUser(userId) {
  const supabaseAdmin = getAdminClient()
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  })
  if (error) throw error
}

/**
 * Met à jour le statut d'un utilisateur dans user_roles (ex: 'suspended', 'active').
 */
export async function setUserStatus(userId, status) {
  const supabaseAdmin = getAdminClient()
  const { error } = await supabaseAdmin
    .from('user_roles')
    .update({ status })
    .eq('user_id', userId)
  if (error) throw error
}

/**
 * Supprime définitivement un utilisateur (auth + user_roles via cascade).
 */
export async function deleteUser(userId) {
  const supabaseAdmin = getAdminClient()
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) throw error
}

