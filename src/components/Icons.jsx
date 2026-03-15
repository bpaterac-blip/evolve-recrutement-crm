/**
 * Icônes SVG inline pour tout le CRM — stroke currentColor, strokeWidth 1.5, 14x14
 */
const S = 14
const stroke = { stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const IconEnvelope = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
)
export const IconLink = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
)
export const IconTag = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
)
export const IconStar = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
)
export const IconCalendar = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
)
export const IconMapPin = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
)
export const IconMap = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>
)
export const IconBuilding = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h2" /><path d="M14 6h2" /><path d="M8 10h2" /><path d="M14 10h2" /><path d="M8 14h2" /><path d="M14 14h2" /></svg>
)
export const IconRefresh = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
)
export const IconThermometer = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" /></svg>
)
export const IconDocument = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
)
export const IconPin = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
)
export const IconPencil = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
)
export const IconUpload = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
)
export const IconTrash = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
)
export const IconPlus = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
)
export const IconArrowUp = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
)
export const IconDot = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3" /></svg>
)
export const IconClose = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
)
export const IconWarning = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
)
export const IconSave = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
)
export const IconActivity = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
)
export const IconEvent = () => (
  <svg width={S} height={S} viewBox="0 0 24 24" fill="none" {...stroke}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
)

/** Mappe code emoji ou clé → composant SVG */
export function ActivityIcon({ ico, size = S }) {
  const map = {
    '🔗': IconLink, '📧': IconEnvelope, '↗': IconArrowUp, '⚖️': IconDocument, '📞': IconMapPin,
    '📋': IconDocument, '📅': IconCalendar, '➕': IconPlus, '🎉': IconStar, '🔄': IconRefresh,
    '🌡': IconThermometer, '📌': IconPin, '✏️': IconPencil, '📝': IconDocument, '📍': IconMapPin,
    '🗑': IconTrash, '✎': IconPencil, '•': IconDot, '📩': IconEnvelope, '✍️': IconPencil, '✉': IconEnvelope,
    link: IconLink, envelope: IconEnvelope, arrow_up: IconArrowUp, document: IconDocument,
    mappin: IconMapPin, calendar: IconCalendar, plus: IconPlus, star: IconStar, refresh: IconRefresh,
    thermometer: IconThermometer, pin: IconPin, pencil: IconPencil, trash: IconTrash, dot: IconDot,
    score_warning: IconWarning,
  }
  const Comp = typeof ico === 'string' ? map[ico] : null
  return Comp ? <span style={{ display: 'inline-flex', color: 'currentColor', width: size, height: size }}><Comp /></span> : <IconDot />
}
