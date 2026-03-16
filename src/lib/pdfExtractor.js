import * as pdfjsLib from 'pdfjs-dist'

import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

/**
 * Extrait le texte d'un PDF en préservant la structure par lignes.
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

/**
 * Parse le texte PDF LinkedIn selon la structure standard :
 * Coordonnées → Compétences/Langues → Nom → Titre → Ville → Résumé → Expérience → Formation
 */
export function parsePDFLinkedIn(rawText) {
  const allLines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  console.log('=== TEXTE BRUT PDF (lignes) ===')
  allLines.forEach((l, i) => console.log(`${i}: "${l}"`))
  console.log('=== FIN TEXTE BRUT ===')

  const isSection = (l) =>
    [
      'Expérience', 'Experience', 'Formation', 'Education',
      'Résumé', 'Summary', 'Compétences', 'Skills',
      'Certifications', 'Langues', 'Languages',
      'Principales compétences', 'Coordonnées', 'Contact',
      'Honors-Awards', 'Projets', 'Bénévolat', 'Publications',
    ].includes(l)

  const isDate = (l) =>
    /\d{4}\s*[-–]\s*(Present|Présent|\d{4})/i.test(l) ||
    /(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/i.test(l)

  const isDuration = (l) => /^\d+\s*(an|ans|mois)(\s+\d+\s*(an|ans|mois))?$/.test(l)

  const isPageMarker = (l) => /^Page \d+ (of|sur) \d+$/i.test(l)

  const isLocation = (l) =>
    l.length < 80 &&
    !isDate(l) &&
    !isDuration(l) &&
    /(France|Paris|Lyon|Marseille|Toulouse|Bordeaux|Nantes|,\s*(France|Occitanie|PACA|Île-de-France|Auvergne|Bretagne|Normandie|Aquitaine|Provence|Rhône|Hauts-de|Grand Est|Pays de|Nouvelle-Aquitaine|Bourgogne|Centre-Val))/i.test(l)

  const isDescription = (l) =>
    l.startsWith('-') ||
    l.startsWith('•') ||
    l.startsWith('–') ||
    l.startsWith('(') ||
    l.length > 100 ||
    isPageMarker(l)

  const extractEmail = (lines) => {
    for (const l of lines) {
      const m = l.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
      if (m) return m[0]
    }
    return ''
  }

  const extractLinkedIn = (lines) => {
    for (const l of lines) {
      if (l.includes('linkedin.com/in/')) {
        const url = l.replace(/\s*\(LinkedIn\)\s*/i, '').trim()
        return url.startsWith('http') ? url : 'https://' + url
      }
    }
    return ''
  }

  const extractYears = (dateStr) => {
    const MONTHS = {
      janvier: 1, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
      juillet: 7, août: 8, septembre: 9, octobre: 10,
      novembre: 11, décembre: 12,
    }
    const years = (dateStr.match(/\d{4}/g) || []).map(Number)
    const isCurrent = /Present|Présent/i.test(dateStr)
    const monthList =
      (dateStr.toLowerCase().match(
        /(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/g
      ) || [])
    return {
      startYear: years[0] || null,
      startMonth: MONTHS[monthList[0]] || null,
      endYear: isCurrent ? null : (years[1] || null),
      isCurrent,
    }
  }

  const email = extractEmail(allLines)
  const linkedinUrl = extractLinkedIn(allLines)

  const expIdx = allLines.findIndex((l) => l === 'Expérience' || l === 'Experience')
  const formIdx = allLines.findIndex((l) => l === 'Formation' || l === 'Education')

  const LANG_RE = /(Native or Bilingual|Professional Working|Limited Working|Elementary)/i
  let name = ''
  let nameIdx = -1
  const searchEnd = expIdx > 0 ? expIdx : 50

  for (let i = 0; i < searchEnd; i++) {
    const l = allLines[i]
    if (isSection(l) || isDate(l) || isDuration(l) || LANG_RE.test(l)) continue
    if (l.includes('@') || l.includes('linkedin') || l.includes('http')) continue
    if (l.includes('facebook') || l.includes('www.')) continue
    if (l.length >= 4 && l.length <= 60 && !l.match(/^\d/)) {
      const prevSection = allLines
        .slice(Math.max(0, i - 5), i)
        .some((pl) =>
          ['Languages', 'Langues', 'Certifications', 'Honors-Awards', 'Principales compétences'].includes(pl)
        )
      if (prevSection || i > 10) {
        name = l
        nameIdx = i
        break
      }
    }
  }

  let profileTitle = ''
  let city = ''
  let region = ''
  if (nameIdx > -1) {
    for (let i = nameIdx + 1; i < Math.min(nameIdx + 5, allLines.length); i++) {
      const l = allLines[i]
      if (isSection(l)) break
      if (!profileTitle && !isDate(l) && !isDuration(l) && !isLocation(l)) {
        profileTitle = l
      }
      if (isLocation(l) && !city) {
        const parts = l.split(',').map((s) => s.trim())
        city = parts[0]
        region = parts[1] || ''
      }
    }
  }

  const experiences = []
  if (expIdx > -1) {
    const expStart = expIdx + 1
    const expEnd = formIdx > expIdx ? formIdx : allLines.length
    const expLines = allLines.slice(expStart, expEnd)

    // Pré-filtrer : garder uniquement les lignes utiles
    // en utilisant un flag "après une date = description"
    const cleanExpLines = []
    let afterDate = false
    let afterDescription = false

    for (const line of expLines) {
      if (/^Page\s+\d+\s+(of|sur)\s+\d+/i.test(line)) continue

      if (/^\d+\s*(an|ans|mois)(\s+\d+\s*(an|ans|mois))?$/.test(line)) continue

      if (/(Native or Bilingual|Professional Working|Limited Working|Elementary)/i.test(line)) continue

      const isDateLine =
        /\d{4}\s*[-–]\s*(Present|Présent|\d{4})/i.test(line) ||
        /(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/i.test(line)

      if (isDateLine) {
        afterDate = true
        afterDescription = false
        cleanExpLines.push(line)
        continue
      }

      if (line.startsWith('-') || line.startsWith('•') || line.startsWith('–')) {
        afterDescription = true
        continue
      }

      if (afterDate && afterDescription) {
        const couldBeCompany =
          line.length < 80 &&
          !line.startsWith('(') &&
          !line.match(/^[a-z]/) &&
          !line.includes('contreparties') &&
          !line.includes('clientèle') &&
          !/^[a-zà-ü]/.test(line)

        if (!couldBeCompany) continue
        afterDate = false
        afterDescription = false
      }

      if (
        /(France|Région|région|Paris|Lyon|Marseille|Toulouse|Bordeaux|Nantes|Montpellier|Île-de-France|Auvergne|Normandie|Bretagne|Occitanie|Provence|Rhône|Hauts-de|Grand Est|Pays de|Domont|Chambéry|Nanterre)/i.test(
          line
        ) &&
        line.length < 80 &&
        !isDateLine
      )
        continue

      cleanExpLines.push(line)
    }

    const MONTHS = {
      janvier: 1, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
      juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12,
    }

    let currentCompany = ''
    let i = 0

    while (i < cleanExpLines.length) {
      const line = cleanExpLines[i]
      const isDateLine =
        /\d{4}\s*[-–]\s*(Present|Présent|\d{4})/i.test(line) ||
        /(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/i.test(line)

      if (isDateLine) {
        i++
        continue
      }

      let dateIdx = -1
      for (let j = i + 1; j < Math.min(i + 4, cleanExpLines.length); j++) {
        const l = cleanExpLines[j]
        if (
          /\d{4}\s*[-–]\s*(Present|Présent|\d{4})/i.test(l) ||
          /(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/i.test(l)
        ) {
          dateIdx = j
          break
        }
      }

      if (dateIdx === -1) {
        currentCompany = line
        i++
        continue
      }

      const between = cleanExpLines
        .slice(i + 1, dateIdx)
        .filter((l) => !/\d{4}\s*[-–]/i.test(l))

      const dateStr = cleanExpLines[dateIdx]
      const years = (dateStr.match(/\d{4}/g) || []).map(Number)
      const isCurrent = /Present|Présent/i.test(dateStr)
      const monthMatches =
        dateStr
          .toLowerCase()
          .match(
            /(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/g
          ) || []

      if (between.length > 0) {
        currentCompany = line
        experiences.push({
          company: line,
          title: between[0],
          startYear: years[0] || null,
          startMonth: MONTHS[monthMatches[0]] || null,
          endYear: isCurrent ? null : (years[1] || null),
          isCurrent,
        })
      } else {
        experiences.push({
          company: currentCompany,
          title: line,
          startYear: years[0] || null,
          startMonth: MONTHS[monthMatches[0]] || null,
          endYear: isCurrent ? null : (years[1] || null),
          isCurrent,
        })
      }

      i = dateIdx + 1
    }
  }

  return {
    firstName: name.split(' ')[0] || '',
    lastName: name.split(' ').slice(1).join(' ') || '',
    fullName: name,
    email,
    linkedinUrl,
    title: profileTitle,
    city,
    region,
    experiences,
    currentCompany: experiences[0]?.company || '',
    currentTitle: experiences[0]?.title || profileTitle,
  }
}

/** Alias pour compatibilité */
export const parseLinkedInPDFText = parsePDFLinkedIn
