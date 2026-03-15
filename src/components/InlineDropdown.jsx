import { useState, useRef, useEffect } from 'react'

const DROPDOWN_Z = 9999

/**
 * Dropdown réutilisable pour Maturité, Stade, Source (aligné Dashboard / Tous les profils / Fiche profil).
 * @param {string[]} options - Liste des options
 * @param {string} value - Valeur courante
 * @param {(v: string) => void} onChange - Callback au choix
 * @param {Object|(v: string) => Object} buttonStyle - Style du bouton (objet ou fonction de la valeur)
 * @param {string} [buttonClassName] - Classes CSS du bouton (optionnel, ex. "tag tag-btn tb")
 * @param {string} [placeholder] - Texte si valeur vide
 */
export default function InlineDropdown({ options, value, onChange, buttonStyle = {}, buttonClassName = '', placeholder = '—' }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const buttonRef = useRef(null)

  const resolvedStyle = typeof buttonStyle === 'function' ? buttonStyle(value) : buttonStyle

  useEffect(() => {
    if (!open || !buttonRef.current) return
    const r = buttonRef.current.getBoundingClientRect()
    setRect({ left: r.left, bottom: r.bottom, width: Math.max(r.width, 140) })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        style={{ ...resolvedStyle, cursor: 'pointer', padding: '6px 10px', fontSize: 13, borderRadius: 6, border: 'none' }}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      >
        {(value || placeholder).toString().trim() || placeholder} ▾
      </button>
      {open && rect && (
        <div
          className="ddrop bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg p-1 min-w-[140px] max-h-[280px] overflow-y-auto"
          style={{ position: 'fixed', left: rect.left, top: rect.bottom + 4, width: rect.width, zIndex: DROPDOWN_Z }}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <div
              key={opt}
              className="ddi py-1.5 px-2.5 rounded-md text-[13px] cursor-pointer hover:bg-[var(--s2)]"
              style={value === opt ? { fontWeight: 600 } : {}}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
