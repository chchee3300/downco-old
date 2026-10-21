import assert from 'node:assert/strict'
import { invoke, stubDialogs } from './helpers.mjs'

export const tests = {
  'hub shows both tool cards': async ({ page }) => {
    await page.locator('.hub-card').first().waitFor()
    assert.equal(await page.locator('.hub-card').count(), 2)
    assert.equal(await page.locator('.hub-card:has-text("Converter")').count(), 1)
    assert.equal(await page.locator('.hub-card:has-text("Downloader")').count(), 1)
  },

  'converter plugin answers ping': async ({ page }) => {
    assert.equal(await invoke(page, 'plugin:sorai-converter|ping', { value: 'e2e' }), 'sorai-converter pong: e2e')
  },

  'downloader plugin answers ping': async ({ page }) => {
    assert.equal(await invoke(page, 'plugin:sorai-downloader|ping', { value: 'e2e' }), 'sorai-downloader pong: e2e')
  },

  'native dialogs can be stubbed in the window': async ({ page }) => {
    await stubDialogs(page, { openFiles: ['C:\a b\clip.mp4'], openFolder: 'C:\out' })
    assert.deepEqual(await page.evaluate(() => window.SoraiDialogs.openFiles()), ['C:\a b\clip.mp4'])
    assert.equal(await page.evaluate(() => window.SoraiDialogs.openFolder()), 'C:\out')
  },
}
