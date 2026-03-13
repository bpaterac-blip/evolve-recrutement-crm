import Papa from 'papaparse'

const COLUMN_MAP = {
  firstName: 'fn',
  first_name: 'fn',
  lastName: 'ln',
  last_name: 'ln',
  title: 'ti',
  companyName: 'co',
  company: 'co',
  location: 'city',
  city: 'city',
  email: 'mail',
  linkedInProfileUrl: 'li',
  linkedin_url: 'li',
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
        const rows = results.data
          .filter((r) => r && Object.keys(r).length)
          .map((r) => mapCSVRow(r))
        resolve(rows)
      },
      error: (err) => reject(err),
    })
  })
}

function mapCSVRow(row) {
  const out = { fn: '', ln: '', co: '—', ti: '—', city: '—', mail: '—', li: '—', src: 'Chasse LinkedIn' }
  for (const [col, val] of Object.entries(row)) {
    const k = COLUMN_MAP[col?.trim()] || col?.toLowerCase?.()?.replace(/\s/g, '_')
    if (out[k] !== undefined && val) out[k] = String(val).trim()
  }
  if (!out.fn && row.firstName) out.fn = row.firstName
  if (!out.ln && row.lastName) out.ln = row.lastName
  if (!out.co && row.companyName) out.co = row.companyName
  if (!out.ti && row.title) out.ti = row.title
  if (!out.city && row.location) out.city = row.location
  if (!out.li && row.linkedInProfileUrl) out.li = row.linkedInProfileUrl
  return out
}
