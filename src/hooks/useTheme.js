import { useCallback, useEffect, useState } from 'react'

// Hub-owned (relocated here from the Converter repo during the multi-repo
// restructure — theme is a shell/header concern shared across every tool).
// Storage key renamed from the old 'estella-theme' to 'sorai-theme' in the
// same move; a returning user just re-picks dark/light once, a one-time
// low-stakes reset.
const STORAGE_KEY = 'sorai-theme'

// Window/taskbar icon has a matching pair (white mark for dark theme, black
// mark for light theme -- same contrast-against-background reasoning as any
// theme-aware logo) swapped at runtime via Neutralino.window.setIcon(),
// rather than picking one static icon at build time the way
// neutralino.config.json's own `icon` field necessarily has to (that field
// only sets the icon for the very first frame before this effect's initial
// run takes over). Path is resolved the same way neutralino.config.json's
// `icon` field is -- relative to the project root, not through the web
// server (window icons load from disk directly, unlike documentRoot).
const ICON_PATHS = {
  dark: '/resources/icons/appIcon-dark.png',
  light: '/resources/icons/appIcon-light.png',
}

export function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark',
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
    window.Neutralino?.window.setIcon(ICON_PATHS[theme]).catch(() => {})
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
