import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import LiquidGlass from 'liquid-glass-react'
import { useTranslation } from '../hooks/useTranslation.js'
import AboutModal from './AboutModal.jsx'

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

function UpdateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 12a8.5 8.5 0 1 1-2.49-6.01" />
      <path d="M20.5 3.5v4h-4" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="7.5" r="0.75" fill="currentColor" stroke="none" />
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
const CLOSE_ANIM_MS = 100

export default function HamburgerMenu({ showBackToHub, onBackToHub, theme, onToggleTheme, onCheckUpdate }) {
  const { t, lang } = useTranslation()
  const FlagIcon = LANG_FLAG_ICONS[lang]
  const [open, setOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  // True once the open pop animation finished -- the animation class is
  // then REMOVED (no forwards-fill lingering) because a filled keyframe
  // animation keeps the shell GPU-promoted forever, and a backdrop-filter
  // on a DESCENDANT of a promoted element computes but never paints in
  // this engine (verified earlier on this exact surface) -- which blanked
  // liquid-glass-react's frost layer. With the class stripped after the
  // 140ms pop, promotion ends and the library's backdrop sampling paints.
  const [settled, setSettled] = useState(false)
  const rootRef = useRef(null)
  const shellRef = useRef(null)
  const closeTimeoutRef = useRef(null)
  // Rendered size of liquid-glass-react's inner .glass element. The
  // library positions every one of its layers around a CENTER point (its
  // transform hardcodes translate(-50%,-50%)), so the anchoring shell
  // (.hamburger-dropdown, absolute top/right below the toggle) must be
  // given the glass's own size explicitly for "centered in the shell" to
  // equal "filling the shell". Measured after mount + tracked with a
  // ResizeObserver (row widths change when the language cycles).
  const [glassSize, setGlassSize] = useState(null)

  useEffect(() => {
    if (!mounted || !shellRef.current) return undefined
    const glassEl = shellRef.current.querySelector('.glass')
    if (!glassEl) return undefined
    const ro = new ResizeObserver(() => {
      const w = Math.ceil(glassEl.offsetWidth)
      const h = Math.ceil(glassEl.offsetHeight)
      if (w > 0 && h > 0) {
        setGlassSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
        // liquid-glass-react measures its own glassSize exactly once on
        // mount (then only on window resize) -- and its SVG filter region,
        // overlay border spans, and rim layers are all sized from that
        // internal measurement. The mount-time measure lands before our
        // rows/fonts settle, freezing the filter region too small, which
        // CLIPS the glass paint (rows below ~69px rendered with no frost
        // at all). A synthetic resize event is the library's only
        // re-measure hook.
        window.dispatchEvent(new Event('resize'))
      }
    })
    ro.observe(glassEl)
    return () => ro.disconnect()
  }, [mounted])

  const requestClose = () => {
    setOpen(false)
    setSettled(false)
    clearTimeout(closeTimeoutRef.current)
    closeTimeoutRef.current = setTimeout(() => setMounted(false), CLOSE_ANIM_MS)
  }

  const requestOpen = () => {
    clearTimeout(closeTimeoutRef.current)
    setMounted(true)
    setOpen(true)
    setSettled(false)
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
        <div
          ref={shellRef}
          // The --open pop animation is gated on glassSize: before the
          // measurement lands the shell is visibility:hidden, and an
          // animation started then would finish while invisible -- the
          // dropdown would just blink in with no pop once sized (the
          // "weird" open feel). Gating means the same lg-pop-down the
          // app's other dropdowns use plays on the fully-sized, visible
          // dropdown.
          className={`hamburger-dropdown ${open ? (glassSize && !settled ? 'hamburger-dropdown--open' : '') : 'hamburger-dropdown--closing'}`}
          role="menu"
          style={glassSize ? { width: glassSize.w, height: glassSize.h } : { visibility: 'hidden' }}
          onAnimationEnd={(e) => {
            if (e.animationName === 'lg-pop-down') setSettled(true)
          }}
        >
          <LiquidGlass
            cornerRadius={12}
            padding="6px"
            // Kept LOW on purpose: the library composites its displacement
            // map as a regular filter over the backdrop-filter output, and
            // its map warps the WHOLE surface (not just the rim). At the
            // default-ish 60-70 the interior content of a ~120px-tall
            // panel gets displaced so far that the bottom region samples
            // from outside the painted backdrop and renders as a dead
            // transparent band (verified in the real WebView2 window; the
            // library's own demos are ~69px pill buttons where that scale
            // works). ~18 gives visible edge bending without evacuating
            // the interior.
            displacementScale={18}
            blurAmount={0.625}
            saturation={160}
            aberrationIntensity={1}
            elasticity={0}
            // ALWAYS false. The library's two bg-black wash divs ignore
            // this prop in our build anyway (their opacity-0/20/100 gating
            // classes never get compiled -- Tailwind doesn't scan
            // node_modules -- so styles.css display:none's them instead),
            // but overLight also halves displacementScale and swaps in a
            // heavier shadow, neither of which we want. Theme-appropriate
            // tinting is the shell's job (see .hamburger-dropdown /
            // [data-theme="light"] in styles.css).
            overLight={false}
            style={{ position: 'absolute', top: '50%', left: '50%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', minWidth: 168 }}>
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

              <button
                type="button"
                className="hamburger-item"
                role="menuitem"
                onClick={() => {
                  requestClose()
                  onCheckUpdate?.()
                }}
              >
                <span className="hamburger-item__icon" aria-hidden="true"><UpdateIcon /></span>
                <span className="hamburger-item__label">{t('hamburger.checkUpdate')}</span>
              </button>

              <button
                type="button"
                className="hamburger-item"
                role="menuitem"
                onClick={() => {
                  requestClose()
                  setAboutOpen(true)
                }}
              >
                <span className="hamburger-item__icon" aria-hidden="true"><InfoIcon /></span>
                <span className="hamburger-item__label">{t('hamburger.about')}</span>
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
          </LiquidGlass>
        </div>
      )}
      {/* Portaled to document.body -- .hamburger-menu is itself
          position:relative (anchors .hamburger-dropdown below the toggle),
          which would otherwise become AboutModal's .modal-overlay's
          positioning ancestor and confine its full-viewport
          top/left/right/bottom:0 to this small button's own box instead of
          the real viewport (confirmed live: the modal rendered squeezed
          into the header's top-right corner before this fix). */}
      {createPortal(<AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />, document.body)}
    </div>
  )
}
