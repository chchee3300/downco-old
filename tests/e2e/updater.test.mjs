import assert from 'node:assert/strict'

const API = 'https://api.github.com/repos/chchee3300/sorai-toolkit/releases/latest'
const IPC_OPEN = 'http://ipc.localhost/plugin%3Aopener%7Copen_url'
const RELEASE_URL = 'https://github.com/chchee3300/sorai-toolkit/releases/tag/v999.0.0'

export const tests = {
  // Dev builds never set VITE_OFFICIAL_BUILD, so this is the self-built path.
  'self-built: fake new release -> badges, no toast, About opens release page': async ({ page }) => {
    await page.route(API, (route) =>
      route.fulfill({ json: { tag_name: 'v999.0.0', name: 'Fake release', html_url: RELEASE_URL, assets: [] } }),
    )
    // Swallow opener IPC (Tauri posts commands to ipc.localhost) so no real
    // browser opens; __TAURI_INTERNALS__.invoke itself is non-writable.
    const opened = []
    await page.route(IPC_OPEN, (route) => {
      opened.push(JSON.parse(route.request().postData()))
      route.fulfill({ status: 200, headers: { 'Tauri-Response': 'ok', 'Content-Type': 'application/json' }, body: 'null' })
    })
    try {
      await page.click('#hamburger-toggle')
      await page.click('[role=menuitem]:has-text("Check for updates")')
      await page.locator('#hamburger-toggle .hb-badge-dot').waitFor()
      assert.equal(await page.locator('.update-toast').count(), 0)

      await page.click('#hamburger-toggle')
      assert.equal(await page.locator('[role=menuitem]:has-text("About") .hb-badge-dot').count(), 1)
      await page.click('[role=menuitem]:has-text("About")')
      await page.locator('.about-modal-update:has-text("v999.0.0")').waitFor()
      await page.click('.about-modal-update button:has-text("View on GitHub")')
      await page.waitForResponse(IPC_OPEN)
      assert.equal(opened[0].url, RELEASE_URL)
      await page.keyboard.press('Escape')
    } finally {
      await page.unroute(API)
      await page.unroute(IPC_OPEN)
    }
  },
}
