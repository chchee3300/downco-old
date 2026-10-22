// Converter jobs end to end (ported from the old test_conversion.js):
// real ffmpeg sidecar runs, outputs checked with ffmpeg itself. Video /
// audio / image once each, a failing file doesn't stop the batch, output
// names never overwrite, "under 5 MB" really is under 5,000,000 bytes, and
// cancel kills ffmpeg and cleans the partial file. PDF compress (qpdf) and
// image->PDF (img2pdf) run the real Windows sidecars; outputs checked with qpdf.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stubDialogs } from './helpers.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const fixtures = join(root, 'tests', 'fixtures')
const FFMPEG = join(root, 'binaries', 'win_x64', 'ffmpeg.exe')
const QPDF = join(root, 'binaries', 'win_x64', 'qpdf.exe')
// qpdf --check exits non-zero on a broken PDF (throws here).
const pdfPages = (file) => {
  execFileSync(QPDF, ['--check', file], { stdio: 'pipe' })
  return Number(execFileSync(QPDF, ['--show-npages', file], { encoding: 'utf8' }))
}
const dir = mkdtempSync(join(tmpdir(), 'sorai 轉檔 job '))

// `ffmpeg -i` banner: stream lines + duration of an output file.
function probe(file) {
  let out = ''
  try {
    execFileSync(FFMPEG, ['-hide_banner', '-i', file], { stdio: 'pipe' })
  } catch (e) {
    out = String(e.stderr) // -i without output always exits 1
  }
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(out)
  return { streams: out.split('\n').filter((l) => l.includes('Stream #')).join('\n'), duration: d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : 0 }
}

const rows = (page) => page.locator('.file-item')

async function open(page, files) {
  await page.locator('.hub-card:has-text("Converter")').click()
  await page.locator('.drop-zone-message').waitFor()
  await stubDialogs(page, { openFiles: files })
  await page.locator('.drop-zone-message').click()
  await page.waitForFunction((n) => document.querySelectorAll('.file-item').length === n, files.length, { timeout: 30_000 })
}

async function backToHub(page) {
  await page.waitForFunction(() => !/Cancel/.test(document.getElementById('btn-execute')?.textContent ?? ''), null, { timeout: 30_000 })
  while ((await rows(page).count()) > 0) await rows(page).first().locator('button.remove').click()
  await page.locator('[aria-label="Back to hub"]').click()
  await page.locator('.hub-card').first().waitFor()
}

// React-controlled <input type=range> / GlassSelect <select>: native setter + events.
const set = (page, selector, value) =>
  page.evaluate(([sel, v]) => {
    const el = document.querySelector(sel)
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, [selector, String(value)])

const log = (page) => page.locator('#terminal-log').innerText()
const executions = async (page) => (await log(page)).split('> Executing:').length - 1

// Click Start and wait for this batch's final text. `jobs` = files in the
// batch; waiting for that many new "> Executing:" lines first guarantees
// we don't read the previous batch's "Completed" text.
async function run(page, jobs, timeout = 60_000) {
  const before = await executions(page)
  await page.click('#btn-execute')
  await page.waitForFunction(
    (n) => document.getElementById('terminal-log').innerText.split('> Executing:').length - 1 >= n,
    before + jobs,
    { timeout },
  )
  await page.waitForFunction(() => /^(Completed|Cancelled)/.test(document.getElementById('progress-text').innerText), null, { timeout })
  return page.locator('#progress-text').innerText()
}

export const tests = {
  'converter: video converts, a broken file does not stop the batch, names never overwrite': async ({ page }) => {
    const broken = join(dir, '壞掉的.mp4')
    writeFileSync(broken, 'not a video')
    const clip = join(dir, '測試 影片.mp4')
    copyFileSync(join(fixtures, 'test_fixture_video.mp4'), clip)
    const onDialog = (d) => d.dismiss().catch(() => {}) // per-file failure alert()
    page.on('dialog', onDialog)
    await open(page, [broken, clip])
    try {
      await page.waitForFunction(() => /→ ~/.test(document.getElementById('file-est-1').textContent), null, { timeout: 10_000 })
      await set(page, '#video-quality', 50)
      await set(page, '#video-speed', 1.5)
      assert.match(await run(page, 2), /^Completed 1 of 2/)
      assert.match(await log(page), /! ffmpeg exited with code -?\d+: Error opening input/)
      assert.ok(!existsSync(join(dir, '壞掉的_converted.mp4')), 'failed output left behind')

      const out = join(dir, '測試 影片_converted.mp4')
      const p = probe(out)
      assert.match(p.streams, /Video: h264/)
      assert.match(p.streams, /Audio: aac/)
      assert.ok(Math.abs(p.duration - 2 / 1.5) < 0.2, `duration ${p.duration} (2 s at 1.5x)`)
      assert.match(await page.locator('#file-size-1').innerText(), /→ [\d.]+ MB/)
      assert.match(await log(page), /setpts=0\.6666666666666666\*PTS -af atempo=1\.5/)

      // Same file again -> _converted_converted, first output untouched.
      const mtime = statSync(out).mtimeMs
      assert.match(await run(page, 2), /^Completed 1 of 2/)
      assert.match(probe(join(dir, '測試 影片_converted_converted.mp4')).streams, /Video: h264/)
      assert.equal(statSync(out).mtimeMs, mtime)
    } finally {
      page.off('dialog', onDialog)
      await backToHub(page)
    }
  },

  'converter: audio converts to ogg (libvorbis, bitrate)': async ({ page }) => {
    const song = join(dir, 'song 一.mp3')
    copyFileSync(join(fixtures, 'test_fixture_audio.mp3'), song)
    await open(page, [song])
    try {
      await set(page, '#audio-format', '.ogg')
      await set(page, '#audio-bitrate', '192k')
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      const p = probe(join(dir, 'song 一_converted.ogg'))
      assert.match(p.streams, /Audio: vorbis/)
      assert.ok(Math.abs(p.duration - 2) < 0.2, `duration ${p.duration}`)
      assert.match(await log(page), /-c:a libvorbis -b:a 192k/)
    } finally {
      await backToHub(page)
    }
  },

  'converter: image converts to webp at half scale': async ({ page }) => {
    const img = join(dir, '圖 片.png')
    copyFileSync(join(fixtures, 'test_in.png'), img)
    await open(page, [img])
    try {
      await set(page, '#image-format', '.webp')
      await set(page, '#image-quality', 60)
      await set(page, '#image-scale', 50)
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      // test_in.png is 320x240
      assert.match(probe(join(dir, '圖 片_converted.webp')).streams, /Video: webp.*160x120/)
    } finally {
      await backToHub(page)
    }
  },

  'converter: quick compress to under 5 MB really lands under 5,000,000 bytes, with live progress': async ({ page }) => {
    // Hard-to-compress noise, ~60 MB for 8 s: the worst case for VBV overshoot.
    const big = join(dir, '大檔 noise.mp4')
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30,noise=alls=60:allf=t',
      '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '8', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '8', '-c:a', 'aac', '-shortest', big])
    assert.ok(statSync(big).size > 20e6)
    await open(page, [big])
    try {
      await page.evaluate(() => {
        window.__progressTexts = []
        new MutationObserver(() => window.__progressTexts.push(document.getElementById('progress-text').innerText))
          .observe(document.getElementById('progress-text'), { childList: true, characterData: true, subtree: true })
      })
      await page.locator('.target-size-chips').getByRole('button', { name: '5 MB', exact: true }).click()
      await page.waitForFunction(() => /→ ~4\.8 MB/.test(document.getElementById('file-est-0').textContent))
      assert.match(await run(page, 1, 120_000), /^Completed 1 of 1/)
      const out = join(dir, '大檔 noise_converted.mp4')
      const size = statSync(out).size
      assert.ok(size < 5_000_000, `output ${size} bytes`)
      const p = probe(out)
      assert.match(p.streams, /Video: h264/)
      assert.match(p.streams, /Audio: aac/)
      const texts = await page.evaluate(() => window.__progressTexts)
      assert.ok(texts.some((t) => /\(1\/1\) - ([1-9]\d?)%/.test(t)), `no intermediate percent in ${JSON.stringify(texts)}`)
    } finally {
      await backToHub(page)
    }
  },

  'converter: PDF compress runs qpdf and yields a valid, smaller file': async ({ page }) => {
    const doc = join(dir, '文件 一.pdf')
    copyFileSync(join(fixtures, 'test_fixture.pdf'), doc)
    await open(page, [doc])
    try {
      await set(page, '#pdf-optimize', 'compress')
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      assert.match(await log(page), /> Executing: qpdf --stream-data=compress /)
      const out = join(dir, '文件 一_converted.pdf')
      assert.equal(pdfPages(out), pdfPages(doc))
      assert.ok(statSync(out).size < statSync(doc).size, `${statSync(out).size} >= ${statSync(doc).size}`)
    } finally {
      await backToHub(page)
    }
  },

  'converter: image -> PDF runs img2pdf, one valid PDF page per image (as before)': async ({ page }) => {
    const imgs = ['圖 一.png', '圖 二.png'].map((n) => join(dir, n))
    for (const i of imgs) copyFileSync(join(fixtures, 'test_in.png'), i)
    await open(page, imgs)
    try {
      await set(page, '#image-format', '.pdf')
      assert.match(await run(page, 2), /^Completed 2 of 2/)
      assert.match(await log(page), /> Executing: img2pdf /)
      for (const n of ['圖 一', '圖 二']) assert.equal(pdfPages(join(dir, `${n}_converted.pdf`)), 1)
    } finally {
      await backToHub(page)
    }
  },

  'converter: cancel kills ffmpeg, stops the batch and removes the partial file': async ({ page }) => {
    const sub = mkdtempSync(join(dir, 'cancel '))
    const clips = ['a', 'b', 'c'].map((x) => join(sub, `取消 ${x}.mp4`))
    const big = join(dir, '大檔 noise.mp4')
    for (const c of clips) copyFileSync(existsSync(big) ? big : join(fixtures, 'test_fixture_video.mp4'), c)
    await open(page, clips)
    try {
      await set(page, '#video-codec', 'libsvtav1') // slow: guarantees a window to cancel in
      await page.click('#btn-execute')
      await page.waitForFunction(() => document.getElementById('terminal-log').innerText.includes('> Executing:'), null, { timeout: 20_000 })
      await page.waitForTimeout(500)
      const t0 = Date.now()
      await page.click('#btn-execute') // now the Cancel button
      await page.waitForFunction(() => /^Cancelled/.test(document.getElementById('progress-text').innerText), null, { timeout: 10_000 })
      const m = /^Cancelled (\d+) of 3/.exec(await page.locator('#progress-text').innerText())
      assert.ok(m && +m[1] < 3, 'batch stopped early')
      assert.ok(Date.now() - t0 < 2500, `cancel took ${Date.now() - t0} ms (backstop is 3 s: the kill itself must work)`)
      await page.locator('#btn-execute:has-text("Start Processing"):not([disabled])').waitFor({ timeout: 5_000 })
      const outputs = readdirSync(sub).filter((f) => f.includes('_converted'))
      assert.deepEqual(outputs, [], 'partial output left behind')
      assert.doesNotMatch(await page.locator('#file-size-0').innerText(), /→/)
      // No ffmpeg still working on our files (other worktrees may run their own).
      const procs = execFileSync('powershell', ['-NoProfile', '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='ffmpeg.exe'\" | ForEach-Object { $_.CommandLine }"], { encoding: 'utf8' })
      assert.ok(!procs.includes(sub), `orphaned ffmpeg: ${procs}`)
    } finally {
      await backToHub(page)
    }
  },
}
