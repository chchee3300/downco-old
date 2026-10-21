import assert from 'node:assert/strict'
import { invoke, appRunning } from './helpers.mjs'

// Runs last (file name sorts last): it ends the app, so nothing can follow it.
export const tests = {
  'close with "quit" ends the process': async ({ page }) => {
    await page.locator('.hamburger-menu > button').first().click()
    await page.locator('.hamburger-item:has-text("Settings")').click()
    await page.locator('.settings-radio-option:has-text("Quit the app") input').check()
    await page.locator('.settings-modal-content button:has-text("Close")').click()
    assert.equal(appRunning(), true)
    await invoke(page, 'plugin:window|close', { label: 'main' }).catch(() => {}) // page dies mid-call
    for (let i = 0; i < 50 && appRunning(); i++) await new Promise((r) => setTimeout(r, 200))
    assert.equal(appRunning(), false)
  },
}
