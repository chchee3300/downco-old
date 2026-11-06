// Converter jobs end to end (ported from the old test_conversion.js):
// real ffmpeg sidecar runs, outputs checked with ffmpeg itself. Video /
// audio / image once each, a failing file doesn't stop the batch, output
// names never overwrite, "under 5 MB" really is under 5,000,000 bytes, and
// cancel kills ffmpeg and cleans the partial file. PDF compress runs the
// built-in compressor (qpdf for encrypted files and ones it cannot read),
// image->PDF the real img2pdf sidecar; outputs checked with qpdf.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { invoke, stubDialogs } from './helpers.mjs'

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
    await open(page, [broken, clip])
    try {
      await page.waitForFunction(() => /→ ~/.test(document.getElementById('file-est-1').textContent), null, { timeout: 10_000 })
      await set(page, '#video-quality', 50)
      await set(page, '#video-speed', 1.5)
      assert.match(await run(page, 2), /^Completed 1 of 2/)
      assert.match(await log(page), /! ffmpeg exited with code -?\d+: Error opening input/)
      assert.ok(!existsSync(join(dir, '壞掉的_converted.mp4')), 'failed output left behind')
      // Non-blocking failure mark on the right row (no alert()).
      assert.match(await page.locator('#file-size-0 .file-failed').getAttribute('title'), /exited with code/)
      assert.equal(await page.locator('#file-size-1 .file-failed').count(), 0)

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
      await backToHub(page)
    }
  },

  'converter: WebM offers only VP9/AV1 and estimates with the codec it encodes': async ({ page }) => {
    // Big enough (~2 MB) that the 0.1 MB estimate rounding tells H.264 from VP9.
    const clip = join(dir, 'webm 估計.mp4')
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30', '-t', '4', '-b:v', '4M', clip])
    await open(page, [clip])
    const est = async (prev) => {
      await page.waitForFunction((p) => { const t = document.getElementById('file-est-0').textContent; return /→ ~/.test(t) && t !== p }, prev, { timeout: 10_000 })
      return page.locator('#file-est-0').textContent()
    }
    const codecs = () => page.$$eval('#video-codec option', (os) => os.map((o) => o.value))
    try {
      const mp4 = await est(null)
      assert.equal(await page.$eval('#video-codec', (s) => s.value), 'libx264')
      await set(page, '#video-format', '.webm')
      const webm = await est(mp4) // VP9's factor, not H.264's
      assert.equal(await page.$eval('#video-codec', (s) => s.value), 'libvpx-vp9')
      assert.deepEqual(await codecs(), ['libvpx-vp9', 'libsvtav1'])
      await set(page, '#video-codec', 'libvpx-vp9')
      await page.waitForTimeout(500)
      assert.equal(await page.locator('#file-est-0').textContent(), webm, 'shown codec and estimate disagree')
      await set(page, '#video-format', '.mp4')
      assert.deepEqual(await codecs(), ['libx264', 'libx265', 'libvpx-vp9', 'libsvtav1'])
    } finally {
      await backToHub(page)
    }
  },

  // Container check via the `ffmpeg -i` banner: MOV writes the `qt  `
  // brand, WMV is an asf container.
  'converter: MP4 converts to MOV (H.264/H.265 only) and WMV, both accepted back as input': async ({ page }) => {
    const clip = join(dir, '容器 clip.mp4')
    copyFileSync(join(fixtures, 'test_fixture_video.mp4'), clip)
    const banner = (file) => { try { execFileSync(FFMPEG, ['-hide_banner', '-i', file], { stdio: 'pipe' }) } catch (e) { return String(e.stderr) } }
    const codecs = () => page.$$eval('#video-codec option', (os) => os.map((o) => o.value))
    await open(page, [clip])
    try {
      await set(page, '#video-codec', 'libvpx-vp9')
      await set(page, '#video-format', '.mov')
      assert.deepEqual(await codecs(), ['libx264', 'libx265'])
      assert.equal(await page.$eval('#video-codec', (s) => s.value), 'libx264', 'VP9 falls back to the container default')
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      const mov = join(dir, '容器 clip_converted.mov')
      assert.match(banner(mov), /major_brand\s*: qt/)
      assert.match(probe(mov).streams, /Video: h264[\s\S]*Audio: aac/)

      await set(page, '#video-format', '.wmv')
      assert.deepEqual(await codecs(), ['wmv2'])
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      const wmv = join(dir, '容器 clip_converted.wmv')
      assert.match(banner(wmv), /Input #0, asf/)
      assert.match(probe(wmv).streams, /Video: wmv2[\s\S]*Audio: wmav2/)
      assert.ok(Math.abs(probe(wmv).duration - 2) < 0.3, `duration ${probe(wmv).duration}`)
      await backToHub(page)
      await open(page, [mov, wmv]) // new input extensions are accepted
    } finally {
      await backToHub(page)
    }
  },

  // libopus refuses 320k per channel: the plugin caps it at 256k.
  'converter: mono mp3 converts to Opus at 320k (capped to 256k)': async ({ page }) => {
    const song = join(dir, 'opus 一.mp3')
    copyFileSync(join(fixtures, 'test_fixture_audio.mp3'), song)
    await open(page, [song])
    try {
      await set(page, '#audio-format', '.opus')
      await set(page, '#audio-bitrate', '320k')
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      assert.match(probe(join(dir, 'opus 一_converted.opus')).streams, /Audio: opus/)
      assert.match(await log(page), /-c:a libopus -b:a 256k/)
    } finally {
      await backToHub(page)
    }
  },

  'converter: mp3 converts to lossless M4A (ALAC); AIFF also disables bitrate': async ({ page }) => {
    const song = join(dir, 'alac 一.mp3')
    copyFileSync(join(fixtures, 'test_fixture_audio.mp3'), song)
    await open(page, [song])
    const bitrateOff = () => page.$eval('#audio-bitrate', (s) => s.disabled)
    try {
      await set(page, '#audio-format', '.aiff')
      assert.equal(await page.locator('#audio-alac').count(), 0, 'ALAC only for M4A')
      assert.equal(await bitrateOff(), true)
      await set(page, '#audio-format', '.m4a')
      assert.equal(await bitrateOff(), false)
      await page.locator('#audio-alac').check()
      assert.equal(await bitrateOff(), true)
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      assert.match(probe(join(dir, 'alac 一_converted.m4a')).streams, /Audio: alac/)
      await page.locator('#audio-alac').uncheck() // settings outlive the queue: later M4A tests expect AAC
    } finally {
      await backToHub(page)
    }
  },

  // 320k on the mono fixture: libvorbis ABR used to reject it ("encoder
  // setup failed"); the plugin now maps the bitrate onto VBR -q:a.
  'converter: audio converts to ogg (libvorbis VBR quality from the bitrate)': async ({ page }) => {
    const song = join(dir, 'song 一.mp3')
    copyFileSync(join(fixtures, 'test_fixture_audio.mp3'), song)
    await open(page, [song])
    try {
      await set(page, '#audio-format', '.ogg')
      await set(page, '#audio-bitrate', '320k')
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      const p = probe(join(dir, 'song 一_converted.ogg'))
      assert.match(p.streams, /Audio: vorbis/)
      assert.ok(Math.abs(p.duration - 2) < 0.2, `duration ${p.duration}`)
      assert.match(await log(page), /-c:a libvorbis -q:a 9/)
    } finally {
      await backToHub(page)
    }
  },

  // Cover art: the ipod muxer refuses the h264 ffmpeg would re-encode it to,
  // so the plugin copies it as an attached picture. The M4A then goes back in.
  'converter: audio with cover art converts to m4a (AAC) and m4a is accepted as input': async ({ page }) => {
    const song = join(dir, 'cover 一.mp3')
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=d=2', '-f', 'lavfi', '-i', 'color=red:s=300x300:r=1:d=1',
      '-map', '0', '-map', '1', '-c:v', 'mjpeg', '-disposition:v', 'attached_pic', '-id3v2_version', '3', song])
    const m4a = join(dir, 'cover 一_converted.m4a')
    await open(page, [song])
    try {
      await set(page, '#audio-format', '.m4a')
      await set(page, '#audio-bitrate', '192k')
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      const p = probe(m4a)
      assert.match(p.streams, /Audio: aac/)
      assert.match(p.streams, /attached pic/)
      assert.ok(Math.abs(p.duration - 2) < 0.2, `duration ${p.duration}`)
    } finally {
      await backToHub(page)
    }
    await open(page, [m4a])
    try {
      assert.equal(await rows(page).count(), 1, 'm4a not accepted as input')
      await set(page, '#audio-format', '.mp3')
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      assert.match(probe(join(dir, 'cover 一_converted_converted.mp3')).streams, /Audio: mp3/)
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

  'converter: PDF compress is built in (smaller, valid), encrypted stays on qpdf, compressing again shows not-smaller': async ({ page }) => {
    const doc = join(dir, '文件 一.pdf')
    copyFileSync(join(fixtures, 'test_fixture.pdf'), doc)
    // Owner password only: opens without one, and qpdf keeps the encryption.
    const enc = join(dir, '加密 一.pdf')
    execFileSync(QPDF, ['--encrypt', '', 'owner', '256', '--', doc, enc])
    // Truncated (no xref / trailer): the built-in can't read it, qpdf repairs it.
    const damaged = join(dir, '損壞 一.pdf')
    writeFileSync(damaged, readFileSync(doc).subarray(0, 1900))
    await open(page, [doc, enc, damaged])
    const out = join(dir, '文件 一_converted.pdf')
    try {
      await set(page, '#pdf-optimize', 'compress')
      assert.match(await run(page, 3), /^Completed 3 of 3/)
      assert.match(await log(page), /> Executing: builtin-pdf-compress "[^"]*文件 一.pdf" /)
      assert.match(await log(page), /> Executing: qpdf --stream-data=compress "[^"]*加密 一.pdf" /)
      assert.match(await log(page), /Built-in compressor failed: [^\n]*\n\+ (qpdf: [^\n]*--warning-exit-0|Ghostscript: )[^\n]*損壞 一.pdf/)
      assert.match(readFileSync(join(dir, '損壞 一_converted.pdf'), 'latin1'), /^%PDF-/)
      assert.equal(pdfPages(out), pdfPages(doc))
      assert.ok(statSync(out).size < statSync(doc).size, `${statSync(out).size} >= ${statSync(doc).size}`)
      assert.equal(await page.locator('.file-not-smaller').count(), 0)
      assert.match(execFileSync(QPDF, ['--show-encryption', join(dir, '加密 一_converted.pdf')], { encoding: 'utf8' }), /R = 6/)
    } finally {
      await backToHub(page)
    }

    // Already compressed: success, the queue says so, output = a copy of the input.
    await open(page, [out])
    try {
      await set(page, '#pdf-optimize', 'compress')
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      assert.equal(await page.locator('#file-size-0 .file-not-smaller').textContent(), "→ can't be made smaller")
      const again = join(dir, '文件 一_converted_converted.pdf')
      assert.ok(readFileSync(again).equals(readFileSync(out)))
    } finally {
      await backToHub(page)
    }
  },

  'converter: PDF level shows only for compress; Smallest converts and is saved in the preset': async ({ page }) => {
    const doc = join(dir, '文件 等級.pdf')
    copyFileSync(join(fixtures, 'test_fixture.pdf'), doc)
    await open(page, [doc])
    let saved
    try {
      await set(page, '#pdf-optimize', 'linearize')
      assert.equal(await page.locator('#pdf-level').count(), 0)
      await set(page, '#pdf-optimize', 'compress')
      assert.equal(await page.locator('#pdf-level').inputValue(), 'ebook')
      await set(page, '#pdf-level', 'screen')
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      assert.equal(pdfPages(join(dir, '文件 等級_converted.pdf')), pdfPages(doc))

      await page.click('#btn-save-preset')
      await page.waitForFunction(() => document.getElementById('preset-name')?.value === 'PDF · Compress · Smallest')
      await page.click('#btn-save-preset-confirm')
      await page.locator('#preset-save-message').waitFor()
      saved = (await invoke(page, 'list_presets')).at(-1)
      assert.deepEqual([saved.fileType, saved.settings], ['pdf', { optimize: 'compress', level: 'screen' }])
    } finally {
      if (saved) await page.evaluate((id) => window.SoraiPresets.remove(id), saved.id)
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
