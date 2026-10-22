import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { invoke, appRunning, stubDialogs } from './helpers.mjs'

const hub = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FFMPEG = join(hub, 'binaries', 'win_x64', 'ffmpeg.exe')
const LONG = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' // 10 min: still downloading at quit
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// yt-dlp / ffmpeg started by THIS worktree's build (others may run their own).
function ourSidecars() {
  const dir = join(hub, 'src-tauri', 'target')
  const ps = `Get-CimInstance Win32_Process | ? { $_.ExecutablePath -and $_.ExecutablePath.StartsWith('${dir}', 'OrdinalIgnoreCase') -and $_.Name -match '^(yt-dlp|ffmpeg)' } | % { $_.Name }`
  return spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).stdout.split(/\r?\n/).filter(Boolean)
}

// Runs last (file name sorts last): it ends the app, so nothing can follow it.
export const tests = {
  'quit while a convert and a download run: process trees killed, no partial output': async ({ page }) => {
    await page.locator('.hamburger-menu > button').first().click()
    await page.locator('.hamburger-item:has-text("Settings")').click()
    await page.locator('.settings-radio-option:has-text("Quit the app") input').check()
    await page.locator('.settings-modal-content button:has-text("Close")').click()
    assert.equal(appRunning(), true)

    // Converter: slow AV1 encode of a 30 s clip, quit mid-encode.
    const sub = mkdtempSync(join(tmpdir(), 'sorai 結束 '))
    const clip = join(sub, '結束 clip.mp4')
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30', '-t', '30',
      '-c:v', 'libx264', '-preset', 'ultrafast', clip])
    await page.locator('.hub-card:has-text("Converter")').click()
    await page.locator('.drop-zone-message').waitFor()
    await stubDialogs(page, { openFiles: [clip] })
    await page.locator('.drop-zone-message').click()
    await page.locator('.file-item').first().waitFor({ timeout: 30_000 })
    await page.evaluate(() => {
      const el = document.querySelector('#video-codec')
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, 'libsvtav1')
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await page.click('#btn-execute')
    await page.waitForFunction(() => document.getElementById('terminal-log').innerText.includes('> Executing:'), null, { timeout: 20_000 })

    // Downloader job straight through the plugin (no UI needed): best video-only stream.
    await page.evaluate(([url, out]) => {
      const ch = `__CHANNEL__:${window.__TAURI_INTERNALS__.transformCallback(() => {})}`
      const job = { url, outputDir: out, mode: 'split', videoFormatId: 'bv', audioFormatId: '', combinedFormatId: '',
        includeVideo: true, includeAudio: false, autoMerge: false, clipStart: null, clipEnd: null }
      window.__TAURI_INTERNALS__.invoke('plugin:sorai-downloader|start_download', { job, onEvent: ch })
    }, [LONG, sub])
    let procs = ourSidecars()
    for (let i = 0; i < 40 && !(procs.includes('yt-dlp.exe') && procs.includes('ffmpeg.exe')); i++) await sleep(250), (procs = ourSidecars())
    assert.ok(procs.includes('yt-dlp.exe') && procs.includes('ffmpeg.exe'), `running before quit: ${procs}`)

    await invoke(page, 'plugin:window|close', { label: 'main' }).catch(() => {}) // page dies mid-call
    for (let i = 0; i < 50 && appRunning(); i++) await sleep(200)
    assert.equal(appRunning(), false)
    let left = ourSidecars()
    for (let i = 0; i < 10 && left.length; i++) await sleep(300), (left = ourSidecars())
    assert.deepEqual(left, [], 'sidecars outlived the app')
    assert.deepEqual(readdirSync(sub).filter((f) => f.includes('_converted')), [], 'partial convert output left behind')
  },
}
