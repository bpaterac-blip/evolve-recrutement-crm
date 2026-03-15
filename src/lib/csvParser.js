import Papa from 'papaparse'

/** Extraction ville/région depuis location (format Waalaxy: "Ville  Région  France") */
function extractCityRegion(location) {
  if (!location || typeof location !== 'string') return { city: '', region: '' }
  const parts = location.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean)
  return { city: parts[0] || '', region: parts[1] || '' }
}

/** Extraction ville/région depuis location (format Lemlist: "Toulouse, Occitanie, France") */
function extractCityRegionLemlist(location) {
  if (!location || typeof location !== 'string') return { city: '', region: '' }
  const parts = location.split(',').map((s) => s.trim()).filter(Boolean)
  return { city: parts[0] || '', region: parts[1] || '' }
}

/** Détecte le format CSV à partir des en-têtes */
function detectFormat(headers) {
  const keys = (headers || []).map((h) => String(h || '').trim())
  if (keys.includes('linkedinUrl') && keys.includes('companyName') && keys.includes('jobTitle')) return 'lemlist'
  if (keys.includes('firstName') && keys.includes('company_name')) return 'waalaxy'
  if (keys.some((k) => k === 'First Name')) return 'sales_navigator'
  return 'generic'
}

/** Mapping Waalaxy → profil CRM */
function mapWaalaxyRow(row) {
  const loc = row.location || ''
  const { city, region } = extractCityRegion(loc)
  const ti = (row.occupation || row.job_title || '').trim() || '—'
  const mail = (row.linkedinEmail || row.proEmail || '').trim() || '—'
  return {
    fn: (row.firstName || '').trim() || '',
    ln: (row.lastName || '').trim() || '',
    ti: ti || '—',
    co: (row.company_name || '').trim() || '—',
    city: city || '—',
    region: region || '',
    li: (row.linkedinUrl || '').trim() || '—',
    mail,
    src: 'Chasse LinkedIn',
  }
}

/** Mapping Lemlist → profil CRM */
function mapLemlistRow(row) {
  const loc = row.location || ''
  const { city, region } = extractCityRegionLemlist(loc)
  const coVal = (row.companyName || '').trim() || '—'
  const tiVal = (row.jobTitle || '').trim() || '—'
  const liVal = (row.linkedinUrl || '').trim() || '—'
  return {
    fn: (row.firstName || '').trim() || '',
    ln: (row.lastName || '').trim() || '',
    mail: (row.email || '').trim() || '—',
    li: liVal,
    linkedinUrl: liVal,
    co: coVal,
    company: coVal,
    ti: tiVal,
    title: tiVal,
    city: city || '—',
    region: region || '',
    src: 'Lemlist',
    sequence_lemlist: (row.campaigns || '').trim() || '',
    lead_status: (row.leadStatus || '').trim() || '',
    lastContactedDate: (row.lastContactedDate || '').trim() || '',
  }
}

/** Mapping Sales Navigator → profil CRM */
const SALES_NAV_MAP = {
  'First Name': 'fn',
  'Last Name': 'ln',
  'Job Title': 'ti',
  'Company Name': 'co',
  'Company': 'co',
  'Location': 'city',
  'City': 'city',
  'Email': 'mail',
  'LinkedIn Profile Url': 'li',
  'LinkedIn Url': 'li',
}

function mapSalesNavigatorRow(row) {
  const out = { fn: '', ln: '', co: '—', ti: '—', city: '—', region: '', mail: '—', li: '—', src: 'Chasse LinkedIn' }
  for (const [col, val] of Object.entries(row)) {
    const k = SALES_NAV_MAP[col?.trim()]
    if (k && val) out[k] = String(val).trim()
  }
  return out
}

/** Mapping générique (fallback) */
const COLUMN_MAP = {
  firstName: 'fn',
  first_name: 'fn',
  lastName: 'ln',
  last_name: 'ln',
  title: 'ti',
  job_title: 'ti',
  occupation: 'ti',
  companyName: 'co',
  company_name: 'co',
  company: 'co',
  location: 'city',
  city: 'city',
  email: 'mail',
  linkedinEmail: 'mail',
  proEmail: 'mail',
  linkedInProfileUrl: 'li',
  linkedinUrl: 'li',
  linkedin_url: 'li',
}

function mapGenericRow(row) {
  const out = { fn: '', ln: '', co: '—', ti: '—', city: '—', region: '', mail: '—', li: '—', src: 'Chasse LinkedIn' }
  for (const [col, val] of Object.entries(row)) {
    const k = COLUMN_MAP[col?.trim()] || col?.toLowerCase?.()?.replace(/\s/g, '_')
    if (out[k] !== undefined && val) out[k] = String(val).trim()
  }
  if (!out.fn && row.firstName) out.fn = (row.firstName || '').trim()
  if (!out.ln && row.lastName) out.ln = (row.lastName || '').trim()
  if (!out.ti && (row.occupation || row.job_title)) out.ti = (row.occupation || row.job_title || '').trim() || '—'
  if (!out.co && (row.companyName || row.company_name)) out.co = (row.companyName || row.company_name || '').trim() || '—'
  if (!out.city && row.location) {
    const { city, region } = extractCityRegion(row.location)
    out.city = city || '—'
    out.region = region || ''
  }
  if (!out.mail && (row.linkedinEmail || row.proEmail)) out.mail = (row.linkedinEmail || row.proEmail || '').trim() || '—'
  if (!out.li && (row.linkedInProfileUrl || row.linkedinUrl)) out.li = (row.linkedInProfileUrl || row.linkedinUrl || '').trim() || '—'
  return out
}

export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length) {
          reject(new Error(results.errors[0]?.message || 'Erreur CSV'))
          return
        }
        const rows = results.data.filter((r) => r && Object.keys(r).length)
        const headers = results.meta?.fields || (rows[0] ? Object.keys(rows[0]) : [])
        const format = detectFormat(headers)

        const mapper =
          format === 'lemlist'
            ? mapLemlistRow
            : format === 'waalaxy'
              ? mapWaalaxyRow
              : format === 'sales_navigator'
                ? mapSalesNavigatorRow
                : mapGenericRow
        const mapped = rows.map((r) => mapper(r))
        resolve(mapped)
      },
      error: (err) => reject(err),
    })
  })
}
