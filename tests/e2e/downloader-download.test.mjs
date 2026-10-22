// Downloader queue through the real plugin: yt-dlp sidecar spawned by the
// Rust job runner, ffmpeg sidecar for merging. Ported from the old
// tests/test_download.js. Needs network.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stubDialogs } from './helpers.mjs'

const hub = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ffmpeg = join(hub, 'binaries', 'win_x64', 'ffmpeg.exe')
const ZOO = 'https://www.youtube.com/watch?v=jNQXAC9IVRw' // 19s, small
const LONG = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' // Big Buck Bunny, 10min: still running when we cancel

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function streams(file) {
  const out = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr
  return { video: /Stream #\d+:\d+.*Video:/.test(out), audio: /Stream #\d+:\d+.*Audio:/.test(out) }
}

function seconds(file) {
  const out = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr
  const [, h, m, s] = out.match(/Duration: (\d+):(\d+):([\d.]+)/) ?? []
  return h == null ? NaN : h * 3600 + m * 60 + Number(s)
}

// Same synthetic drag the slider handler listens for (mousedown on the
// thumb, mousemove/mouseup on window) -- separate evaluates so React has
// flushed the mousedown state before mousemove reads it. No real mouse.
async function dragThumb(page, id, sec, total) {
  const { x, y } = await page.$eval('#clip-slider-container', (el, f) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + f * r.width, y: r.top + r.height / 2 }
  }, sec / total)
  await page.$eval(`#${id}`, (el, p) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: p.x, clientY: p.y })), { x, y })
  await page.evaluate((p) => window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: p.x, clientY: p.y })), { x, y })
  await page.evaluate((p) => window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: p.x, clientY: p.y })), { x, y })
}

// yt-dlp / ffmpeg processes started from THIS worktree's dev build (other
// worktrees' E2E runs may have their own going at the same time).
function ourSidecars() {
  const dir = join(hub, 'src-tauri', 'target')
  const ps = `Get-CimInstance Win32_Process | ? { $_.ExecutablePath -and $_.ExecutablePath.StartsWith('${dir}', 'OrdinalIgnoreCase') -and $_.Name -match '^(yt-dlp|ffmpeg)' } | % { $_.Name }`
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' })
  return r.stdout.split(/\r?\n/).filter(Boolean)
}

// Open Downloader, add `url`, pick a fresh output folder (Chinese + space in
// the path) through the stubbed folder dialog.
async function prepare(page, url) {
  const out = mkdtempSync(join(tmpdir(), 'sorai 下載 '))
  await page.click('.hub-card:has-text("Downloader")')
  await page.locator('#url-panel').waitFor()
  await stubDialogs(page, { openFolder: out })
  await page.fill('#video-url', url)
  await page.click('#btn-fetch')
  await page.waitForFunction(() => document.querySelectorAll('#video-format-select option').length > 0, null, { timeout: 60_000 })
  await page.click('#btn-select-output')
  await page.waitForFunction((d) => document.getElementById('output-path').value === d, out)
  return out
}

const itemState = (page) => page.textContent('.queue-item-state')
const toggle = (page, id) => page.$eval(`#${id}`, (el) => el.click())

async function download(page, out) {
  await page.click('#btn-download')
  await page.waitForFunction(
    () => /^(Done|Failed|Cancelled)$/.test(document.querySelector('.queue-item-state')?.textContent ?? ''),
    null,
    { timeout: 180_000 },
  )
  const title = await page.getAttribute('.queue-item-state', 'title')
  assert.equal(await itemState(page), 'Done', title ?? '')
  return readdirSync(out).map((f) => join(out, f))
}

async function leave(page, out) {
  if (await page.locator('#btn-clear-queue').count()) await page.click('#btn-clear-queue')
  await page.click('.logo-mark-button')
  await page.locator('.hub-card').first().waitFor()
  rmSync(out, { recursive: true, force: true })
}

export const tests = {
  'downloader: a video-only pick is merged with bestaudio into one mp4': async ({ page }) => {
    const out = await prepare(page, ZOO)
    try {
      const files = await download(page, out)
      assert.equal(files.length, 1, files.join(', '))
      assert.match(files[0], /\.mp4$/)
      assert.deepEqual(streams(files[0]), { video: true, audio: true })
    } finally {
      await leave(page, out)
    }
  },

  'downloader: audio only produces one audio-only file': async ({ page }) => {
    const out = await prepare(page, ZOO)
    try {
      await toggle(page, 'include-video-checkbox')
      const files = await download(page, out)
      assert.equal(files.length, 1, files.join(', '))
      assert.deepEqual(streams(files[0]), { video: false, audio: true })
    } finally {
      await leave(page, out)
    }
  },

  'downloader: merge off saves video and audio as two files named by format id': async ({ page }) => {
    const out = await prepare(page, ZOO)
    try {
      await toggle(page, 'auto-merge-checkbox')
      const files = await download(page, out)
      assert.equal(files.length, 2, files.join(', '))
      for (const f of files) assert.match(f, /\[[^\]]+\]\.\w+$/)
      const kinds = files.map(streams).map((s) => `${s.video}/${s.audio}`).sort()
      assert.deepEqual(kinds, ['false/true', 'true/false'])
    } finally {
      await leave(page, out)
    }
  },

  'downloader: a 2s-6s ClipModal range downloads a ~4s file, progress never shows NaN': async ({ page }) => {
    const out = await prepare(page, ZOO)
    try {
      await page.click('.queue-item .btn-trim')
      await page.locator('#clip-modal:not(.hidden)').waitFor()
      const total = await page.$eval('#clip-label-end', (el) => parseFloat(el.textContent))
      assert.ok(total > 15, `full duration by default, got ${total}`)
      await dragThumb(page, 'clip-thumb-left', 2, total)
      await dragThumb(page, 'clip-thumb-right', 6, total)
      const start = await page.$eval('#clip-label-start', (el) => parseFloat(el.textContent))
      const end = await page.$eval('#clip-label-end', (el) => parseFloat(el.textContent))
      assert.ok(Math.abs(start - 2) < 0.3 && Math.abs(end - 6) < 0.3, `range ${start}-${end}`)
      await page.click('#btn-save-clip')
      await page.locator('#clip-modal').waitFor({ state: 'hidden' })
      assert.equal(await page.textContent('.queue-item .val-chip.secondary.tabular-nums'), '0:02–0:06')
      // Record every progress text the clip download shows (yt-dlp reports
      // N/A percent while ffmpeg does the cut).
      await page.evaluate(() => {
        window.__clipTexts = []
        const el = document.getElementById('progress-text')
        new MutationObserver(() => window.__clipTexts.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true })
      })
      const files = await download(page, out)
      const texts = await page.evaluate(() => window.__clipTexts)
      assert.ok(!texts.some((t) => /NaN/.test(t)), texts.join(' | '))
      assert.equal(files.length, 1, files.join(', '))
      const len = seconds(files[0])
      assert.ok(Math.abs(len - 4) <= 1.5, `clip length ${len}s, want 4±1.5`)
    } finally {
      await leave(page, out)
    }
  },

  'downloader: removing items mid-run (an earlier one, then the active one) does not stop or skip the rest': async ({ page }) => {
    const out = await prepare(page, ZOO)
    try {
      for (const url of [LONG, ZOO]) {
        await page.fill('#video-url', url)
        await page.click('#btn-fetch')
      }
      await page.waitForFunction(() => document.querySelectorAll('.queue-item .btn-trim').length === 3, null, { timeout: 90_000 })
      const state = (i) => page.locator('.queue-item').nth(i).locator('.queue-item-state').textContent()
      await page.click('#btn-download')
      await page.waitForFunction(
        () => {
          const s = [...document.querySelectorAll('.queue-item .queue-item-state')].map((e) => e.textContent)
          return s[0] === 'Done' && /\d%/.test(s[1])
        },
        null,
        { timeout: 180_000 },
      )
      await page.locator('.queue-item').nth(0).locator('button.remove').click() // earlier item: no index shift skip
      await page.waitForFunction(() => document.querySelectorAll('.queue-item').length === 2)
      await page.locator('.queue-item').nth(0).locator('button.remove').click() // the active one: cancels just it
      await page.waitForFunction(() => document.querySelectorAll('.queue-item').length === 1)
      await page.waitForFunction(() => document.querySelector('.queue-item .queue-item-state')?.textContent === 'Done', null, { timeout: 180_000 })
      assert.equal(await state(0), 'Done')
      assert.doesNotMatch(await page.textContent('.statusbar-text'), /Cancelled/)
    } finally {
      await leave(page, out)
    }
  },

  'downloader: cancel stops yt-dlp, item is cancelled, no process left': async ({ page }) => {
    const out = await prepare(page, LONG)
    try {
      await page.click('#btn-download')
      // Real progress line with speed: the download is actually under way.
      await page.waitForFunction(() => /\d% · \S/.test(document.getElementById('progress-text')?.textContent ?? ''), null, {
        timeout: 60_000,
      })
      assert.ok(ourSidecars().length > 0, 'yt-dlp should be running before cancel')
      await page.click('#btn-download') // same id, now the Cancel button
      await page.waitForFunction(() => document.querySelector('.queue-item-state')?.textContent === 'Cancelled', null, {
        timeout: 10_000,
      })
      let left = ourSidecars()
      for (let i = 0; i < 10 && left.length; i++) await sleep(500), (left = ourSidecars())
      assert.deepEqual(left, [])
      assert.match(await page.textContent('.statusbar-text'), /Cancelled/)
    } finally {
      await leave(page, out)
    }
  },
}
