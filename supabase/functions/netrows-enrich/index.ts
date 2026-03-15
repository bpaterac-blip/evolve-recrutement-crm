Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  try {
    const { linkedinUrl } = await req.json()

    if (!linkedinUrl) {
      return new Response(
        JSON.stringify({ error: 'linkedinUrl manquant' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    const netrowsKey = Deno.env.get('NETROWS_API_KEY')

    if (!netrowsKey) {
      return new Response(
        JSON.stringify({ error: 'Clé API Netrows manquante' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    const url = String(linkedinUrl).startsWith('http')
      ? linkedinUrl
      : `https://${linkedinUrl}`

    const netrowsResponse = await fetch(
      `https://api.netrows.com/v1/people/profile-by-url?url=${encodeURIComponent(url)}`,
      {
        headers: {
          Authorization: `Bearer ${netrowsKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const data = await netrowsResponse.json()

    const experiences = (data.position || []).map((p: Record<string, unknown>) => ({
      company: p.companyName || '',
      title: p.title || '',
      startYear: p.start?.year ?? null,
      startMonth: p.start?.month ?? null,
      endYear: p.end?.year ?? null,
      endMonth: p.end?.month ?? null,
      isCurrent: !p.end?.year || p.end?.year === 0,
      location: p.location || '',
    }))

    return new Response(
      JSON.stringify({
        success: true,
        experiences,
        headline: data.headline || '',
        summary: data.summary || '',
        city: data.geo?.city || '',
        skills: (data.skills || []).map((s: Record<string, unknown>) => s.name || ''),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
