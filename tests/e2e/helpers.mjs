// Shared helpers for tests/e2e/*.test.mjs.
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Call a Tauri command (e.g. 'plugin:sorai-converter|ping') from the window.
export const invoke = (page, cmd, args = {}) =>
  page.evaluate(([c, a]) => window.__TAURI_INTERNALS__.invoke(c, a), [cmd, args])

// Replace native dialogs with canned results (see src/lib/dialogs.js).
// Pass only the ones you need; null = user cancelled. Lost on page reload.
export const stubDialogs = (page, results) =>
  page.evaluate((r) => {
    for (const [name, value] of Object.entries(r)) window.SoraiDialogs[name] = async () => value
  }, results)

// Is this worktree's app exe (src-tauri/target/**/sorai-toolkit.exe) running?
// Scoped by path so other worktrees' windows don't count. Windows only.
export function appRunning() {
  const target = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src-tauri', 'target').replace(/'/g, "''")
  const ps = `@(Get-CimInstance Win32_Process -Filter "Name='sorai-toolkit.exe'" | ? { $_.ExecutablePath -like '${target}\*' }).Count`
  return Number(execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).trim()) > 0
}
