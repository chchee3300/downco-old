import { useCallback, useEffect, useRef, useState } from 'react'
import { tNow } from '../i18n/dict.js'

// Owns the windowClose -> (ask | minimize-to-tray | quit) hook point.
// Storage key/pattern mirrors useTheme.js's 'sorai-theme' -- localStorage,
// no wrapper lib, lazy-initialized from storage. Replaces main.jsx's old
// unconditional `windowClose -> app.exit()` listener (see main.jsx), which
// this hook's own effect now owns instead, so the confirm dialog can be a
// normal React-rendered modal rather than something main.jsx has to reach
// into React state for.
const STORAGE_KEY = 'sorai-close-behavior' // 'ask' | 'tray' | 'quit'

export function useCloseBehavior() {
  const [behavior, setBehaviorState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'ask',
  )
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Tray is created lazily on first actual minimize, not at startup --
  // most users who never close-to-tray should never see a tray icon at
  // all. Re-set (not re-created) on language change so an already-visible
  // tray's menu labels stay correct without needing setTray called again
  // from scratch.
  const trayCreatedRef = useRef(false)
  const hasNotifiedThisSessionRef = useRef(false)

  const setBehavior = useCallback((value) => {
    setBehaviorState(value)
    localStorage.setItem(STORAGE_KEY, value)
  }, [])

  const buildTrayMenuItems = useCallback(
    () => [
      { id: 'open', text: tNow('tray.open') },
      { id: 'quit', text: tNow('tray.quit') },
    ],
    [],
  )

  const minimizeToTray = useCallback(async () => {
    if (!window.Neutralino) return
    const isMac = window.EstellaLib?.platform?.getOS?.() === 'Darwin'
    await window.Neutralino.os.setTray({
      icon: '/resources/icons/trayIcon.png',
      useTemplateIcon: isMac,
      menuItems: buildTrayMenuItems(),
    })
    trayCreatedRef.current = true
    await window.Neutralino.window.hide()
    if (!hasNotifiedThisSessionRef.current) {
      hasNotifiedThisSessionRef.current = true
      window.Neutralino.os
        .showNotification(tNow('tray.notifyTitle'), tNow('tray.notifyBody'))
        .catch(() => {})
    }
  }, [buildTrayMenuItems])

  const showWindow = useCallback(async () => {
    if (!window.Neutralino) return
    await window.Neutralino.window.show()
    await window.Neutralino.window.focus()
  }, [])

  // windowClose -> dispatch per current behavior. Sole owner of this event
  // going forward -- main.jsx no longer registers a listener itself.
  useEffect(() => {
    if (!window.Neutralino) return undefined
    const handler = () => {
      if (behavior === 'tray') {
        minimizeToTray()
        return
      }
      if (behavior === 'quit') {
        window.Neutralino.app.exit()
        return
      }
      setConfirmOpen(true)
    }
    window.Neutralino.events.on('windowClose', handler)
    return () => window.Neutralino.events.off('windowClose', handler)
  }, [behavior, minimizeToTray])

  // trayMenuItemClicked -> Open / Quit.
  useEffect(() => {
    if (!window.Neutralino) return undefined
    const handler = (ev) => {
      if (ev.detail?.id === 'open') showWindow()
      else if (ev.detail?.id === 'quit') window.Neutralino.app.exit()
    }
    window.Neutralino.events.on('trayMenuItemClicked', handler)
    return () => window.Neutralino.events.off('trayMenuItemClicked', handler)
  }, [showWindow])

  // Tray menu labels are set imperatively (not React-rendered), so a
  // language switch needs an explicit re-setTray to pick up the new
  // strings -- only if the tray has actually been created already.
  useEffect(() => {
    if (!window.EstellaLib?.i18n || !window.Neutralino) return undefined
    return window.EstellaLib.i18n.subscribe(() => {
      if (!trayCreatedRef.current) return
      window.Neutralino.os
        .setTray({ icon: '/resources/icons/trayIcon.png', menuItems: buildTrayMenuItems() })
        .catch(() => {})
    })
  }, [buildTrayMenuItems])

  const resolveConfirm = useCallback(
    (choice, remember) => {
      setConfirmOpen(false)
      if (remember) setBehavior(choice)
      if (choice === 'tray') minimizeToTray()
      else window.Neutralino.app.exit()
    },
    [setBehavior, minimizeToTray],
  )

  const cancelConfirm = useCallback(() => setConfirmOpen(false), [])

  return { behavior, setBehavior, confirmOpen, resolveConfirm, cancelConfirm }
}
