// Shared helpers for tests/e2e/*.test.mjs.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

// How many of this worktree's app exes (src-tauri/target/**/sorai-toolkit.exe)
// are running? Scoped by path so other worktrees' windows don't count. Windows only.
export function appCount() {
  const target = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src-tauri', 'target').replace(/'/g, "''")
  const ps = `@(Get-CimInstance Win32_Process -Filter "Name='sorai-toolkit.exe'" | ? { $_.ExecutablePath -like '${target}\*' }).Count`
  return Number(execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).trim())
}
export const appRunning = () => appCount() > 0

// Run the debug exe with args (a second instance forwards and exits) -> exit code.
export const exe = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src-tauri', 'target', 'debug', 'sorai-toolkit.exe')
export function runExe(args) {
  const p = spawn(exe, args, { stdio: 'ignore' })
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { p.kill(); reject(new Error(`${args[0]} did not exit`)) }, 30_000)
    p.on('exit', (code) => { clearTimeout(t); resolve(code) })
  })
}

// Every value under the classes root as { key, name, data }, keys relative to
// the root. Written to a UTF-8 file: console output would go through the ANSI codepage.
export function readRegistry(root) {
  const out = join(mkdtempSync(join(tmpdir(), 'sorai-reg-')), 'reg.json')
  const ps = `
    $base = 'HKEY_CURRENT_USER\\${root.replace(/'/g, "''")}\\'
    $vals = @(Get-ChildItem -LiteralPath ('Registry::' + $base) -Recurse | ForEach-Object {
      $k = $_
      foreach ($n in $k.GetValueNames()) { [pscustomobject]@{ key = $k.Name.Substring($base.Length); name = $n; data = $k.GetValue($n) } }
    })
    [System.IO.File]::WriteAllText('${out.replace(/'/g, "''")}', (ConvertTo-Json -InputObject $vals -Compress -Depth 3), [System.Text.Encoding]::UTF8)`
  execFileSync('powershell', ['-NoProfile', '-Command', ps])
  return JSON.parse(readFileSync(out, 'utf8').replace(/^﻿/, ''))
}

const sorted = (vals) => vals.map(({ key, name, data }) => ({ key, name, data })).sort((a, b) => (a.key + '|' + a.name).localeCompare(b.key + '|' + b.name))

// Polls until the registry under the dev classes root equals context_menu_entries(lang); -> root.
export async function expectRegistryMatches(page, lang) {
  const { root, values } = await invoke(page, 'context_menu_entries', { lang })
  assert.ok(!/^Software\\Classes$/i.test(root), `dev build must not target ${root}`)
  const want = sorted(values)
  let got
  for (let i = 0; i < 50; i++) {
    got = sorted(readRegistry(root))
    if (JSON.stringify(got) === JSON.stringify(want)) return root
    await page.waitForTimeout(200)
  }
  assert.deepEqual(got, want)
}

