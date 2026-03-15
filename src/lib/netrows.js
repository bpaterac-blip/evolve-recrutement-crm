/**
 * API Netrows pour enrichir les profils avec les expériences LinkedIn
 */

export async function enrichProfileWithNetrows(linkedinUrl) {
  const apiKey = import.meta.env.VITE_NETROWS_API_KEY
  if (!apiKey) throw new Error('Clé API Netrows manquante')
  if (!linkedinUrl) throw new Error('URL LinkedIn manquante')

  const url = linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`
  const response = await fetch(
    `https://api.netrows.com/linkedin/profile?url=${encodeURIComponent(url)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) throw new Error(`Netrows erreur: ${response.status}`)

  const data = await response.json()

  const experiences = (data.position || []).map((p) => ({
    company: p.companyName || '',
    title: p.title || '',
    startYear: p.start?.year || null,
    startMonth: p.start?.month || null,
    endYear: p.end?.year || null,
    endMonth: p.end?.month || null,
    isCurrent: !p.end?.year || p.end?.year === 0,
    location: p.location || '',
    description: p.description || '',
  }))

  return {
    experiences,
    headline: data.headline || '',
    summary: data.summary || '',
    city: data.geo?.city || '',
    skills: (data.skills || []).map((s) => s.name),
    educations: (data.educations || []).map((e) => ({
      school: e.schoolName,
      degree: e.degree,
      field: e.fieldOfStudy,
      startYear: e.start?.year,
      endYear: e.end?.year,
    })),
  }
}
