// Saving a right-click preset from the Converter and managing presets in
// Settings (#settings-presets): every edit shows in the list, in presets.json
// (list_presets) and in the menu written to the dev registry subtree; the
// saved preset converts through --sorai-preset=<its id>. Starts and ends on
// the built-ins (the dev store persists between runs).
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expectRegistryMatches, invoke, readRegistry, runExe, stubDialogs } from './helpers.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FFMPEG = join(root, 'binaries', 'win_x64', 'ffmpeg.exe')
const dir = mkdtempSync(join(tmpdir(), 'sorai 預設 管理 '))

const ids = async (page) => (await invoke(page, 'list_presets')).map((p) => p.id)
const until = async (page, what, fn, timeout = 30_000) => {
  const end = Date.now() + timeout
  for (;;) {
    if (await fn()) return
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`)
    await page.waitForTimeout(200)
  }
}
// MUIVerb of each item in the .mp3 cascade, in menu order.
const mp3Menu = (reg) =>
  reg.filter((v) => /^\.mp3\\shell\\SORAIToolkit\\shell\\\d{3}$/.test(v.key) && v.name === 'MUIVerb')
    .sort((a, b) => a.key.localeCompare(b.key)).map((v) => v.data)

// GlassSelect's hidden <select>: native setter + events.
const select = (page, sel, value) =>
  page.evaluate(([s, v]) => {
    const el = document.querySelector(s)
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, [sel, value])

async function openSettings(page) {
  await page.locator('.hamburger-menu > button').first().click()
  await page.locator('.hamburger-item:has-text("Settings")').click()
  await page.locator('#settings-presets .preset-row').first().waitFor({ state: 'visible' })
}

export const tests = {
  'presets: save from the Converter, rename/reorder/delete/restore in Settings, menu follows, --sorai-preset uses it': async ({ page }) => {
    const mp3 = join(dir, '歌 a.mp3')
    copyFileSync(join(root, 'tests', 'fixtures', 'test_fixture_audio.mp3'), mp3)
    const regRoot = await invoke(page, 'context_menu_entries', { lang: 'en' }).then((r) => r.root)
    await page.evaluate(() => window.SoraiPresets.restore())
    try {
      // Converter: tune, save as a preset with an edited auto-generated name.
      await page.locator('.hub-card:has-text("Converter")').click()
      await stubDialogs(page, { openFiles: [mp3] })
      await page.locator('.drop-zone-message').click()
      await page.locator('.file-item').first().waitFor({ timeout: 30_000 })
      await select(page, '#audio-format', '.mp3')
      await select(page, '#audio-bitrate', '192k')
      await page.click('#btn-save-preset')
      const name = page.locator('#preset-name')
      await until(page, 'the suggested name', async () => (await name.inputValue()) === 'MP3 · 192k')
      await name.fill('My MP3 & co')
      await page.click('#btn-save-preset-confirm')
      await page.locator('#preset-save-message').waitFor()
      const saved = (await invoke(page, 'list_presets')).at(-1)
      assert.deepEqual(saved, { id: 'user-1', name: 'My MP3 & co', fileType: 'audio', format: '.mp3', settings: { format: '.mp3', bitrate: '192k', speed: 1 } })
      await expectRegistryMatches(page, 'en')
      assert.equal(mp3Menu(readRegistry(regRoot)).at(-3), 'My MP3 && co')
      await page.locator('.file-item button.remove').click()
      await page.locator('[aria-label="Back to hub"]').click()
      await page.locator('.hub-card').first().waitFor()

      // Settings: it's listed last; rename it.
      await openSettings(page)
      const row = page.locator('.preset-row[data-id="user-1"]')
      assert.equal(await page.locator('.preset-row').last().getAttribute('data-id'), 'user-1')
      assert.equal(await row.locator('.preset-name').inputValue(), 'My MP3 & co')
      await row.locator('.preset-name').fill('Renamed')
      await row.locator('.preset-name').press('Enter')
      await until(page, 'the rename', async () => (await invoke(page, 'list_presets')).at(-1).name === 'Renamed')
      await expectRegistryMatches(page, 'en')

      // Up twice: past pdf-compress, then past audio-to-ogg.
      for (const want of [19, 18]) {
        await row.locator('.preset-up').click()
        await until(page, `user-1 at ${want}`, async () => (await ids(page)).indexOf('user-1') === want)
      }
      await expectRegistryMatches(page, 'en')
      assert.deepEqual(mp3Menu(readRegistry(regRoot)), ['Convert to WAV', 'Convert to AAC', 'Convert to FLAC', 'Renamed', 'Convert to OGG', 'Open in SORAI Toolkit…', 'Manage presets…'])
      await row.locator('.preset-down').click()
      await until(page, 'user-1 back at 19', async () => (await ids(page)).indexOf('user-1') === 19)
      await until(page, 'the list to show it', async () => (await page.locator('.preset-row').nth(19).getAttribute('data-id')) === 'user-1')
      await page.keyboard.press('Escape')

      // The menu command converts with the saved settings (192k MP3 beside the source).
      assert.equal(await runExe(['--sorai-preset=user-1', mp3]), 0)
      const out = mp3.replace(/\.mp3$/, '_converted.mp3')
      await until(page, 'the output', () => existsSync(out), 60_000)
      // Auto-closes 3 s after an all-success batch.
      await until(page, 'the progress window to close', () => invoke(page, 'plugin:window|is_visible', { label: 'progress' }).then(() => false, () => true), 60_000)
      let banner = ''
      try { execFileSync(FFMPEG, ['-hide_banner', '-i', out], { stdio: 'pipe' }) } catch (e) { banner = String(e.stderr) }
      assert.match(banner, /Audio: mp3.*192 kb\/s/)

      // Delete it and a built-in; then restore (two clicks) brings back exactly the built-ins.
      await openSettings(page)
      await row.locator('.preset-delete').click()
      await page.locator('.preset-row[data-id="audio-to-wav"] .preset-delete').click()
      await until(page, 'the deletes', async () => (await ids(page)).length === 19)
      assert.ok(!(await ids(page)).includes('user-1') && !(await ids(page)).includes('audio-to-wav'))
      assert.equal(await page.locator('.preset-row[data-id="user-1"]').count(), 0)
      await expectRegistryMatches(page, 'en')
      assert.ok(!mp3Menu(readRegistry(regRoot)).includes('Renamed'))
      const restore = page.locator('.preset-restore')
      await restore.click()
      assert.equal(await restore.textContent(), 'Replace all presets with the defaults?')
      assert.equal((await ids(page)).length, 19, 'one click must not restore')
      await restore.click()
      await until(page, 'the restore', async () => (await page.locator('.preset-row').count()) === 20)
      assert.equal((await ids(page))[15], 'audio-to-wav')
      await expectRegistryMatches(page, 'en')
      await page.keyboard.press('Escape')
      await page.locator('.settings-modal-content').waitFor({ state: 'hidden' })
    } finally {
      await page.evaluate(() => window.SoraiPresets.restore()).catch(() => {})
      execFileSync('reg', ['delete', `HKCU\\${regRoot.replace(/\\Classes$/, '')}`, '/f'], { stdio: 'ignore' })
    }
  },
}
