// Background preset launch from a COLD start: what a right-click preset
// does when the app isn't running. Needs the app NOT running, so it sorts
// after zz-quit (and ends the dev app itself when run on its own). tauri dev
// exits with the app, taking Vite along, so this serves the debug exe's
// devUrl with its own Vite and drives the exe directly over its own CDP port.
// audio-to-ogg on the mono fixture also guards the Converter's libvorbis
// fix (320k ABR used to fail on mono); the .png row is skipped, which still
// counts as all-succeeded.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { appCount, invoke } from './helpers.mjs'
import { killTree, ports } from '../../scripts/tauri-dev.mjs'

const hub = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const exe = join(hub, 'src-tauri', 'target', 'debug', 'sorai-toolkit.exe')
const FFMPEG = join(hub, 'binaries', 'win_x64', 'ffmpeg.exe')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const up = (url) => fetch(url).then((r) => r.ok, () => false)

async function until(what, fn, timeout = 30_000) {
  const end = Date.now() + timeout
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`)
    await sleep(200)
  }
}

const exited = (p) => p.exitCode !== null ? Promise.resolve(p.exitCode) : new Promise((r) => p.on('exit', r))

export const tests = {
  'cold --sorai-preset=audio-to-ogg, 2 files + 1 skipped: progress window only, outputs, auto-close, app exits': async ({ page }) => {
    if (appCount() > 0) {
      await invoke(page, 'plugin:window|destroy', { label: 'main' }).catch(() => {}) // page dies mid-call
      await until('the dev app to exit', () => appCount() === 0)
    }
    const { vitePort, cdpPort } = ports()
    const devUrl = `http://localhost:${vitePort}`
    const cdp = cdpPort + 1 // the dev app's port may linger in TIME_WAIT
    // tauri dev takes its Vite down once the app is gone; don't race it.
    await until('the dev Vite to stop', async () => !(await up(devUrl)), 10_000).catch(() => {})
    let vite
    if (!(await up(devUrl))) {
      vite = spawn(process.execPath, [join(hub, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(vitePort), '--strictPort'],
        { cwd: hub, stdio: 'ignore', env: { ...process.env, VITE_PORT: String(vitePort) } })
      await until('vite', () => up(devUrl), 60_000)
    }

    const dir = mkdtempSync(join(tmpdir(), 'sorai 預設 '))
    const files = ['一 首.mp3', 'two.mp3'].map((n) => join(dir, n))
    for (const f of files) copyFileSync(join(hub, 'tests', 'fixtures', 'test_fixture_audio.mp3'), f)
    const picture = join(dir, 'pic.png')
    copyFileSync(join(hub, 'tests', 'fixtures', 'test_in.png'), picture)
    const env = {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${cdp}`,
      WEBVIEW2_USER_DATA_FOLDER: mkdtempSync(join(tmpdir(), 'sorai-e2e-cold-')),
    }
    // One launch per file, at once, like a multi-select right-click: one
    // becomes the primary, the other forwards to it and exits.
    const procs = [...files, picture].map((f) => spawn(exe, ['--sorai-preset=audio-to-ogg', f], { env, stdio: 'ignore' }))
    let browser
    try {
      await until('CDP', () => up(`http://127.0.0.1:${cdp}/json/version`), 60_000)
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdp}`)
      const label = (p) => p.evaluate(() => window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(() => null)
      const pageFor = async (want) => {
        for (const p of browser.contexts().flatMap((c) => c.pages())) if (p.url().startsWith(devUrl) && (await label(p)) === want) return p
      }
      const progress = await until('the progress window', () => pageFor('progress'), 60_000)

      const rows = progress.locator('.progress-row')
      let mainShown = false
      const done = async () => {
        mainShown ||= await invoke(progress, 'plugin:window|is_visible', { label: 'main' })
        const st = await rows.evaluateAll((els) => els.map((e) => e.dataset.status))
        return st.length === 3 && st.filter((s) => s === 'success').length === 2 && st.includes('skipped') && st
      }
      await until('both rows to succeed, one skipped', done, 90_000)
      const doneAt = Date.now()
      assert.equal(mainShown, false, 'main window was shown')
      assert.deepEqual((await rows.evaluateAll((els) => els.map((e) => e.title))).sort(), [...files, picture].sort())

      for (const f of files) {
        const out = f.replace(/\.mp3$/, '_converted.ogg')
        assert.ok(existsSync(out), `missing ${out}`)
        let info = ''
        try { execFileSync(FFMPEG, ['-hide_banner', '-i', out], { encoding: 'utf8', stdio: 'pipe' }) } catch (e) { info = e.stderr }
        assert.match(info, /Audio: vorbis/)
      }
      assert.equal(readdirSync(dir).length, 5)

      // The success toast keeps the process up while it's on screen (click
      // handler is in-process), at most lib.rs TOAST_WAIT (10 s).
      await until('the app to exit', () => appCount() === 0, 25_000)
      assert.ok(Date.now() - doneAt >= 2500, 'closed before the 3 s delay')
      console.log(`       exited ${Date.now() - doneAt} ms after the last row finished`)
      assert.deepEqual(await Promise.all(procs.map(exited)), procs.map(() => 0))
    } finally {
      await browser?.close().catch(() => {})
      for (const p of procs) if (p.exitCode === null) p.kill()
      if (vite) killTree(vite)
    }
  },
}
