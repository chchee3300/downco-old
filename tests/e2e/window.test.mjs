import assert from 'node:assert/strict'
import { invoke, appRunning } from './helpers.mjs'

const win = (page, cmd) => invoke(page, `plugin:window|${cmd}`, { label: 'main' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Pick a close behavior through the real Settings modal (also proves it works).
async function pickCloseBehavior(page, label) {
  await page.locator('.hamburger-menu > button').first().click()
  await page.locator('.hamburger-item:has-text("Settings")').click()
  await page.locator(`.settings-radio-option:has-text("${label}") input`).check()
  await page.locator('.settings-modal-content button:has-text("Close")').click()
}

export const tests = {
  'window is shown and focused after startup (created hidden)': async ({ page }) => {
    await page.locator('.hub-card').first().waitFor()
    for (let i = 0; i < 50 && !(await win(page, 'is_visible')); i++) await sleep(100)
    assert.equal(await win(page, 'is_visible'), true)
  },

  'theme toggle swaps the window icon without errors': async ({ page }) => {
    const errors = []
    const onConsole = (m) => m.type() === 'error' && errors.push(m.text())
    const onError = (e) => errors.push(String(e))
    page.on('console', onConsole)
    page.on('pageerror', onError)
    const before = await page.evaluate(() => document.documentElement.dataset.theme)
    await page.locator('.hamburger-menu > button').first().click()
    const toggle = page.locator('.hamburger-item:has-text("Appearance")')
    await toggle.click()
    await toggle.click()
    await sleep(500)
    page.off('console', onConsole)
    page.off('pageerror', onError)
    await page.keyboard.press('Escape')
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), before)
    assert.deepEqual(errors, [])
  },

  'close with "ask" shows the confirm modal and keeps the window': async ({ page }) => {
    await pickCloseBehavior(page, 'Ask me every time')
    await win(page, 'close')
    await page.locator('.modal-overlay:not(.hidden) #close-confirm-title').waitFor()
    assert.equal(await win(page, 'is_visible'), true)
    await page.keyboard.press('Escape')
    await page.locator('.modal-overlay:not(.hidden) #close-confirm-title').waitFor({ state: 'detached' }).catch(() => {})
    assert.equal(await page.locator('.modal-overlay:not(.hidden) #close-confirm-title').count(), 0)
  },

  'close with "tray" hides the window, creates the tray, process stays': async ({ page }) => {
    await pickCloseBehavior(page, 'Minimize to the system tray')
    const errors = []
    const onConsole = (m) => m.type() === 'error' && errors.push(m.text())
    page.on('console', onConsole)
    await win(page, 'close')
    for (let i = 0; i < 50 && (await win(page, 'is_visible')); i++) await sleep(100)
    page.off('console', onConsole)
    assert.deepEqual(errors, [])
    assert.equal(await win(page, 'is_visible'), false)
    assert.notEqual(await invoke(page, 'plugin:tray|get_by_id', { id: 'sorai-tray' }), null)
    // Tray icon colour follows the taskbar's own light/dark setting.
    if (process.platform === 'win32') {
      const { execSync } = await import('node:child_process')
      const reg = execSync('reg query HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize /v SystemUsesLightTheme').toString()
      assert.equal(await invoke(page, 'taskbar_is_light'), /0x1\b/.test(reg))
    }
    assert.equal(appRunning(), true)
    await win(page, 'show') // tray "Open" needs a real mouse; restore directly
    assert.equal(await win(page, 'is_visible'), true)
  },
}
