import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../hooks/useTranslation.js'

// Three uniform icon-left rows: language (click cycles through
// EstellaLib.i18n.SUPPORTED_LANGS), appearance (click toggles theme), main
// menu (click navigates back to the hub, only when inside a tool). Each is
// a plain full-width button (.hamburger-item) rather than a bespoke switch
// control -- see styles.css's comment on .hamburger-item for why (no dead
// zone: the whole row is the click target).
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
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: '#e8a838' }}>
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
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: '#c9cfe8' }}>
      <path d="M20 13.5A8.5 8.5 0 1 1 10.5 4a6.6 6.6 0 0 0 9.5 9.5Z" fill="currentColor" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v9h12v-9" />
    </svg>
  )
}

// Flag emoji (🇺🇸/🇹🇼) depend on the platform having a color-emoji font
// with regional-indicator ligatures installed -- confirmed unreliable in
// practice (falls back to plain "US"/"TW" letter pairs on at least one
// tested environment, not a real flag glyph). Hand-drawn SVGs render
// pixel-identical everywhere regardless of font/OS, same reasoning every
// other icon in this app already uses inline SVG instead of an icon font.
// Simplified (not vexillologically exact -- individual US stars and TW's 12
// sun rays are illegible at this size anyway, common practice for small
// flag chips) but immediately recognizable.
function UsFlagIcon() {
  return (
    <svg className="hb-icon-flag" viewBox="0 0 24 16" aria-hidden="true">
      <rect width="24" height="16" fill="#B22234" />
      <rect y="1.23" width="24" height="1.23" fill="#fff" />
      <rect y="3.69" width="24" height="1.23" fill="#fff" />
      <rect y="6.15" width="24" height="1.23" fill="#fff" />
      <rect y="8.61" width="24" height="1.23" fill="#fff" />
      <rect y="11.08" width="24" height="1.23" fill="#fff" />
      <rect y="13.54" width="24" height="1.23" fill="#fff" />
      <rect width="10" height="8.62" fill="#3C3B6E" />
    </svg>
  )
}

function TwFlagIcon() {
  return (
    <svg className="hb-icon-flag" viewBox="0 0 24 16" aria-hidden="true">
      <rect width="24" height="16" fill="#FE0000" />
      <rect width="12" height="8" fill="#000095" />
      <circle cx="6" cy="4" r="2.2" fill="#fff" />
      <circle cx="6" cy="4" r="1.6" fill="#000095" />
    </svg>
  )
}

// Display-only, keyed by EstellaLib.i18n's own language codes -- not part
// of the translation dict itself (a flag isn't "translatable text"), but
// co-located here since it's a per-language UI constant same as the dict's
// own hamburger.lang.* native-name entries.
const LANG_FLAG_ICONS = {
  en: UsFlagIcon,
  'zh-TW': TwFlagIcon,
}

// Close/open animation timings must match the CSS keyframe durations for
// .hamburger-dropdown--open/--closing (see styles.css) -- the dropdown stays
// mounted through the closing animation instead of disappearing instantly.
const CLOSE_ANIM_MS = 120

export default function HamburgerMenu({ showBackToHub, onBackToHub, theme, onToggleTheme }) {
  const { t, lang } = useTranslation()
  const FlagIcon = LANG_FLAG_ICONS[lang]
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const rootRef = useRef(null)
  const refractRef = useRef(null)
  const closeTimeoutRef = useRef(null)

  // Liquid-glass backdrop (blur + saturation + edge refraction + specular
  // as one combined SVG filter) applied to the dropdown element itself --
  // see liquid-glass.js's attachRefraction and .hamburger-dropdown's CSS
  // comment for why it's a single filter on a single element. Attached
  // per-mount (the dropdown unmounts after its closing animation),
  // detached on unmount.
  useEffect(() => {
    if (!mounted || !refractRef.current || !window.LiquidGlass) return undefined
    return window.LiquidGlass.attachRefraction(refractRef.current, { radius: 10, gain: 60, blur: 12, saturate: 1.7 })
  }, [mounted])

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
        title={t('hamburger.menu')}
        aria-label={t('hamburger.menu')}
        aria-expanded={open}
        onClick={() => (open ? requestClose() : requestOpen())}
      >
        <HamburgerIcon />
      </button>
      {mounted && (
        <div ref={refractRef} className={`hamburger-dropdown ${open ? 'hamburger-dropdown--open' : 'hamburger-dropdown--closing'}`} role="menu">
          <button
            type="button"
            className="hamburger-item"
            role="menuitem"
            onClick={() => window.EstellaLib.i18n.cycleLang()}
          >
            <span className="hamburger-item__icon" aria-hidden="true">
              <FlagIcon />
            </span>
            <span className="hamburger-item__label">{t(`hamburger.lang.${lang}`)}</span>
          </button>

          <button
            type="button"
            className="hamburger-item"
            role="menuitem"
            aria-label={t('hamburger.themeAria', { theme })}
            onClick={onToggleTheme}
          >
            <span className="hamburger-item__icon" aria-hidden="true">
              {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
            </span>
            <span className="hamburger-item__label">{t('hamburger.appearance')}</span>
          </button>

          {showBackToHub && (
            <button
              className="hamburger-item hamburger-item--danger"
              role="menuitem"
              onClick={() => {
                requestClose()
                onBackToHub()
              }}
            >
              <span className="hamburger-item__icon" aria-hidden="true"><HomeIcon /></span>
              <span className="hamburger-item__label">{t('hamburger.mainMenu')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
