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
