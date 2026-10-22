// Edit-preset mode: Settings -> a preset's "Edit" opens the Converter's
// PresetEditor; Cancel changes nothing, "Save preset" overwrites the preset
// in place (same id and position, menu rewritten) and --sorai-preset=<id>
// converts with the new settings. Neither touches the Converter's queue or
// its current settings. Starts and ends on the built-ins.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expectRegistryMatches, invoke, runExe, stubDialogs } from './helpers.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FFMPEG = join(root, 'binaries', 'win_x64', 'ffmpeg.exe')
const dir = mkdtempSync(join(tmpdir(), 'sorai 預設 編輯 '))

const until = async (page, what, fn, timeout = 30_000) => {
  const end = Date.now() + timeout
  for (;;) {
    if (await fn()) return
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`)
    await page.waitForTimeout(200)
  }
}
const progressClosed = (page) => invoke(page, 'plugin:window|is_visible', { label: 'progress' }).then(() => false, () => true)

// GlassSelect's hidden <select> / a range input: native setter + events.
const setValue = (page, sel, value) =>
  page.evaluate(([s, v]) => {
    const el = document.querySelector(s)
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, [sel, value])

async function openSettings(page) {
  await page.locator('.hamburger-menu > button').first().click()
  await page.locator('.hamburger-item:has-text("Settings")').click()
  await page.locator('#settings-presets .preset-row').first().waitFor({ state: 'visible' })
}

// Runs the preset on a detailed 640x480 png (the fixtures are too flat for
// JPEG quality to show in the size); resolves the output size.
async function convertWithPreset(page, name) {
  const png = join(dir, `${name}.png`)
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x480', '-frames:v', '1', png])
  assert.equal(await runExe(['--sorai-preset=image-to-jpg', png]), 0)
  const out = join(dir, `${name}_converted.jpg`)
  await until(page, `${name}'s output`, () => existsSync(out), 60_000)
  await until(page, 'the progress window to close', () => progressClosed(page), 60_000)
  return statSync(out).size
}

export const tests = {
  'preset edit: cancel changes nothing, save overwrites in place and --sorai-preset uses it, queue untouched': async ({ page }) => {
    const mp3 = join(dir, '歌.mp3')
    copyFileSync(join(root, 'tests', 'fixtures', 'test_fixture_audio.mp3'), mp3)
    const regRoot = await invoke(page, 'context_menu_entries', { lang: 'en' }).then((r) => r.root)
    await page.evaluate(() => window.SoraiPresets.restore())
    try {
      const before = await invoke(page, 'list_presets')
      const index = before.findIndex((p) => p.id === 'image-to-jpg')
      const baseline = await convertWithPreset(page, 'before')

      // From the hub screen: Edit -> change quality -> Cancel. Nothing saved;
      // back on the hub with Settings reopened at the presets.
      await openSettings(page)
      await page.locator('.preset-row[data-id="image-to-jpg"] .preset-edit').click()
      await page.locator('#preset-editor[data-id="image-to-jpg"]').waitFor()
      assert.equal(await page.locator('#preset-editor-title').textContent(), 'Editing preset: Convert to JPG')
      assert.equal(await page.locator('.settings-modal-content').isVisible(), false)
      assert.equal(await page.inputValue('#image-quality'), '85')
      await setValue(page, '#image-quality', '5')
      await page.click('#btn-preset-edit-cancel')
      await page.locator('#settings-presets .preset-row').first().waitFor({ state: 'visible' })
      assert.deepEqual(await invoke(page, 'list_presets'), before)
      await page.keyboard.press('Escape')
      await page.locator('.hub-card').first().waitFor()

      // In the Converter with a queued mp3 at 192k: Edit -> quality 5 -> Save.
      await page.locator('.hub-card:has-text("Converter")').click()
      await stubDialogs(page, { openFiles: [mp3] })
      await page.locator('.drop-zone-message').click()
      await page.locator('.file-item').first().waitFor({ timeout: 30_000 })
      await setValue(page, '#audio-bitrate', '192k')
      await openSettings(page)
      await page.locator('.preset-row[data-id="image-to-jpg"] .preset-edit').click()
      await page.locator('#preset-editor').waitFor()
      assert.equal(await page.inputValue('#image-quality'), '85', 'the editor starts from the preset')
      await setValue(page, '#image-quality', '5')
      await page.click('#btn-preset-edit-save')
      await page.locator('#settings-presets .preset-row').first().waitFor({ state: 'visible' })
      const after = await invoke(page, 'list_presets')
      assert.equal(after.length, before.length)
      assert.equal(after[index].id, 'image-to-jpg', 'same id, same position')
      assert.deepEqual(after[index], { ...before[index], settings: { ...before[index].settings, quality: 5 } })
      await expectRegistryMatches(page, 'en')
      await page.keyboard.press('Escape')

      // The queue and its settings are as they were.
      await page.locator('.file-item').first().waitFor()
      assert.equal(await page.locator('.file-item').count(), 1)
      assert.equal(await page.inputValue('#audio-bitrate'), '192k')

      // The menu command now converts at quality 5: a much smaller JPEG.
      const edited = await convertWithPreset(page, 'after')
      assert.ok(edited < baseline * 0.6, `quality 5 output ${edited} B should be well under quality 85's ${baseline} B`)

      await page.locator('.file-item button.remove').click()
      await page.locator('[aria-label="Back to hub"]').click()
      await page.locator('.hub-card').first().waitFor()
    } finally {
      await page.evaluate(() => window.SoraiPresets.restore()).catch(() => {})
      execFileSync('reg', ['delete', `HKCU\\${regRoot.replace(/\\Classes$/, '')}`, '/f'], { stdio: 'ignore' })
    }
  },
}
