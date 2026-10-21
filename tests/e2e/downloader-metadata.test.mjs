// Downloader metadata through the real plugin (yt-dlp sidecar -> Rust parse).
// Needs network: "Me at the zoo" is the first YouTube video, short and stable.
import assert from 'node:assert/strict'

const ZOO = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'

async function openDownloader(page) {
  await page.click('.hub-card:has-text("Downloader")')
  await page.locator('#url-panel').waitFor()
}

async function add(page, url) {
  await page.fill('#video-url', url)
  await page.click('#btn-fetch')
}

const backToHub = (page) => page.click('.logo-mark-button')

export const tests = {
  'downloader: pasting a YouTube URL shows title and formats': async ({ page }) => {
    await openDownloader(page)
    try {
      await add(page, ZOO)
      // Native <select> is display:none (GlassSelect overlay) -- wait on options.
      await page.waitForFunction(
        () => document.querySelectorAll('#video-format-select option').length > 0,
        null,
        { timeout: 60_000 },
      )
      assert.equal(await page.textContent('.queue-item-title'), 'Me at the zoo')
      assert.equal(await page.locator('img.queue-item-thumb').count(), 1)
      const labels = (sel) => page.$$eval(`${sel} option`, (os) => os.map((o) => o.textContent))
      const video = await labels('#video-format-select')
      const audio = await labels('#audio-format-select')
      assert.ok(audio.length > 0, 'audio options')
      for (const l of [...video, ...audio]) assert.doesNotMatch(l, /webm|mhtml/, l)
      // Best defaults: highest video tier, highest-bitrate audio, all three toggles on.
      assert.match(await page.$eval('#video-format-select', (s) => s.selectedOptions[0].textContent), /^240p/)
      assert.ok(await page.evaluate(() => ['include-video-checkbox', 'include-audio-checkbox', 'auto-merge-checkbox']
        .every((id) => document.getElementById(id).checked)))
    } finally {
      await backToHub(page)
    }
  },

  'downloader: an invalid URL shows the yt-dlp error on the item': async ({ page }) => {
    await openDownloader(page)
    try {
      await add(page, 'not a url')
      const err = page.locator('.queue-item-meta', { hasText: 'is not a valid URL' })
      await err.waitFor({ timeout: 30_000 })
      assert.match(await err.textContent(), /ERROR: .*'not a url' is not a valid URL/)
    } finally {
      await backToHub(page)
    }
  },
}
