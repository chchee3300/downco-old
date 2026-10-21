// Converter: adding files through the (stubbed) Browse dialog -> queue rows
// with thumbnail + source info, duplicates skipped. Drag-and-drop itself
// can't be automated (Playwright DOM drags never reach Tauri's native drop
// path) -- that's a real-mouse check.
import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stubDialogs } from './helpers.mjs'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures')
// Chinese + spaces in both the folder and the file names.
const dir = mkdtempSync(join(tmpdir(), 'sorai 轉檔 '))
const clipA = join(dir, '測試 影片 一.mp4')
const clipB = join(dir, 'clip two.mp4')
copyFileSync(join(fixtures, 'test_fps.mp4'), clipA)
copyFileSync(join(fixtures, 'test_fixture_video.mp4'), clipB)

const rows = (page) => page.locator('.file-item')

async function openConverter(page) {
  await page.locator('.hub-card:has-text("Converter")').click()
  await page.locator('.drop-zone-message').waitFor()
}

async function backToHub(page) {
  while ((await rows(page).count()) > 0) await rows(page).first().locator('button.remove').click()
  await page.locator('[aria-label="Back to hub"]').click()
  await page.locator('.hub-card').first().waitFor()
}

export const tests = {
  'converter: browse adds files with thumbnail and source info, skips duplicates': async ({ page }) => {
    await openConverter(page)
    try {
      await stubDialogs(page, { openFiles: [clipA, clipB] })
      await page.locator('.drop-zone-message').click()
      await page.waitForFunction(() => document.querySelectorAll('.file-item img.queue-item-thumb').length === 2, null, { timeout: 30_000 })

      assert.equal(await rows(page).count(), 2)
      const a = rows(page).nth(0)
      assert.equal(await a.locator('.queue-item-title').textContent(), '測試 影片 一.mp4')
      assert.equal(await a.locator('.queue-item-title').getAttribute('title'), clipA)
      // test_fps.mp4: 320x240, 2 s, 30 fps, h264
      assert.match(await a.locator('.queue-item-channel').textContent(), /320x240 · 0:02/)
      const meta = await a.locator('.queue-item-meta').textContent()
      assert.match(meta, /30 fps/i)
      assert.match(meta, /H264/)

      // Thumbnails really load through the asset protocol (not just a src).
      const thumbs = await page.$$eval('.file-item img.queue-item-thumb', (imgs) =>
        Promise.all(imgs.map((i) => i.decode().then(() => [i.src, i.naturalWidth], () => [i.src, 0]))),
      )
      for (const [src, w] of thumbs) {
        assert.match(src, /^http:\/\/asset\.localhost\//)
        assert.equal(w, 160, `thumbnail ${src} did not load`)
      }

      // Same file again (plus a folder, which must be skipped, not crash).
      await stubDialogs(page, { openFiles: [clipA, dir] })
      await page.locator('#btn-add-files').click()
      await page.waitForFunction(() => /skipped/i.test(document.body.innerText), null, { timeout: 10_000 })
      assert.equal(await rows(page).count(), 2)
    } finally {
      await backToHub(page)
    }
  },
}
