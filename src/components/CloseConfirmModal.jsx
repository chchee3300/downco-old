import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../hooks/useTranslation.js'

// Shown on the native window's close (X) button when the user hasn't
// picked a remembered close behavior yet (useCloseBehavior's 'ask' state).
// Same .modal-content shell/focus-trap/Escape/portal pattern as
// AboutModal.jsx -- see that file's own comment for why this codebase's
// content-dense panels are plain opaque modals, not liquid-glass panels.
// Escape/backdrop-click both resolve to onCancel (the non-destructive
// default: window just stays open, nothing happens), same as any other
// modal here.
export default function CloseConfirmModal({ open, onChoose, onCancel }) {
  const { t } = useTranslation()
  const [remember, setRemember] = useState(false)
  const modalContentRef = useRef(null)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    if (!open) return undefined
    setRemember(false)
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
        onCancelRef.current()
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
    <div className={open ? 'modal-overlay' : 'modal-overlay hidden'} onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div
        ref={modalContentRef}
        className="modal-content about-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-confirm-title"
        tabIndex={-1}
      >
        <div className="about-modal-body">
          <h3 id="close-confirm-title" className="about-modal-title">{t('closeConfirm.title')}</h3>
          <p className="about-modal-desc">{t('closeConfirm.body')}</p>

          <label className="settings-radio-option">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            {t('closeConfirm.rememberChoice')}
          </label>

          <div className="close-confirm-actions">
            <button type="button" className="btn btn-outline-danger" onClick={() => onChoose('quit', remember)}>
              {t('closeConfirm.quit')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onChoose('tray', remember)}>
              {t('closeConfirm.minimizeToTray')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
