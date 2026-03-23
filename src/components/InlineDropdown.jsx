import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const DROPDOWN_Z = 9999

/**
 * Dropdown réutilisable pour Maturité, Stade, Source (aligné Dashboard / Tous les profils / Fiche profil).
 * @param {string[]} options - Liste des options
 * @param {string} value - Valeur courante
 * @param {(v: string) => void} onChange - Callback au choix
 * @param {Object|(v: string) => Object} buttonStyle - Style du bouton (objet ou fonction de la valeur)
 * @param {string} [buttonClassName] - Classes CSS du bouton (optionnel, ex. "tag tag-btn tb")
 * @param {string} [placeholder] - Texte si valeur vide
 * @param {boolean} [open] - Controlled: état ouvert (optionnel)
 * @param {(v: boolean) => void} [onOpenChange] - Controlled: callback changement état (optionnel)
 * @param {string} [containerClassName] - Classe pour le conteneur (pour click-outside)
 */
export default function InlineDropdown({ options, value, onChange, buttonStyle = {}, buttonClassName = '', placeholder = '—', formatDisplay, open: openProp, onOpenChange, containerClassName = '' }) {
  const [openInternal, setOpenInternal] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : openInternal
  const setOpen = (v) => {
    if (isControlled) onOpenChange?.(typeof v === 'function' ? v(open) : v)
    else setOpenInternal(typeof v === 'function' ? v(openInternal) : v)
  }
  const [rect, setRect] = useState(null)
  const buttonRef = useRef(null)
  const containerRef = useRef(null)

  const resolvedStyle = typeof buttonStyle === 'function' ? buttonStyle(value) : buttonStyle

  useEffect(() => {
    if (!open || isControlled) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, isControlled])

  return (
    <div ref={containerRef} className={containerClassName} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        style={{ cursor: 'pointer', padding: '6px 10px', fontSize: 13, borderRadius: 6, border: 'none', ...resolvedStyle }}
        onClick={(e) => {
          e.stopPropagation()
          if (buttonRef.current) {
            const r = buttonRef.current.getBoundingClientRect()
            setRect({ left: r.left, bottom: r.bottom, width: Math.max(r.width, 140) })
          }
          setOpen((o) => !o)
        }}
      >
        {(formatDisplay ? formatDisplay(value) : (value || placeholder)).toString().trim() || placeholder} ▾
      </button>
      {open && rect &&
        createPortal(
          <div
            className="ddrop p-1 max-h-[280px] overflow-y-auto"
            style={{
              position: 'fixed',
              top: rect.bottom + 4,
              left: rect.left,
              zIndex: DROPDOWN_Z,
              background: 'white',
              border: '0.5px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              minWidth: 180,
              width: Math.max(rect.width, 180),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {options.map((opt) => (
              <div
                key={opt}
                className="ddi py-1.5 px-2.5 rounded-md text-[13px] cursor-pointer hover:bg-[var(--s2)]"
                style={value === opt ? { fontWeight: 600 } : {}}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  setTimeout(() => onChange(opt), 0)
                }}
              >
                {opt}
              </div>
            ))}
          </div>,
          document.body
        )
      }
    </div>
  )
}
