import * as pdfjsLib from 'pdfjs-dist'

import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

/**
 * Extrait le texte d'un PDF en préservant la structure par lignes.
 * Groupement par position Y pour détecter les retours à la ligne.
 */
export async function extractTextFromPDF(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument(buffer).promise
  const lines = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    const items = content.items.map((item) => {
      const tx = item.transform
      const y = tx[5]
      const x = tx[4]
      return { str: item.str, x, y, w: item.width, h: item.height }
    })

    items.sort((a, b) => (b.y - a.y) || (a.x - b.x))

    let lastY = null
    let currentLine = []

    for (const it of items) {
      const yRounded = Math.round(it.y)
      if (lastY !== null && Math.abs(yRounded - lastY) > 3) {
        if (currentLine.length) {
          currentLine.sort((a, b) => a.x - b.x)
          lines.push(currentLine.map((x) => x.str).join(' ').trim())
          currentLine = []
        }
      }
      lastY = yRounded
      currentLine.push(it)
    }
    if (currentLine.length) {
      currentLine.sort((a, b) => a.x - b.x)
      lines.push(currentLine.map((x) => x.str).join(' ').trim())
    }
  }

  return lines.join('\n')
}

// Mois FR/EN pour détection des dates
const FRENCH_MONTHS = /janv\.?|févr\.?|mars|avr\.?|mai|juin|juil\.?|août|sept\.?|oct\.?|nov\.?|déc\.?|janvier|février|avril|juillet|septembre|octobre|novembre|décembre|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i
// Durée : (X ans Y mois) ou (X mois)
const DURATION_RE = /\((\d+\s*ans?\s*(\d+\s*mois?)?|\d+\s*mois?)\)/i
const FRENCH_REGION = /(Paris|Lyon|Marseille|Toulouse|Bordeaux|Nantes|Nice|Montpellier|France|Île-de-France|Rhône|Occitanie|PACA|Provence|Hauts-de-France)/i

function parseDuration(str) {
  if (!str) return ''
  const m = String(str).match(DURATION_RE)
  return m ? m[1].trim() : ''
}

/**
 * Parse le texte PDF LinkedIn selon la structure standard.
 * STRUCTURE: Nom (après Languages ou avant titre) → Titre court → Ville → Résumé → Expérience → Formation
 */
export function parseLinkedInPDFText(text) {
  const lines = text.split(/\n/).map((s) => s.trim()).filter(Boolean)
  let fn = ''
  let ln = ''
  let shortTitle = ''
  let city = ''
  let summary = ''
  let li = ''
  const experiences = []
  let formation = ''

  const linkedinMatch = text.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/i)
  if (linkedinMatch) li = `https://linkedin.com/in/${linkedinMatch[1]}`

  const langIdx = lines.findIndex((l) => /^langues?$/i.test(l) || /^languages?$/i.test(l))
  const expIdx = lines.findIndex((l) => /^expérience$/i.test(l) || /^experience$/i.test(l))
  const formIdx = lines.findIndex((l) => /^formation$/i.test(l) || /^education$/i.test(l))
  const resIdx = lines.findIndex((l) => /^résumé$/i.test(l) || /^summary$/i.test(l))

  // 1. NOM : ligne après "Languages" OU première ligne avant titre (prénom + nom)
  if (langIdx >= 0 && lines[langIdx + 1]) {
    const nameLine = lines[langIdx + 1]
    const parts = nameLine.split(/\s+/).filter(Boolean)
    if (parts.length >= 2 && /^[A-Za-zÀ-ÿ\-']+$/.test(parts[0])) {
      fn = parts[0]
      ln = parts.slice(1).join(' ')
    } else if (parts.length === 1) {
      fn = parts[0]
    }
  }

  // 2. TITRE COURT : ligne sous le nom (ex: "Cadre bancaire")
  // 3. VILLE : ligne suivante avec région France
  const searchStart = langIdx >= 0 ? langIdx + 2 : 0
  const searchEnd = Math.min(expIdx >= 0 ? expIdx : resIdx >= 0 ? resIdx : lines.length, searchStart + 15)

  for (let i = searchStart; i < searchEnd; i++) {
    const line = lines[i]
    if (!line || line.length > 100) continue
    if (/^(expérience|formation|langues|résumé|summary|contact)/i.test(line)) break

    if (!fn && line.length > 2 && line.length < 60) {
      const parts = line.split(/\s+/).filter(Boolean)
      if (parts.length >= 2 && /^[A-Za-zÀ-ÿ\-']+$/.test(parts[0])) {
        fn = parts[0]
        ln = parts.slice(1).join(' ')
        continue
      }
      if (parts.length === 1 && /^[A-Za-zÀ-ÿ\-']+$/.test(line)) fn = line
      continue
    }

    if (fn && !shortTitle && line.length > 2 && line.length < 100 && !FRENCH_REGION.test(line)) {
      shortTitle = line
      continue
    }

    if ((fn || shortTitle) && !city && FRENCH_REGION.test(line) && line.length < 70) {
      city = line
    }
  }

  if (!fn && lines[0]) {
    const parts = lines[0].split(/\s+/).filter(Boolean)
    fn = parts[0] || 'Inconnu'
    ln = parts.slice(1).join(' ') || ''
  }

  // 4. RÉSUMÉ : section après "Résumé"
  if (resIdx >= 0) {
    const end = expIdx >= 0 ? expIdx : formIdx >= 0 ? formIdx : lines.length
    summary = lines
      .slice(resIdx + 1, end)
      .filter((l) => !/^(expérience|formation|langues|compétences)/i.test(l))
      .join(' ')
  }

  // 5. EXPÉRIENCES : section "Expérience" — entreprise (ligne seule) → poste → dates (mois année - mois année (X ans X mois)) → ville optionnelle
  if (expIdx >= 0) {
    const expLines = lines.slice(expIdx + 1)
    const endForm = formIdx >= 0 ? formIdx - expIdx - 1 : expLines.length
    const block = expLines.slice(0, Math.max(0, endForm))

    let i = 0
    while (i < block.length) {
      const line = block[i]
      if (!line || line.length < 2) { i++; continue }

      const isSectionHeader = /^(formation|langues|compétences|intérêts)/i.test(line)
      if (isSectionHeader) break

      const isDateLine = FRENCH_MONTHS.test(line) || /^\d{4}\s*[-–—]\s*\d{4}/.test(line)
      const isDurationOnly = /^\(\d+\s*(ans?|mois?)/i.test(line.trim())
      const looksLikeCompany = line.length >= 2 && line.length <= 90 && !isDateLine && !isDurationOnly

      const nextLine = block[i + 1]
      if (looksLikeCompany && nextLine && !/^(formation|langues|compétences)/i.test(nextLine)) {
        const company = line.trim()
        const title = nextLine.trim()
        let duration = ''
        let cityOpt = ''
        let skip = 2

        for (let j = i + 2; j < Math.min(i + 7, block.length); j++) {
          const bline = block[j]
          if (/^(formation|langues|compétences|expérience)/i.test(bline)) break

          const d = parseDuration(bline)
          if (d) {
            duration = d
            skip = Math.max(skip, j - i + 1)
          }
          if (FRENCH_REGION.test(bline) && bline.length < 60) cityOpt = bline.trim()
        }

        experiences.push({
          company,
          title,
          duration: duration || '',
          city: cityOpt || '',
        })

        i += skip
        continue
      }
      i++
    }
  }

  // 6. FORMATION : section "Formation" — diplôme + école + dates
  if (formIdx >= 0) {
    const formEnd = lines.findIndex((l, idx) => idx > formIdx && /^(langues|compétences|expérience|intérêts)/i.test(l))
    const formBlock = formEnd >= 0 ? lines.slice(formIdx + 1, formEnd) : lines.slice(formIdx + 1, formIdx + 10)
    formation = formBlock.filter((l) => !/^(formation|education|langues)/i.test(l)).join(' ')
  }

  // Règles de parsing finales
  const firstExp = experiences[0]
  const co = firstExp?.company || '—'
  const ti = firstExp?.title || shortTitle || '—'
  const dur = firstExp?.duration || ''
  const pastExperiences = experiences.slice(1)

  return {
    fn,
    ln,
    co,
    ti,
    city: city || '—',
    dur,
    summary,
    experiences: pastExperiences,
    formation,
    li: li || '',
    src: 'Chasse LinkedIn',
  }
}
