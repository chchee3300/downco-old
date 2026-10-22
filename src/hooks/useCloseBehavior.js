import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { TrayIcon } from '@tauri-apps/api/tray'
import { Menu } from '@tauri-apps/api/menu'
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'
import { tNow } from '../i18n/dict.js'
import { invoke } from '@tauri-apps/api/core'
import { imageFromUrl, revealMainWindow } from '../lib/mainWindow.js'
import trayIconDark from '../../resources/icons/trayIcon-dark.png'
import trayIconLight from '../../resources/icons/trayIcon-light.png'

// Owns the window's close-requested -> (ask | minimize-to-tray | quit) hook.
// Storage key/pattern mirrors useTheme.js's 'sorai-theme' -- localStorage,
// no wrapper lib, lazy-initialized from storage.
const STORAGE_KEY = 'sorai-close-behavior' // 'ask' | 'tray' | 'quit'
const TRAY_ID = 'sorai-tray'

// destroy() skips close-requested; the last window going away ends the app.
const quitApp = () => getCurrentWindow().destroy()

// White mark on a dark taskbar, black on a light one. The taskbar's own
// setting (Windows), else the system theme the window reports.
async function trayIcon() {
  const light = (await invoke('taskbar_is_light').catch(() => null)) ?? (await getCurrentWindow().theme()) === 'light'
  return imageFromUrl(light ? trayIconLight : trayIconDark)
}

const buildTrayMenu = () =>
  Menu.new({
    items: [
      { id: 'open', text: tNow('tray.open'), action: () => revealMainWindow() },
      { id: 'quit', text: tNow('tray.quit'), action: quitApp },
    ],
  })

export function useCloseBehavior() {
  const [behavior, setBehaviorState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'ask',
  )
  const behaviorRef = useRef(behavior)
  behaviorRef.current = behavior
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Tray is created lazily on first actual minimize, not at startup --
  // most users who never close-to-tray should never see a tray icon at all.
  const trayRef = useRef(null)
  const hasNotifiedThisSessionRef = useRef(false)

  const setBehavior = useCallback((value) => {
    setBehaviorState(value)
    localStorage.setItem(STORAGE_KEY, value)
  }, [])

  const minimizeToTray = useCallback(async () => {
    if (!trayRef.current) {
      // A webview reload (HMR) leaves the Rust-side tray alive but its menu /
      // click callbacks point at the dead page -- replace it.
      await (await TrayIcon.getById(TRAY_ID))?.close()
      trayRef.current = await TrayIcon.new({
        id: TRAY_ID,
        icon: await trayIcon(),
        iconAsTemplate: true, // macOS only
        tooltip: 'SORAI Toolkit',
        menu: await buildTrayMenu(),
        showMenuOnLeftClick: false,
        action: (e) => {
          if (e.type === 'Click' && e.button === 'Left' && e.buttonState === 'Up') revealMainWindow()
        },
      })
    } else {
      // A taskbar-only colour switch doesn't change the window theme, so no
      // ThemeChanged event: re-check whenever we go to the tray.
      trayRef.current.setIcon(await trayIcon()).catch(console.error)
    }
    await getCurrentWindow().hide()
    if (!hasNotifiedThisSessionRef.current) {
      hasNotifiedThisSessionRef.current = true
      try {
        // macOS drops it silently without permission; ask once (no-op elsewhere).
        if ((await isPermissionGranted()) || (await requestPermission()) === 'granted') {
          sendNotification({ title: tNow('tray.notifyTitle'), body: tNow('tray.notifyBody') })
        }
      } catch (e) {
        console.warn('notification failed', e)
      }
    }
  }, [])

  // close-requested -> dispatch per current behavior. Always preventDefault:
  // quitting goes through destroy() explicitly.
  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested((event) => {
      event.preventDefault()
      if (behaviorRef.current === 'tray') minimizeToTray().catch(console.error)
      else if (behaviorRef.current === 'quit') quitApp()
      else setConfirmOpen(true)
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [minimizeToTray])

  // Follow a system light/dark switch (the window gets one ThemeChanged per
  // Windows colour-setting change, taskbar included).
  useEffect(() => {
    const unlisten = getCurrentWindow().onThemeChanged(() => {
      if (trayRef.current) trayIcon().then((img) => trayRef.current.setIcon(img)).catch(console.error)
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  // Tray menu labels are native, not React-rendered: rebuild the menu on a
  // language switch if the tray already exists.
  useEffect(() => {
    if (!window.EstellaLib?.i18n) return undefined
    return window.EstellaLib.i18n.subscribe(() => {
      if (trayRef.current) buildTrayMenu().then((m) => trayRef.current.setMenu(m)).catch(console.error)
    })
  }, [])

  const resolveConfirm = useCallback(
    (choice, remember) => {
      setConfirmOpen(false)
      if (remember) setBehavior(choice)
      if (choice === 'tray') minimizeToTray().catch(console.error)
      else quitApp()
    },
    [setBehavior, minimizeToTray],
  )

  const cancelConfirm = useCallback(() => setConfirmOpen(false), [])

  return { behavior, setBehavior, confirmOpen, resolveConfirm, cancelConfirm }
}
