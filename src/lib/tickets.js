import { supabase } from './supabase'

const SCREENSHOTS_BUCKET = 'tickets-screenshots'

/**
 * Récupère les tickets de l'utilisateur connecté.
 */
export async function getMyTickets() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * Upload une capture d'écran dans le bucket tickets-screenshots et retourne l'URL publique.
 */
export async function uploadTicketScreenshot(file) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${user.id}/${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from(SCREENSHOTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) throw uploadError
  const { data: urlData } = supabase.storage.from(SCREENSHOTS_BUCKET).getPublicUrl(path)
  return urlData.publicUrl
}

/**
 * Crée un ticket (user_id et user_email remplis côté client).
 */
export async function createTicket({ titre, description, priorite, screenshot_url }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const payload = {
    user_id: user.id,
    user_email: user.email ?? '',
    titre: titre?.trim() || 'Sans titre',
    description: description?.trim() ?? '',
    priorite: priorite || 'Normale',
    statut: 'Ouvert',
  }
  if (screenshot_url) payload.screenshot_url = screenshot_url
  const { data, error } = await supabase
    .from('tickets')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Compte les notifications "ticket résolu" et "ticket_reponse" non lues (badge section Outils).
 */
export async function getUnreadTicketResoluCount() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('type', ['ticket_resolu', 'ticket_reponse'])
    .eq('read', false)
  if (error) return 0
  return count ?? 0
}

/**
 * Compte les notifications "nouveau ticket" et "ticket_reponse_user" non lues (badge section Admin).
 */
export async function getUnreadNouveauTicketCount() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .in('type', ['nouveau_ticket', 'ticket_reponse_user'])
    .eq('read', false)
  if (error) return 0
  return data?.length || 0
}

/**
 * Marque les notifications "ticket résolu" et "ticket_reponse" comme lues.
 */
export async function markTicketResoluAsRead() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .in('type', ['ticket_resolu', 'ticket_reponse'])
}

/**
 * Marque les notifications "nouveau ticket" et "ticket_reponse_user" comme lues.
 */
export async function markNouveauTicketAsRead() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .in('type', ['nouveau_ticket', 'ticket_reponse_user'])
}

/**
 * Supprime un ticket et ses notifications associées (admin uniquement, via RLS).
 * Ordre obligatoire : 1) notifications, 2) ticket (FK contrainte).
 */
export async function deleteTicketForAdmin(ticketId) {
  const { error: notifErr } = await supabase
    .from('notifications')
    .delete()
    .eq('ticket_id', ticketId)
  if (notifErr) throw notifErr
  const { error } = await supabase
    .from('tickets')
    .delete()
    .eq('id', ticketId)
  if (error) throw error
}

/**
 * Liste tous les tickets (admin uniquement, via RLS).
 */
export async function listAllTicketsForAdmin() {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * Met à jour le statut d'un ticket (admin uniquement, via RLS).
 */
export async function updateTicketStatusForAdmin(ticketId, statut) {
  const { error } = await supabase
    .from('tickets')
    .update({ statut, updated_at: new Date().toISOString() })
    .eq('id', ticketId)
  if (error) throw error
}

/**
 * Met à jour le statut et la réponse admin d'un ticket (admin uniquement, via RLS).
 */
export async function updateTicketForAdmin(ticketId, { statut, admin_response }) {
  const payload = { updated_at: new Date().toISOString() }
  if (statut != null) payload.statut = statut
  if (admin_response !== undefined) payload.admin_response = admin_response || null
  const { error } = await supabase
    .from('tickets')
    .update(payload)
    .eq('id', ticketId)
  if (error) throw error
}

/**
 * Insère une notification pour le créateur du ticket quand il est résolu (admin uniquement, via RLS).
 */
export async function insertTicketResolvedNotificationForAdmin(ticket) {
  if (!ticket?.user_id) return
  await supabase.from('notifications').insert({
    user_id: ticket.user_id,
    message: `Votre ticket "${ticket.titre || ticket.title || 'Sans titre'}" a été résolu.`,
    ticket_id: ticket.id,
    type: 'ticket_resolu',
  })
}

/**
 * Insère une notification "réponse admin" pour le créateur du ticket (admin uniquement, via RLS).
 */
export async function insertTicketReponseNotificationForAdmin(ticket) {
  if (!ticket?.user_id) return
  await supabase.from('notifications').insert({
    user_id: ticket.user_id,
    message: `Réponse à votre ticket "${ticket.titre || ticket.title || 'Sans titre'}"`,
    ticket_id: ticket.id,
    type: 'ticket_reponse',
  })
}

/**
 * Met à jour la réponse user sur un ticket (user uniquement, via RLS).
 * Remet le statut à "En cours" si il était "Résolu".
 */
export async function updateTicketWithUserResponse(ticketId, userResponse) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const { data: ticket } = await supabase.from('tickets').select('statut').eq('id', ticketId).eq('user_id', user.id).single()
  if (!ticket) throw new Error('Ticket non trouvé')
  const payload = {
    user_response: userResponse?.trim() || null,
    user_response_date: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (ticket.statut === 'Résolu') payload.statut = 'En cours'
  const { error } = await supabase.from('tickets').update(payload).eq('id', ticketId).eq('user_id', user.id)
  if (error) throw error
}

/**
 * Notifie tous les admins qu'un user a répondu sur un ticket.
 */
export async function notifyAdminsOnUserResponse(ticket, currentUserEmail) {
  const { data: admins } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin')
  if (!admins?.length) return
  const title = ticket?.titre || ticket?.title || 'Sans titre'
  const message = `Réponse de ${currentUserEmail || 'utilisateur'} sur le ticket "${title}"`
  for (const admin of admins) {
    await supabase.from('notifications').insert({
      user_id: admin.user_id,
      message,
      ticket_id: ticket?.id,
      type: 'ticket_reponse_user',
    })
  }
}

/**
 * Notifie tous les admins qu'un nouveau ticket a été créé.
 */
export async function notifyAdminsOnNewTicket(ticket, createdByEmail) {
  const { data: admins } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin')
  if (!admins?.length) return
  const title = ticket?.titre || ticket?.title || 'Sans titre'
  const message = `Nouveau ticket : "${title}" de ${createdByEmail || 'utilisateur'}`
  for (const admin of admins) {
    await supabase.from('notifications').insert({
      user_id: admin.user_id,
      message,
      ticket_id: ticket?.id,
      type: 'nouveau_ticket',
    })
  }
}
