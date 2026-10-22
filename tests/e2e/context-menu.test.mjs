// The app-written Explorer menu (src-tauri/src/context_menu.rs) and the
// --sorai-open / --sorai-presets / --sorai-register-menu launches. A dev
// build's identifier isn't the production one, so every write here lands in
// HKCU\Software\SORAI Toolkit Dev\<identifier>\Classes, never the real menu.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { appCount, invoke } from './helpers.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, '..', 'fixtures')
const exe = join(here, '..', '..', 'src-tauri', 'target', 'debug', 'sorai-toolkit.exe')
const dir = mkdtempSync(join(tmpdir(), 'sorai 選單 '))
const rows = (page) => page.locator('.file-item')

function run(args) {
  const p = spawn(exe, args, { stdio: 'ignore' })
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { p.kill(); reject(new Error(`${args[0]} did not exit`)) }, 30_000)
    p.on('exit', (code) => { clearTimeout(t); resolve(code) })
  })
}

// Every value under the classes root as { key, name, data }, keys relative to
// the root. Written to a UTF-8 file: console output would go through the ANSI codepage.
function readRegistry(root) {
  const out = join(dir, 'reg.json')
  const ps = `
    $base = 'HKEY_CURRENT_USER\\${root.replace(/'/g, "''")}\\'
    $vals = @(Get-ChildItem -LiteralPath ('Registry::' + $base) -Recurse | ForEach-Object {
      $k = $_
      foreach ($n in $k.GetValueNames()) { [pscustomobject]@{ key = $k.Name.Substring($base.Length); name = $n; data = $k.GetValue($n) } }
    })
    [System.IO.File]::WriteAllText('${out.replace(/'/g, "''")}', (ConvertTo-Json -InputObject $vals -Compress -Depth 3), [System.Text.Encoding]::UTF8)`
  execFileSync('powershell', ['-NoProfile', '-Command', ps])
  return JSON.parse(readFileSync(out, 'utf8').replace(/^﻿/, ''))
}

const sorted = (vals) => vals.map(({ key, name, data }) => ({ key, name, data })).sort((a, b) => (a.key + '|' + a.name).localeCompare(b.key + '|' + b.name))

async function expectRegistryMatches(page, lang) {
  const { root, values } = await invoke(page, 'context_menu_entries', { lang })
  assert.ok(!/^Software\\Classes$/i.test(root), `dev build must not target ${root}`)
  const want = sorted(values)
  let got
  for (let i = 0; i < 50; i++) {
    got = sorted(readRegistry(root))
    if (JSON.stringify(got) === JSON.stringify(want)) return root
    await page.waitForTimeout(200)
  }
  assert.deepEqual(got, want)
}

async function backToHub(page) {
  if (await page.locator('#mixed-type-modal:not(.hidden)').count()) await page.locator('#btn-mixed-type-cancel').click()
  if (!(await page.locator('[aria-label="Back to hub"]').count())) return
  while ((await rows(page).count()) > 0) await rows(page).first().locator('button.remove').click()
  await page.locator('[aria-label="Back to hub"]').click()
  await page.locator('.hub-card').first().waitFor()
}

export const tests = {
  'context menu: language switch rewrites it, --sorai-register-menu writes Chinese and exits': async ({ page }) => {
    const setLang = (l) => page.evaluate((x) => window.EstellaLib.i18n.setLang(x), l)
    let root
    try {
      await setLang('zh-TW')
      root = await expectRegistryMatches(page, 'zh-TW')
      await setLang('en')
      await expectRegistryMatches(page, 'en')
      // The installer hook: writes and exits 0 before single-instance, no window.
      assert.equal(await run(['--sorai-register-menu']), 0)
      assert.equal(appCount(), 1)
      await expectRegistryMatches(page, 'zh-TW')
      const muiverb = readRegistry(root).find((v) => v.key === '.mp3\\shell\\SORAIToolkit\\shell\\001' && v.name === 'MUIVerb')
      assert.equal(muiverb.data, '轉成 WAV')
    } finally {
      await setLang('en')
      if (root) execFileSync('reg', ['delete', `HKCU\\${root.replace(/\\Classes$/, '')}`, '/f'], { stdio: 'ignore' })
    }
  },

  'context menu: --sorai-open queues the files; another type opens the mixed-type modal': async ({ page }) => {
    const mp3s = ['一 a.mp3', 'b.mp3'].map((n) => join(dir, n))
    for (const f of mp3s) copyFileSync(join(fixtures, 'test_fixture_audio.mp3'), f)
    const mp4 = join(dir, 'clip.mp4')
    copyFileSync(join(fixtures, 'test_fixture_video.mp4'), mp4)
    try {
      assert.deepEqual(await Promise.all(mp3s.map((f) => run(['--sorai-open', f]))), [0, 0])
      await page.waitForFunction(() => document.querySelectorAll('.file-item').length === 2, null, { timeout: 30_000 })
      const titles = await rows(page).locator('.queue-item-title').evaluateAll((els) => els.map((e) => e.getAttribute('title')))
      assert.deepEqual([...titles].sort(), [...mp3s].sort())
      assert.equal(await run(['--sorai-open', mp4]), 0)
      await page.locator('#mixed-type-modal:not(.hidden)').waitFor({ timeout: 30_000 })
      await page.locator('#btn-mixed-type-cancel').click()
      assert.equal(await rows(page).count(), 2)
    } finally {
      await backToHub(page)
    }
  },

  'context menu: --sorai-presets opens settings at the presets section': async ({ page }) => {
    assert.equal(await run(['--sorai-presets']), 0)
    const section = page.locator('#settings-presets')
    await section.waitFor({ state: 'visible', timeout: 30_000 })
    assert.equal(await section.locator('h4').textContent(), 'Right-click presets')
    await page.keyboard.press('Escape')
    await page.locator('.settings-modal-content').waitFor({ state: 'hidden' })
  },
}
