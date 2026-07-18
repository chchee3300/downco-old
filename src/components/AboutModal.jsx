import { useEffect, useRef, useState } from 'react'
import LiquidGlass from 'liquid-glass-react'
import { useTranslation } from '../hooks/useTranslation.js'
import versionInfo from '../version.json'
import appIcon from '../../resources/icons/appIcon.png'

const HOMEPAGE_URL = 'https://github.com/chchee3300/sorai-toolkit'

// Proper nouns + license identifiers -- not translated, same reasoning
// HamburgerMenu's own language-name entries use (a license abbreviation
// isn't "translatable text"). See THIRD-PARTY-LICENSES.md for the full
// breakdown and why bundling a GPL ffmpeg build this way (subprocess, never
// linked) doesn't require this app's own code to be GPL.
const THIRD_PARTY_LINKS = [
  { name: 'FFmpeg', note: 'GPL', url: 'https://github.com/FFmpeg/FFmpeg/blob/master/COPYING.GPLv3' },
  { name: 'yt-dlp', note: 'Unlicense', url: 'https://github.com/yt-dlp/yt-dlp/blob/master/LICENSE' },
  { name: 'qpdf', note: 'Apache-2.0', url: 'https://github.com/qpdf/qpdf/blob/main/LICENSE.txt' },
  { name: 'img2pdf', note: 'LGPL-3.0', url: 'https://gitlab.mister-muffin.de/josch/img2pdf/-/blob/master/LICENSE' },
  { name: 'Neutralino.js', note: 'MIT', url: 'https://github.com/neutralinojs/neutralinojs/blob/main/LICENSE' },
  { name: 'React', note: 'MIT', url: 'https://github.com/facebook/react/blob/main/LICENSE' },
]

const FULL_LICENSES_URL = 'https://github.com/chchee3300/sorai-toolkit/blob/master/THIRD-PARTY-LICENSES.md'

// Close/open animation timing -- must match .about-modal-glass--closing's
// CSS animation-duration (styles.css) so the shell unmounts exactly when
// the pop-out animation finishes, not before (a visible cut) or after (a
// dead frozen frame).
const CLOSE_ANIM_MS = 100

// Second-ever glass panel in the app (first is HamburgerMenu's own
// dropdown) -- follows the same recipe as CLAUDE.md's Liquid glass guide:
// backdrop-filter/tint on this shell only (never a LiquidGlass descendant,
// which computes but never paints in this WebView2 engine), the same three
// CSS overrides for the library's internal layers (.glass__warp hidden,
// .bg-black hidden, inline transitions killed), and the identical
// lg-pop-down/lg-pop-up-out keyframes every other glass panel uses so this
// reads as the same material. glassSize/ResizeObserver gating mirrors
// HamburgerMenu.jsx exactly -- same library mount-time-measurement bug
// (filter region clips before rows/fonts settle) applies here too.
export default function AboutModal({ open, onClose }) {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)
  const [settled, setSettled] = useState(false)
  const [glassSize, setGlassSize] = useState(null)
  const shellRef = useRef(null)
  const closeTimeoutRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (open) {
      clearTimeout(closeTimeoutRef.current)
      setMounted(true)
      setClosing(false)
      setSettled(false)
      setGlassSize(null)
    } else {
      setClosing(true)
      closeTimeoutRef.current = setTimeout(() => {
        setMounted(false)
        setClosing(false)
      }, CLOSE_ANIM_MS)
    }
    return () => clearTimeout(closeTimeoutRef.current)
  }, [open])

  useEffect(() => {
    if (!mounted || !shellRef.current) return undefined
    const glassEl = shellRef.current.querySelector('.glass')
    if (!glassEl) return undefined
    const ro = new ResizeObserver(() => {
      const w = Math.ceil(glassEl.offsetWidth)
      const h = Math.ceil(glassEl.offsetHeight)
      if (w > 0 && h > 0) {
        setGlassSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
        window.dispatchEvent(new Event('resize'))
      }
    })
    ro.observe(glassEl)
    return () => ro.disconnect()
  }, [mounted])

  // Focus trap / Escape / focus restore -- same pattern as TrimModal.jsx.
  useEffect(() => {
    if (!mounted) return undefined
    const previouslyFocused = document.activeElement
    const getFocusable = () =>
      Array.from(
        shellRef.current?.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || [],
      )
    const focusable = getFocusable()
    ;(focusable[0] || shellRef.current)?.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = getFocusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [mounted])

  if (!mounted) return null

  const animClass = closing ? 'about-modal-glass--closing' : glassSize && !settled ? 'about-modal-glass--open' : ''

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={shellRef}
        className={`about-modal-glass ${animClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
        tabIndex={-1}
        style={glassSize ? { width: glassSize.w, height: glassSize.h } : { visibility: 'hidden' }}
        onAnimationEnd={(e) => {
          if (e.animationName === 'lg-pop-down') setSettled(true)
        }}
      >
        <LiquidGlass
          cornerRadius={12}
          padding="20px"
          displacementScale={18}
          blurAmount={0.625}
          saturation={160}
          aberrationIntensity={1}
          elasticity={0}
          overLight={false}
          style={{ position: 'absolute', top: '50%', left: '50%' }}
        >
          <div className="about-modal-body">
            <div className="about-modal-header">
              <img src={appIcon} alt="" className="about-modal-icon" />
              <div>
                <h3 id="about-modal-title" className="about-modal-title">SORAI Toolkit</h3>
                <p className="about-modal-tagline">{t('about.tagline')}</p>
              </div>
            </div>

            <dl className="about-modal-facts">
              <dt>{t('about.version')}</dt>
              <dd className="tabular-nums">v{versionInfo.version}</dd>
              <dt>{t('about.developer')}</dt>
              <dd>Charls "CometCafe" Lin</dd>
              <dt>{t('about.license')}</dt>
              <dd>MIT</dd>
              <dt>{t('about.homepage')}</dt>
              <dd>
                <button type="button" className="about-modal-link" onClick={() => window.Neutralino.os.open(HOMEPAGE_URL)}>
                  {HOMEPAGE_URL}
                </button>
              </dd>
            </dl>

            <p className="about-modal-desc">{t('about.description')}</p>

            <p className="about-modal-heading">{t('about.thirdPartyHeading')}</p>
            <div className="about-modal-links">
              {THIRD_PARTY_LINKS.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  className="about-modal-link"
                  onClick={() => window.Neutralino.os.open(item.url)}
                >
                  {item.name} <span className="about-modal-link-note">({item.note})</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="about-modal-link about-modal-full-link"
              onClick={() => window.Neutralino.os.open(FULL_LICENSES_URL)}
            >
              {t('about.viewFullLicenses')}
            </button>

            <button type="button" className="btn btn-outline about-modal-close" onClick={onClose}>
              {t('about.close')}
            </button>
          </div>
        </LiquidGlass>
      </div>
    </div>
  )
}
