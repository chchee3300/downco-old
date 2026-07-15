import { useEffect, useRef, useState } from 'react'

// Replaces the old standalone #theme-toggle button 1:1 in .header-right.
// Bespoke, deliberately small (~context menu, not a modal) — reuses
// #theme-toggle's existing 28x28/6px-radius trigger-button visual language.
// Only two items for this pass: back-to-hub (only when inside a tool) and
// the dark/light toggle (moved in from the old standalone button). No
// settings/language items yet — see the multi-repo restructure plan.
function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  )
}

export default function HamburgerMenu({ showBackToHub, onBackToHub, theme, onToggleTheme }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="hamburger-menu" ref={rootRef}>
      <button
        id="hamburger-toggle"
        title="Menu"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <HamburgerIcon />
      </button>
      {open && (
        <div className="hamburger-dropdown" role="menu">
          {showBackToHub && (
            <button
              className="hamburger-item"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onBackToHub()
              }}
            >
              Back to main menu
            </button>
          )}
          <button
            className="hamburger-item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onToggleTheme()
            }}
          >
            {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          </button>
        </div>
      )}
    </div>
  )
}
