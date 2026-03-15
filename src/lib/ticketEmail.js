/**
 * Envoie une notification email à la création d'un ticket via EmailJS.
 * .env : VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY
 * Retourne toujours { success, error } pour ne jamais bloquer l'UI.
 */
const TO_EMAIL = 'baptiste.paterac@evolveinvestissement.fr'

export async function sendTicketNotificationEmail(ticket) {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
  console.log('EmailJS config:', { serviceId, templateId, publicKey })
  if (!serviceId || !templateId || !publicKey) {
    console.warn('EmailJS non configuré : VITE_EMAILJS_* manquants', { serviceId: !!serviceId, templateId: !!templateId, publicKey: !!publicKey })
    return { success: false, error: 'EmailJS non configuré (variables d’environnement manquantes)' }
  }
  const templateParams = {
    user_email: ticket.user_email,
    priorite: ticket.priorite,
    titre: ticket.titre,
    description: ticket.description ?? '',
    screenshot_url: ticket.screenshot_url || 'Aucune capture',
    to_email: TO_EMAIL,
    subject: `[Evolve Recruiter] Nouveau ticket - ${ticket.titre}`,
    message: `Email : ${ticket.user_email}\nPriorité : ${ticket.priorite}\n\nDescription :\n${ticket.description || '(aucune)'}\nCapture : ${ticket.screenshot_url || 'Aucune'}`,
    reply_to: ticket.user_email,
  }
  console.log('EmailJS params:', templateParams)
  try {
    const emailjs = (await import('emailjs-com')).default
    emailjs.init(publicKey)
    const result = await emailjs.send(serviceId, templateId, templateParams, publicKey)
    console.log('EmailJS result:', result)
    return { success: true, error: null }
  } catch (error) {
    console.error('EmailJS error:', error)
    const message = error?.text || error?.message || String(error)
    return { success: false, error: message }
  }
}
