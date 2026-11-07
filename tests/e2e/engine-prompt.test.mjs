// The Converter's first-run engine prompt (converter EnginePrompt.jsx):
// shown on the first visit only (`prompted` in engines.json; run.mjs sets
// it for every other test, these reset it). Install from the prompt uses
// the fake package (run.mjs points the dev build at CDP_PORT+2); closing
// the prompt keeps it going, Settings shows the same progress, and a
// notification says when it's done.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { invoke } from './helpers.mjs'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures')
const enginesJson = join(process.env.APPDATA, `com.soraitoolkit.hub.dev${process.env.CDP_PORT || 9229}`, 'engines.json')
const prompted = () => JSON.parse(readFileSync(enginesJson, 'utf8')).prompted === true
const prompt = '#engine-prompt .modal-content'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// A fresh user: no Ghostscript of ours or picked, never prompted. Returns
// false when this machine has a system Ghostscript (then no prompt is due).
async function reset(page) {
  await invoke(page, 'plugin:sorai-converter|engine_remove', { engine: 'ghostscript' })
  await invoke(page, 'plugin:sorai-converter|engine_set_path', { engine: 'ghostscript', path: null })
  await invoke(page, 'plugin:sorai-converter|engine_set_prompted', { prompted: false })
  return invoke(page, 'plugin:sorai-converter|engine_prompt')
}

const enter = (page) => page.locator('.hub-card:has-text("Converter")').click()
async function backToHub(page) {
  await page.locator('[aria-label="Back to hub"]').click()
  await page.locator('.hub-card').first().waitFor()
}

export const tests = {
  'engine prompt: first Converter visit asks once; Skip and it never comes back': async ({ page }) => {
    try {
      if (!(await reset(page))) return console.log('       (system Ghostscript found: no prompt due, skipped)')
      await enter(page)
      await page.locator(prompt).waitFor()
      const card = page.locator(`${prompt} .engine-card[data-id="ghostscript"]`)
      const text = await card.innerText()
      assert.match(text, /Ghostscript/)
      assert.match(text, /AGPL-3\.0/)
      assert.match(text, /MB/)
      assert.equal(await card.locator('input[type="checkbox"]').isChecked(), true)
      await page.locator('#btn-engine-prompt-skip').click()
      await page.locator(prompt).waitFor({ state: 'hidden' })
      assert.ok(prompted(), 'engines.json prompted')

      await backToHub(page)
      await enter(page)
      await page.locator('#input-panel').waitFor()
      await sleep(1000)
      assert.equal(await page.locator(`${prompt}:visible`).count(), 0, 'prompt came back')
      assert.equal(await invoke(page, 'plugin:sorai-converter|engine_prompt'), false)
    } finally {
      await invoke(page, 'plugin:sorai-converter|engine_set_prompted', { prompted: true })
      if (await page.locator('[aria-label="Back to hub"]').count()) await backToHub(page)
    }
  },

  'engine prompt: Install selected shows progress, keeps going after closing (Settings shows it), notifies when done': async ({ page }) => {
    const conda = readFileSync(join(fixtures, 'fake-ghostscript.conda'))
    let release
    const released = new Promise((r) => (release = r))
    // Half the package, then the rest once the prompt is closed.
    const server = createServer(async (req, res) => {
      res.writeHead(200, { 'Content-Length': conda.length })
      res.write(conda.subarray(0, conda.length / 2))
      await released
      res.end(conda.subarray(conda.length / 2))
    })
    await new Promise((r) => server.listen(Number(process.env.CDP_PORT || 9229) + 2, '127.0.0.1', r))
    try {
      if (!(await reset(page))) return console.log('       (system Ghostscript found: no prompt due, skipped)')
      // Count notifications (the Tauri plugin's window.Notification).
      await page.evaluate(() => {
        window.__realNotification = window.Notification
        window.__notes = []
        window.Notification = class {
          static permission = 'granted'
          static requestPermission = async () => 'granted'
          constructor(title, o) { window.__notes.push([title, o?.body]) }
        }
      })
      await enter(page)
      await page.locator(prompt).waitFor()
      await page.locator('#btn-engine-prompt-install').click()
      await page.waitForFunction(() => Number(document.querySelector('#engine-prompt .engine-progress progress')?.value) > 0, null, { timeout: 30_000 })
      assert.match(await page.locator(`${prompt} .engine-progress`).innerText(), /Downloading… \d+%/)
      assert.ok(prompted(), 'prompted as soon as Install was chosen')

      // Close: the download carries on; Settings shows the same progress.
      await page.locator('#btn-engine-prompt-close').click()
      await page.locator(prompt).waitFor({ state: 'hidden' })
      await page.evaluate(() => window.SoraiSettings.open('engines', 'ghostscript'))
      const row = page.locator('#settings-engines .engine-detail[data-id="ghostscript"]')
      await row.locator('.engine-progress').waitFor()
      assert.equal(await row.locator('.engine-install').count(), 0)
      await page.locator('.settings-modal-content .about-modal-close').click()
      assert.deepEqual(await page.evaluate(() => window.__notes), [])

      release()
      await page.waitForFunction(() => window.__notes.length > 0, null, { timeout: 30_000 })
      const [[title, body]] = await page.evaluate(() => window.__notes)
      assert.match(`${title} ${body}`, /Ghostscript/)
      assert.match(body, /installed/i)
      assert.equal((await invoke(page, 'plugin:sorai-converter|engine_status'))[0].installed, true)
      await page.evaluate(() => window.SoraiSettings.open('engines', 'ghostscript'))
      await page.locator('#settings-engines .engine-detail[data-id="ghostscript"][data-state="installed"]').waitFor()
      await page.locator('.settings-modal-content .about-modal-close').click()
    } finally {
      release()
      server.closeAllConnections()
      server.close()
      await page.evaluate(() => { if (window.__realNotification) window.Notification = window.__realNotification })
      await invoke(page, 'plugin:sorai-converter|engine_cancel').catch(() => {})
      await sleep(500)
      await invoke(page, 'plugin:sorai-converter|engine_remove', { engine: 'ghostscript' }).catch(() => {})
      await invoke(page, 'plugin:sorai-converter|engine_set_prompted', { prompted: true })
      if (await page.locator('.settings-modal-content .about-modal-close:visible').count()) await page.locator('.settings-modal-content .about-modal-close').click()
      if (await page.locator(`${prompt}:visible`).count()) await page.locator('#btn-engine-prompt-skip, #btn-engine-prompt-close').first().click()
      if (await page.locator('[aria-label="Back to hub"]').count()) await backToHub(page)
    }
  },
}
