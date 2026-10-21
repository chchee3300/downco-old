import { useCallback, useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { imageFromUrl } from '../lib/mainWindow.js'
import iconDark from '../../resources/icons/appIcon-dark.png'
import iconLight from '../../resources/icons/appIcon-light.png'

// Hub-owned (relocated here from the Converter repo during the multi-repo
// restructure — theme is a shell/header concern shared across every tool).
// Storage key renamed from the old 'estella-theme' to 'sorai-theme' in the
// same move; a returning user just re-picks dark/light once, a one-time
// low-stakes reset.
const STORAGE_KEY = 'sorai-theme'

// Window/taskbar icon has a matching pair (white mark for dark theme, black
// mark for light theme) swapped at runtime via Tauri's window.setIcon --
// needs core:window:allow-set-icon and tauri's `image-png` feature (PNG
// bytes are decoded on the Rust side).
const ICONS = { dark: iconDark, light: iconLight }

export function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark',
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
    imageFromUrl(ICONS[theme])
      .then((img) => getCurrentWindow().setIcon(img))
      .catch((e) => console.error('setIcon failed', e))
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
