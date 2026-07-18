import { useEffect, useRef } from 'react'
import { useTranslation } from '../hooks/useTranslation.js'
import versionInfo from '../version.json'
import logoDark from '../../resources/icons/appIcon-dark.png'
import logoLight from '../../resources/icons/appIcon-light.png'

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

// Used to be a liquid-glass-react panel (this file's git history has the
// full LiquidGlass version). Removed the library entirely, not just its
// backdrop-filter -- see styles.css's own comment on .about-modal-content
// for why. With nothing left that actually needs it, this is now a plain
// modal, same open/close CSS transition as TrimModal/CropModal (toggling
// .hidden via the `open` prop on an always-mounted .modal-overlay) instead
// of the mount/unmount-with-JS-timed-close-animation dance a real glass
// panel needs.
export default function AboutModal({ open, onClose, theme }) {
  const { t } = useTranslation()
  const modalContentRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Focus trap / Escape / focus restore -- same pattern as TrimModal.jsx.
  useEffect(() => {
    if (!open) return undefined
    const previouslyFocused = document.activeElement
    const getFocusable = () =>
      Array.from(
        modalContentRef.current?.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || [],
      )
    const focusable = getFocusable()
    ;(focusable[0] || modalContentRef.current)?.focus()

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
  }, [open])

  return (
    <div className={open ? 'modal-overlay' : 'modal-overlay hidden'} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={modalContentRef}
        className="modal-content about-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
        tabIndex={-1}
      >
        <div className="about-modal-body">
          <div className="about-modal-header">
            <img src={theme === 'light' ? logoLight : logoDark} alt="" className="about-modal-icon" />
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
      </div>
    </div>
  )
}
