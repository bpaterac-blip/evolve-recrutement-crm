import { supabase } from './supabase'

/**
 * Détecte un doublon en base selon LinkedIn URL, email, ou prénom+nom+employeur.
 * @param {Object} profil - Profil à vérifier (fn/ln/co/li/mail ou firstName/lastName/companyName/linkedInProfileUrl/email)
 * @returns {Promise<Object|null>} Profil existant ou null
 */
export async function detectDoublon(profil) {
  const li = (profil.linkedInProfileUrl || profil.li || profil.linkedinUrl || '').trim()
  const email = (profil.email || profil.mail || '').trim()
  const fn = (profil.firstName || profil.fn || '').trim()
  const ln = (profil.lastName || profil.ln || '').trim()
  const co = (profil.companyName || profil.co || profil.company || '').trim()

  const conditions = []

  if (li && (li.startsWith('http') || li.includes('linkedin.com'))) {
    conditions.push(
      supabase.from('profiles')
        .select('id, first_name, last_name, company, stage, linkedin_url')
        .eq('linkedin_url', li)
        .maybeSingle()
    )
  }

  if (email && email.includes('@')) {
    conditions.push(
      supabase.from('profiles')
        .select('id, first_name, last_name, company, stage, email')
        .eq('email', email)
        .maybeSingle()
    )
  }

  if (fn && ln && co) {
    conditions.push(
      supabase.from('profiles')
        .select('id, first_name, last_name, company, stage')
        .ilike('first_name', fn)
        .ilike('last_name', ln)
        .ilike('company', co)
        .maybeSingle()
    )
  }

  for (const query of conditions) {
    const { data } = await query
    if (data) return data
  }

  return null
}
