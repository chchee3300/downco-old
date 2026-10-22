// Single instance + --sorai-* launch args: re-running the app exe (what an
// Explorer right-click does, once per selected file) must not open a second
// window; the running one gets the files as ONE pendingLaunch.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { copyFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { appCount } from './helpers.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, '..', 'fixtures')
const exe = join(here, '..', '..', 'src-tauri', 'target', 'debug', 'sorai-toolkit.exe')
const dir = mkdtempSync(join(tmpdir(), 'sorai 啟動 '))
const rows = (page) => page.locator('.file-item')

// Launch the exe once per file, all at once, like a multi-select right-click.
async function launchEach(flag, files) {
  const procs = files.map((f) => spawn(exe, [flag, f], { stdio: 'ignore' }))
  try {
    const codes = await Promise.all(procs.map((p) => new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('second instance did not exit')), 30_000)
      p.on('exit', (code) => { clearTimeout(t); resolve(code) })
    })))
    assert.deepEqual(codes, files.map(() => 0))
  } finally {
    for (const p of procs) if (p.exitCode === null) p.kill()
  }
}

async function backToHub(page) {
  if (!(await page.locator('[aria-label="Back to hub"]').count())) return // don't mask the real failure
  while ((await rows(page).count()) > 0) await rows(page).first().locator('button.remove').click()
  await page.locator('[aria-label="Back to hub"]').click()
  await page.locator('.hub-card').first().waitFor()
}

export const tests = {
  'single instance: 3 launches with --sorai-convert-to -> one window, 3 files, format applied': async ({ page }) => {
    const files = ['一.mp3', 'two.mp3', 'три.mp3'].map((n) => join(dir, n))
    for (const f of files) copyFileSync(join(fixtures, 'test_fixture_audio.mp3'), f)
    await launchEach('--sorai-convert-to=.ogg', files)
    try {
      assert.equal(appCount(), 1)
      await page.waitForFunction(() => document.querySelectorAll('.file-item').length === 3, null, { timeout: 30_000 })
      const titles = await rows(page).locator('.queue-item-title').evaluateAll((els) => els.map((e) => e.getAttribute('title')))
      assert.deepEqual([...titles].sort(), [...files].sort())
      assert.equal(await page.$eval('#audio-format', (e) => e.value), '.ogg')
    } finally {
      await backToHub(page)
    }
  },

  'single instance: --sorai-quick-action=compress-under:50 switches to target size mode': async ({ page }) => {
    const clip = join(dir, 'clip.mp4')
    copyFileSync(join(fixtures, 'test_fixture_video.mp4'), clip)
    await launchEach('--sorai-quick-action=compress-under:50', [clip])
    try {
      await page.locator('.target-size-chips .chip--active').waitFor({ timeout: 30_000 })
      assert.equal(await page.locator('.target-size-chips .chip--active').innerText(), '50 MB')
      assert.equal(await rows(page).count(), 1)
      await page.locator('.target-size-chips .chip--ghost').click() // settings persist; leave them off
    } finally {
      await backToHub(page)
    }
  },
}
