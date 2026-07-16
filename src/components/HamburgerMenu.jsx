import { useEffect, useRef, useState } from 'react'

// Replaces the old standalone #theme-toggle button 1:1 in .header-right.
// Bespoke, deliberately small (~context menu, not a modal) — reuses
// #theme-toggle's existing 28x28/6px-radius trigger-button visual language.
// Only two items for this pass: back-to-hub (only when inside a tool) and
// the dark/light toggle (moved in from the old standalone button). No
// settings/language items yet — see the multi-repo restructure plan.
//
// Icon has two always-mounted line groups (closed/horizontal, open/vertical)
// that cross-fade + rotate via CSS on [aria-expanded] — see styles.css.
function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <g className="hb-lines-closed">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </g>
      <g className="hb-lines-open">
        <line x1="7" y1="4" x2="7" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="17" y1="4" x2="17" y2="20" />
      </g>
    </svg>
  )
}

function SunIcon() {
  return (
    <svg className="theme-switch__icon theme-switch__icon--sun" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="1.5" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22.5" />
        <line x1="1.5" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22.5" y2="12" />
        <line x1="4.2" y1="4.2" x2="6" y2="6" />
        <line x1="18" y1="18" x2="19.8" y2="19.8" />
        <line x1="4.2" y1="19.8" x2="6" y2="18" />
        <line x1="18" y1="6" x2="19.8" y2="4.2" />
      </g>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="theme-switch__icon theme-switch__icon--moon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 13.5A8.5 8.5 0 1 1 10.5 4a6.6 6.6 0 0 0 9.5 9.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

// Close/open animation timings must match the CSS keyframe durations for
// .hamburger-dropdown--open/--closing (see styles.css) -- the dropdown stays
// mounted through the closing animation instead of disappearing instantly.
const CLOSE_ANIM_MS = 120

export default function HamburgerMenu({ showBackToHub, onBackToHub, theme, onToggleTheme }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const rootRef = useRef(null)
  const closeTimeoutRef = useRef(null)

  const requestClose = () => {
    setOpen(false)
    clearTimeout(closeTimeoutRef.current)
    closeTimeoutRef.current = setTimeout(() => setMounted(false), CLOSE_ANIM_MS)
  }

  const requestOpen = () => {
    clearTimeout(closeTimeoutRef.current)
    setMounted(true)
    setOpen(true)
  }

  useEffect(() => () => clearTimeout(closeTimeoutRef.current), [])

  useEffect(() => {
    if (!open) return undefined
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) requestClose()
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') requestClose()
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
        onClick={() => (open ? requestClose() : requestOpen())}
      >
        <HamburgerIcon />
      </button>
      {mounted && (
        <div className={`hamburger-dropdown ${open ? 'hamburger-dropdown--open' : 'hamburger-dropdown--closing'}`} role="menu">
          <div className="theme-switch-row" role="menuitem">
            <span className="theme-switch-label">Appearance</span>
            <button
              type="button"
              className="theme-switch"
              role="switch"
              aria-checked={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={onToggleTheme}
            >
              <SunIcon />
              <MoonIcon />
              <span className="theme-switch__thumb" aria-hidden="true" />
            </button>
          </div>
          {showBackToHub && (
            <button
              className="hamburger-item hamburger-item--danger"
              role="menuitem"
              onClick={() => {
                requestClose()
                onBackToHub()
              }}
            >
              Main menu
            </button>
          )}
        </div>
      )}
    </div>
  )
}
