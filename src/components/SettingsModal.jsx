import { useEffect, useRef } from 'react'
import { useTranslation } from '../hooks/useTranslation.js'

const CLOSE_BEHAVIOR_OPTIONS = ['ask', 'tray', 'quit']

// Content-dense panel -- same plain .modal-content shell as AboutModal.jsx,
// not the liquid-glass dropdown language (see CLAUDE.md's Liquid glass
// guide, point 7). v1 has exactly one section (close behavior); more
// sections are meant to be appended as additional .settings-section blocks
// without restructuring this component.
export default function SettingsModal({ open, onClose, closeBehavior, onChangeCloseBehavior }) {
  const { t } = useTranslation()
  const modalContentRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const previouslyFocused = document.activeElement
    const getFocusable = () =>
      Array.from(
        modalContentRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || [],
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
        className="modal-content settings-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        tabIndex={-1}
      >
        <div className="settings-modal-body">
          <h3 id="settings-modal-title" className="about-modal-title">{t('settings.title')}</h3>

          <section className="settings-section">
            <h4 className="field-label settings-section-title">{t('settings.closeBehavior.heading')}</h4>
            {CLOSE_BEHAVIOR_OPTIONS.map((value) => (
              <label key={value} className="settings-radio-option">
                <input
                  type="radio"
                  name="close-behavior"
                  value={value}
                  checked={closeBehavior === value}
                  onChange={() => onChangeCloseBehavior(value)}
                />
                {t(`settings.closeBehavior.${value}`)}
              </label>
            ))}
          </section>

          <button type="button" className="btn btn-outline about-modal-close" onClick={onClose}>
            {t('settings.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
