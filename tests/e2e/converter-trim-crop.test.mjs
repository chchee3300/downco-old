// Trim / Crop modals end to end (ported from the Neutralino-era test_crop_ui.js):
// the preview really loads through the asset protocol (queued file added to
// the scope at runtime, nothing else readable), the crop rect drags / snaps /
// clears, and real ffmpeg output has the cropped size / trimmed length.
// Crop / trim ffmpeg args themselves are cargo-tested in the converter plugin.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stubDialogs } from './helpers.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const fixtures = join(root, 'tests', 'fixtures')
const FFMPEG = join(root, 'binaries', 'win_x64', 'ffmpeg.exe')
const dir = mkdtempSync(join(tmpdir(), 'sorai 剪輯 裁切 '))

function probe(file) {
  let out = ''
  try {
    execFileSync(FFMPEG, ['-hide_banner', '-i', file], { stdio: 'pipe' })
  } catch (e) {
    out = String(e.stderr) // -i without output always exits 1
  }
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(out)
  const wh = /Stream #.*Video:.*?, (\d+)x(\d+)/.exec(out)
  return { duration: d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : 0, width: wh ? +wh[1] : 0, height: wh ? +wh[2] : 0 }
}

async function open(page, files) {
  await page.locator('.hub-card:has-text("Converter")').click()
  await page.locator('.drop-zone-message').waitFor()
  await stubDialogs(page, { openFiles: files })
  await page.locator('.drop-zone-message').click()
  await page.waitForFunction((n) => document.querySelectorAll('.file-item').length === n, files.length, { timeout: 30_000 })
}

async function backToHub(page) {
  await page.waitForFunction(() => !/Cancel/.test(document.getElementById('btn-execute')?.textContent ?? ''), null, { timeout: 30_000 })
  for (const m of ['#crop-modal', '#trim-modal']) {
    if (await page.locator(`${m}:not(.hidden)`).count()) await page.keyboard.press('Escape')
  }
  while ((await page.locator('.file-item').count()) > 0) await page.locator('.file-item').first().locator('button.remove').click()
  await page.locator('[aria-label="Back to hub"]').click()
  await page.locator('.hub-card').first().waitFor()
}

const set = (page, selector, value) =>
  page.evaluate(([sel, v]) => {
    const el = document.querySelector(sel)
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, [selector, String(value)])

async function run(page) {
  await page.click('#btn-execute')
  await page.waitForFunction(() => document.getElementById('terminal-log').innerText.includes('> Executing:'), null, { timeout: 20_000 })
  await page.waitForFunction(() => /^(Completed|Cancelled)/.test(document.getElementById('progress-text').innerText), null, { timeout: 60_000 })
  return page.locator('#progress-text').innerText()
}

const dims = async (page) => {
  const m = /(\d+)\s*x\s*(\d+)/.exec(await page.locator('#crop-dims-label').innerText())
  return m ? [+m[1], +m[2]] : null
}
const closed = (page, id) => page.waitForFunction((i) => document.getElementById(i).classList.contains('hidden'), id)

export const tests = {
  'converter: crop preview loads via asset protocol, drag + save crops the real output': async ({ page }) => {
    const img = join(dir, '裁切 圖.png')
    copyFileSync(join(fixtures, 'test_in.png'), img) // 320x240
    const notQueued = join(dir, 'not queued.png')
    copyFileSync(join(fixtures, 'test_in.png'), notQueued)
    await open(page, [img])
    try {
      assert.ok(await page.isVisible('#btn-crop-0'))
      await set(page, '#image-scale', 50)
      assert.match(await page.locator('#file-resolution-0').innerText(), /160 x 120/)

      await page.click('#btn-crop-0')
      await page.locator('#crop-modal:not(.hidden)').waitFor()
      // Preview decoded from http://asset.localhost/<queued path>.
      await page.waitForFunction(() => document.querySelector('#crop-container img')?.naturalWidth === 320, null, { timeout: 10_000 })
      assert.match(await page.locator('#crop-container img').first().getAttribute('src'), /^http:\/\/asset\.localhost\//)
      // Scope is per queued file: a sibling that was never queued is refused.
      const status = await page.evaluate(async (p) => {
        try {
          return (await fetch(window.__TAURI_INTERNALS__.convertFileSrc(p))).status
        } catch {
          return 'blocked'
        }
      }, notQueued)
      assert.notEqual(status, 200, 'unqueued file readable through the asset protocol')
      assert.deepEqual(await dims(page), [320, 240])

      await page.click('#crop-ratio-1\\:1')
      const [sw, sh] = await dims(page)
      assert.equal(sw, sh, '1:1 preset is square')

      // Clear back to the full frame, then drag the SE handle to the center.
      await page.click('#btn-clear-crop')
      const box = await page.locator('#crop-container').boundingBox()
      await page.mouse.move(box.x + box.width - 1, box.y + box.height - 1)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 })
      await page.mouse.up()
      const [w, h] = await dims(page)
      assert.ok(w > 0 && w < 300 && h > 0 && h < 220, `dragged to ${w}x${h}`)

      await page.click('#crop-modal .btn-primary') // Save
      await closed(page, 'crop-modal')
      assert.match(await page.locator('#file-item-0').innerText(), /Crop:\s*\d+x\d+/)
      const [ew, eh] = [Math.round(w * 0.5), Math.round(h * 0.5)]
      const r = /(\d+)\s*x\s*(\d+)/.exec(await page.locator('#file-resolution-0').innerText())
      assert.ok(r && Math.abs(+r[1] - ew) <= 1 && Math.abs(+r[2] - eh) <= 1, `preview ${r?.[0]} vs ~${ew}x${eh}`)

      await set(page, '#image-format', '.jpg')
      assert.match(await run(page), /^Completed 1 of 1/)
      assert.match(await page.locator('#terminal-log').innerText(), /crop=\d+:\d+:\d+:\d+,scale=/)
      const out = probe(join(dir, '裁切 圖_converted.jpg'))
      assert.ok(Math.abs(out.width - ew) <= 2 && Math.abs(out.height - eh) <= 2, `output ${out.width}x${out.height} vs ~${ew}x${eh}`)

      // Clear Crop round-trips to "no crop".
      await page.click('#btn-crop-0')
      await page.locator('#crop-modal:not(.hidden)').waitFor()
      await page.click('#btn-clear-crop')
      await page.click('#crop-modal .btn-primary')
      await closed(page, 'crop-modal')
      assert.doesNotMatch(await page.locator('#file-item-0').innerText(), /Crop:/)
    } finally {
      await backToHub(page)
    }
  },

  'converter: trim preview plays via asset protocol, set start/end trims the real output': async ({ page }) => {
    const clip = join(dir, '剪輯 影片.mp4')
    copyFileSync(join(fixtures, 'test_fixture_video.mp4'), clip) // 2 s
    await open(page, [clip])
    try {
      await page.locator('#file-item-0 .btn-trim').click()
      await page.locator('#trim-modal:not(.hidden)').waitFor()
      // Seeking needs the asset protocol's Range support, not just a load.
      const seek = (t) =>
        page.evaluate(
          (t) =>
            new Promise((resolve, reject) => {
              const v = document.getElementById('trim-video-player')
              const go = () => {
                v.addEventListener('seeked', resolve, { once: true })
                v.currentTime = t
              }
              if (v.error) return reject(new Error(`media error ${v.error.code}`))
              if (v.readyState >= 1) go()
              else v.addEventListener('loadedmetadata', go, { once: true })
              setTimeout(() => reject(new Error(`no seek (readyState ${v.readyState}, error ${v.error?.code})`)), 10_000)
            }),
          t,
        )
      await seek(0.5)
      assert.match(await page.locator('#trim-video-player').getAttribute('src'), /^http:\/\/asset\.localhost\//)
      assert.ok(await page.evaluate(() => Math.abs(document.getElementById('trim-video-player').duration - 2) < 0.2))
      await page.click('#btn-set-start')
      await seek(1.5)
      await page.click('#btn-set-end')
      await page.click('#btn-save-trim')
      await closed(page, 'trim-modal')
      assert.match(await page.locator('#file-item-0').innerText(), /Trim: 1\.0\ds/)

      assert.match(await run(page), /^Completed 1 of 1/)
      const out = probe(join(dir, '剪輯 影片_converted.mp4'))
      assert.ok(Math.abs(out.duration - 1) < 0.15, `trimmed output ${out.duration} s (want ~1 s)`)
    } finally {
      await backToHub(page)
    }
  },
}
