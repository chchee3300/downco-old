// Background preset launches while the main window is open: the progress
// window runs 2 jobs at once, skips files the preset doesn't apply to,
// merges a later launch into the same window, cancels per row / all, stays
// open on any failure (a later all-success run still toasts), closing it
// mid-run cancels the job, and leaves the app (and the Converter queue) alone.
import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { appCount, invoke } from './helpers.mjs'

const hub = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const exe = join(hub, 'src-tauri', 'target', 'debug', 'sorai-toolkit.exe')
const FFMPEG = join(hub, 'binaries', 'win_x64', 'ffmpeg.exe')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ffmpeg started by THIS worktree's build (others may run their own).
function ourFfmpeg() {
  const dir = join(hub, 'src-tauri', 'target')
  const ps = `Get-CimInstance Win32_Process | ? { $_.ExecutablePath -and $_.ExecutablePath.StartsWith('${dir}', 'OrdinalIgnoreCase') -and $_.Name -match '^ffmpeg' } | % { $_.ProcessId }`
  return spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).stdout.split(/\r?\n/).filter(Boolean)
}

async function until(what, fn, timeout = 30_000) {
  const end = Date.now() + timeout
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`)
    await sleep(100)
  }
}

// One exe launch per file, at once, like a multi-select right-click; each
// forwards to the running dev app and exits.
async function launchEach(flag, files) {
  const codes = await Promise.all(files.map((f) => new Promise((resolve) => spawn(exe, [flag, f], { stdio: 'ignore' }).on('exit', resolve))))
  assert.deepEqual(codes, files.map(() => 0))
}

const label = (p) => p.evaluate(() => window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label).catch(() => null)
async function progressPages(browser) {
  const out = []
  for (const p of browser.contexts().flatMap((c) => c.pages())) if ((await label(p)) === 'progress') out.push(p)
  return out
}
const statuses = (progress) => progress.locator('.progress-row').evaluateAll((els) => Object.fromEntries(els.map((e) => [e.title, e.dataset.status])))

// A few seconds of VP9 per file, so jobs overlap and can be cancelled mid-run.
function makeClip(path) {
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=6:size=640x360:rate=30', '-pix_fmt', 'yuv420p', path])
}

export const tests = {
  'preset launches with the main window open: 2 at once, skip, merge, cancel, stays open on failure, app untouched': async ({ page, browser }) => {
    const dir = mkdtempSync(join(tmpdir(), 'sorai 進度 '))
    const [v1, v2, v3, v4, v5, v6, v7] = ['一 段.mp4', 'v2.mp4', 'v3.mp4', 'v4.mp4', 'v5.mp4', 'v6.mp4', 'v7.mp4'].map((n) => join(dir, n))
    makeClip(v1)
    for (const v of [v2, v3, v4, v5, v6, v7]) copyFileSync(v1, v)
    const song = join(dir, 'song.mp3')
    copyFileSync(join(hub, 'tests', 'fixtures', 'test_fixture_audio.mp3'), song)
    const broken = join(dir, 'broken.mp4')
    writeFileSync(broken, 'not a video')
    const queued = join(dir, 'queued.mp3')
    copyFileSync(song, queued)

    // Something in the Converter queue first: the presets must not touch it.
    await launchEach('--sorai-convert-to=.ogg', [queued])
    await page.waitForFunction(() => document.querySelectorAll('.file-item').length === 1, null, { timeout: 30_000 })
    try {
      await launchEach('--sorai-preset=video-to-webm', [v1, v2, song, broken])
      const progress = await until('the progress window', async () => (await progressPages(browser))[0], 30_000)
      await until('4 rows', async () => Object.keys(await statuses(progress)).length === 4)

      // A second launch mid-run lands in the same window.
      await launchEach('--sorai-preset=video-to-webm', [v3])
      let maxRunning = 0
      await until('row 5', async () => {
        const st = await statuses(progress)
        maxRunning = Math.max(maxRunning, Object.values(st).filter((s) => s === 'running').length)
        return Object.keys(st).length === 5
      })
      assert.equal((await progressPages(browser)).length, 1, 'a second progress window opened')
      assert.equal((await statuses(progress))[song], 'skipped')
      assert.match(await progress.locator('.progress-row[data-status="skipped"] .progress-row-status').textContent(), /not supported by this preset/)

      // Cancel v3 (queued or already running) on its own.
      await progress.locator(`.progress-row[title="${v3.replaceAll('\\', '\\\\')}"] .progress-row-cancel`).click()
      await until('everything to finish', async () => {
        const st = await statuses(progress)
        const running = Object.values(st).filter((s) => s === 'running').length
        assert.ok(running <= 2, `${running} jobs at once`)
        maxRunning = Math.max(maxRunning, running)
        return Object.values(st).every((s) => !['queued', 'running'].includes(s)) && st
      }, 120_000)
      assert.equal(maxRunning, 2, 'never saw 2 jobs overlap')
      const st = await statuses(progress)
      assert.deepEqual(st, { [v1]: 'success', [v2]: 'success', [song]: 'skipped', [broken]: 'error', [v3]: 'cancelled' })
      assert.ok(await progress.locator('.progress-row[data-status="error"] .progress-row-message').textContent())
      for (const v of [v1, v2]) {
        const out = v.replace(/\.mp4$/, '_converted.webm')
        let info = ''
        try { execFileSync(FFMPEG, ['-hide_banner', '-i', out], { encoding: 'utf8', stdio: 'pipe' }) } catch (e) { info = e.stderr }
        assert.match(info, /Video: vp9/, `${out}`)
      }
      assert.ok(!existsSync(v3.replace(/\.mp4$/, '_converted.webm')), 'cancelled job left an output')

      // Cancel all on a fresh batch.
      await launchEach('--sorai-preset=video-to-webm', [v4, v5])
      await until('rows 6-7', async () => Object.keys(await statuses(progress)).length === 7)
      await progress.locator('.progress-cancel-all').click()
      await until('both cancelled', async () => {
        const s = await statuses(progress)
        return s[v4] === 'cancelled' && s[v5] === 'cancelled'
      }, 30_000)

      // Failures keep the window; the app and its queue are untouched.
      await sleep(4000)
      assert.equal((await progressPages(browser)).length, 1, 'progress window closed despite failures')
      assert.equal(await invoke(page, 'plugin:window|is_visible', { label: 'main' }), true)

      // A later all-success run toasts like a fresh window, but the earlier
      // failures still keep the window open.
      const toasts = []
      await progress.route(/ipc\.localhost\/notify_done/, (r) => {
        toasts.push(r.request().postDataJSON())
        return r.fulfill({ status: 200, headers: { 'Tauri-Response': 'ok', 'Content-Type': 'application/json' }, body: 'null' })
      })
      await launchEach('--sorai-preset=video-to-webm', [v6])
      await until('v6 to succeed', async () => (await statuses(progress))[v6] === 'success', 60_000)
      await until('the toast', () => toasts.length === 1, 5000)
      assert.equal(toasts[0].reveal, v6.replace(/\.mp4$/, '_converted.webm'))
      await sleep(4000)
      assert.equal((await progressPages(browser)).length, 1, 'progress window closed despite earlier failures')

      // X mid-run: the job is cancelled (no ffmpeg left, no partial output), then the window closes.
      await launchEach('--sorai-preset=video-to-webm', [v7])
      await until('v7 to run', async () => (await statuses(progress))[v7] === 'running')
      await until('its ffmpeg', () => ourFfmpeg().length > 0, 15_000)
      await invoke(progress, 'plugin:window|close', { label: 'progress' }).catch(() => {}) // page dies mid-call
      await until('the progress window to go', async () => (await progressPages(browser)).length === 0)
      assert.deepEqual(ourFfmpeg(), [], 'ffmpeg still running after closing the progress window')
      assert.ok(!existsSync(v7.replace(/\.mp4$/, '_converted.webm')), 'closing mid-run left an output')
      await sleep(1000)
      assert.equal(appCount(), 1, 'app exited with the main window open')
      const titles = await page.locator('.file-item .queue-item-title').evaluateAll((els) => els.map((e) => e.getAttribute('title')))
      assert.deepEqual(titles, [queued])
    } finally {
      // A leftover progress window would keep the app alive for zzz-preset-cold.
      for (const p of await progressPages(browser)) {
        await p.evaluate(() => document.querySelector('.progress-cancel-all')?.click()).catch(() => {})
        await invoke(p, 'plugin:window|destroy', { label: 'progress' }).catch(() => {})
      }
      if (await page.locator('[aria-label="Back to hub"]').count()) {
        while ((await page.locator('.file-item').count()) > 0) await page.locator('.file-item').first().locator('button.remove').click()
        await page.locator('[aria-label="Back to hub"]').click()
        await page.locator('.hub-card').first().waitFor()
      }
    }
  },
}
