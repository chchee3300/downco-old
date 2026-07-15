import { useCallback, useEffect, useState } from 'react'

// Hub-owned (relocated here from the Converter repo during the multi-repo
// restructure — theme is a shell/header concern shared across every tool).
// Storage key renamed from the old 'estella-theme' to 'sorai-theme' in the
// same move; a returning user just re-picks dark/light once, a one-time
// low-stakes reset.
const STORAGE_KEY = 'sorai-theme'

export function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark',
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
