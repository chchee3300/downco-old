// Converter jobs end to end (ported from the old test_conversion.js):
// real ffmpeg sidecar runs, outputs checked with ffmpeg itself. Video /
// audio / image once each, a failing file doesn't stop the batch, output
// names never overwrite, "under 5 MB" really is under 5,000,000 bytes, and
// cancel kills ffmpeg and cleans the partial file. PDF compress runs the
// built-in compressor (qpdf for encrypted files and ones it cannot read),
// image->PDF the real img2pdf sidecar; outputs checked with qpdf.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
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
  // A preview left open by a failed assertion would block the clicks below
  // (and this `finally` error would hide the real one).
  if (await page.locator('#pdf-preview-modal').count()) await page.click('#btn-pdf-preview-close')
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
      assert.deepEqual(await codecs(), ['libvpx-vp9', 'libsvtav1', 'copy'])
      await set(page, '#video-codec', 'libvpx-vp9')
      await page.waitForTimeout(500)
      assert.equal(await page.locator('#file-est-0').textContent(), webm, 'shown codec and estimate disagree')
      await set(page, '#video-format', '.mp4')
      assert.deepEqual(await codecs(), ['libx264', 'libx265', 'libvpx-vp9', 'libsvtav1', 'copy'])
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
      assert.deepEqual(await codecs(), ['libx264', 'libx265', 'copy'])
      assert.equal(await page.$eval('#video-codec', (s) => s.value), 'libx264', 'VP9 falls back to the container default')
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      const mov = join(dir, '容器 clip_converted.mov')
      assert.match(banner(mov), /major_brand\s*: qt/)
      assert.match(probe(mov).streams, /Video: h264[\s\S]*Audio: aac/)

      await set(page, '#video-format', '.wmv')
      assert.deepEqual(await codecs(), ['wmv2', 'copy'])
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

  // Audio-only outputs keep just the speed field; PNG shows no fields at all.
  // None of them (nor GIF/APNG) is offered in target-size mode.
  'converter: video -> M4A copies the aac track, video -> MP3 encodes it, video -> PNG grabs the middle frame': async ({ page }) => {
    const clip = join(dir, '取音 clip.mp4') // h264 + aac, 2 s, 320x240
    copyFileSync(join(fixtures, 'test_fixture_video.mp4'), clip)
    const formats = () => page.$$eval('#video-format option', (os) => os.map((o) => o.value))
    const shown = async () => {
      const out = []
      for (const [name, sel] of [['codec', '#video-codec-group'], ['size', '.target-size-chips'], ['quality', '#video-quality'], ['fps', '#video-fps'], ['speed', '#video-speed']]) {
        if (await page.locator(sel).isVisible()) out.push(name)
      }
      return out
    }
    await open(page, [clip])
    try {
      assert.deepEqual((await formats()).slice(-5), ['.gif', '.apng', '.png', '.m4a', '.mp3'])

      await set(page, '#video-format', '.m4a')
      assert.deepEqual(await shown(), ['speed'])
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      const m4a = probe(join(dir, '取音 clip_converted.m4a'))
      assert.match(m4a.streams, /Audio: aac/)
      assert.doesNotMatch(m4a.streams, /Video:/)
      assert.match(await log(page), /-c:a copy/)

      await set(page, '#video-format', '.mp3')
      assert.deepEqual(await shown(), ['speed'])
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      const mp3 = probe(join(dir, '取音 clip_converted.mp3'))
      assert.match(mp3.streams, /Audio: mp3/)
      assert.doesNotMatch(mp3.streams, /Video:/)

      await set(page, '#video-format', '.png')
      assert.deepEqual(await shown(), [])
      assert.match(await page.locator('#video-frame-hint').innerText(), /Trim/)
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      assert.match(await log(page), /-ss 1 -i .* -frames:v 1/)
      assert.match(probe(join(dir, '取音 clip_converted.png')).streams, /Video: png.*, 320x240/)

      // Target-size mode drops every special output from the picker.
      await set(page, '#video-format', '.mp4')
      await page.locator('.target-size-chips').getByRole('button', { name: '5 MB', exact: true }).click()
      assert.deepEqual(await formats(), ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.ts', '.wmv', '.mpg'])
      await page.locator('.target-size-chips').getByRole('button', { name: 'Off' }).click()
    } finally {
      await backToHub(page)
    }
  },

  // "copy" rewraps (-c:v copy, sound copied when the container takes it) and
  // hides quality / fps / speed; a codec the container can't hold (H.264 in
  // WebM) falls back to its default encoder, sound to libopus.
  'converter: keep original codec rewraps MP4 to MOV; WebM falls back to VP9': async ({ page }) => {
    const clip = join(dir, '保留 原編碼.mp4')
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440',
      '-t', '3', '-c:v', 'libx264', '-b:v', '4M', '-c:a', 'aac', clip])
    const srcMB = statSync(clip).size / 1048576
    const visible = (sel) => page.$eval(sel, (el) => !!el.offsetParent).catch(() => false)
    await open(page, [clip])
    try {
      await set(page, '#video-format', '.mov')
      await set(page, '#video-codec', 'copy')
      for (const sel of ['#video-quality', '#video-fps', '#video-speed']) assert.equal(await visible(sel), false, `${sel} still shown`)
      await page.waitForFunction((mb) => { const m = /→ ~([\d.]+) MB/.exec(document.getElementById('file-est-0').textContent); return m && Math.abs(+m[1] - mb) <= 0.1 }, srcMB, { timeout: 10_000 })
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      assert.match(await log(page), /-c:v copy -c:a copy/)
      const mov = join(dir, '保留 原編碼_converted.mov')
      assert.match(probe(mov).streams, /Video: h264[\s\S]*Audio: aac/)

      await set(page, '#video-format', '.webm')
      assert.equal(await page.$eval('#video-codec', (s) => s.value), 'copy')
      assert.equal(await visible('#video-quality'), false)
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      assert.match(await log(page), /-c:v libvpx-vp9/)
      assert.match(probe(join(dir, '保留 原編碼_converted.webm')).streams, /Video: vp9[\s\S]*Audio: opus/)

      await set(page, '#video-codec', 'libvpx-vp9')
      for (const sel of ['#video-quality', '#video-fps', '#video-speed']) assert.equal(await visible(sel), true, `${sel} not back`)
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

  'converter: PDF level shows only for compress; Smallest converts and is saved in the preset; a preset never keeps the password': async ({ page }) => {
    const doc = join(dir, '文件 等級.pdf')
    copyFileSync(join(fixtures, 'test_fixture.pdf'), doc)
    await open(page, [doc])
    const savedIds = []
    let saved
    const savePreset = async (name) => {
      await page.click('#btn-save-preset')
      await page.waitForFunction((n) => document.getElementById('preset-name')?.value === n, name)
      await page.click('#btn-save-preset-confirm')
      await page.waitForFunction((n) => document.getElementById('preset-save-message')?.textContent.includes(n), name)
      saved = (await invoke(page, 'list_presets')).at(-1)
      savedIds.push(saved.id)
      return saved
    }
    try {
      // Typed for encrypt, then left in settings for every other operation.
      await set(page, '#pdf-optimize', 'encrypt')
      await set(page, '#pdf-password', 'pw-秘密')
      saved = await savePreset('PDF · Encrypt')
      assert.deepEqual(saved.settings, { optimize: 'encrypt', level: 'ebook' }, 'password saved in the encrypt preset')
      await set(page, '#pdf-optimize', 'linearize')
      assert.equal(await page.locator('#pdf-level').count(), 0)
      await set(page, '#pdf-optimize', 'compress')
      assert.equal(await page.locator('#pdf-level').inputValue(), 'ebook')
      await set(page, '#pdf-level', 'screen')
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      assert.equal(pdfPages(join(dir, '文件 等級_converted.pdf')), pdfPages(doc))

      saved = await savePreset('PDF · Compress · Smallest')
      assert.deepEqual([saved.fileType, saved.settings], ['pdf', { optimize: 'compress', level: 'screen' }], 'no password in another operation either')
    } finally {
      for (const id of savedIds) await page.evaluate((i) => window.SoraiPresets.remove(i), id)
      await backToHub(page)
    }
  },

  'converter: PDF extract, rotate, encrypt (password not logged), split into a folder; a bad range fails only its row': async ({ page }) => {
    const sub = mkdtempSync(join(dir, 'pdf ops '))
    const one = join(sub, '頁面 一.pdf')
    // One 200pt page with a black square (the fixture PDF's page is blank,
    // and the preview check looks for drawn pixels). No xref: qpdf rebuilds it.
    const drawn = join(sub, 'drawn.tmp')
    const content = '0 0 0 rg 40 40 120 120 re f'
    writeFileSync(drawn, `%PDF-1.4
1 0 obj <</Type/Catalog/Pages 2 0 R>> endobj
2 0 obj <</Type/Pages/Kids[3 0 R]/Count 1>> endobj
3 0 obj <</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Resources<<>>/Contents 4 0 R>> endobj
4 0 obj <</Length ${content.length}>> stream
${content}
endstream endobj
trailer <</Size 5/Root 1 0 R>>
%%EOF
`)
    execFileSync(QPDF, ['--warning-exit-0', drawn, one])
    rmSync(drawn)
    const three = join(sub, '頁面 三.pdf')
    execFileSync(QPDF, ['--empty', '--pages', one, one, one, '--', three])
    // Names of the outputs a batch adds to `sub`.
    const added = async (fn) => {
      const before = new Set(readdirSync(sub))
      await fn()
      return readdirSync(sub).filter((f) => !before.has(f))
    }
    // Uncompressed, unencrypted copy: page dicts readable as text.
    const qdf = (file, pw = '') => execFileSync(QPDF, [`--password=${pw}`, '--qdf', '--object-streams=disable', '--decrypt', file, '-'], { encoding: 'latin1' })
    const PW = 'pw-秘密-4217'
    await open(page, [three])
    let out
    try {
      // Preview: pdf.js viewer (own toolbar: page number + zoom only), served by sorai-media://.
      await page.click('#btn-pdf-preview-0')
      await page.waitForFunction(() => document.getElementById('pdf-page-count')?.textContent === '/ 3', null, { timeout: 15_000 })
      assert.equal(await page.locator('#pdf-preview-modal canvas').count(), 3)
      assert.equal(await page.locator('#pdf-preview-modal iframe').count(), 0)
      // Page 1 is drawn (not just a blank sized canvas).
      await page.waitForFunction(() => {
        const c = document.querySelector('#pdf-page-1 canvas')
        if (!c?.width) return false
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] && (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250)) return true
        return false
      }, null, { timeout: 15_000 })
      assert.match(await page.locator('#pdf-page-2').innerText(), /Page 2/)
      // Floating navbar over the pages.
      assert.equal(await page.locator('.pdf-viewer-navbar').evaluate((n) => getComputedStyle(n).position), 'absolute')
      const zoomLabel = () => page.locator('#pdf-zoom-input').inputValue()
      const fit = await zoomLabel()
      await page.click('#pdf-zoom-in')
      assert.notEqual(await zoomLabel(), fit)
      await page.click('#pdf-zoom-fit')
      assert.equal(await zoomLabel(), fit)
      // Ctrl+wheel zooms (at the cursor); Ctrl+0 back to fit width; Ctrl+= / Ctrl+- step.
      const box = await page.locator('#pdf-viewer-scroll').boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.keyboard.down('Control')
      await page.mouse.wheel(0, -100)
      await page.keyboard.up('Control')
      await page.waitForFunction((f) => document.getElementById('pdf-zoom-input').value !== f, fit)
      assert.ok(parseInt(await zoomLabel()) > parseInt(fit), `${await zoomLabel()} > ${fit}`)
      await page.keyboard.press('Control+0')
      assert.equal(await zoomLabel(), fit)
      await page.keyboard.press('Control+-')
      assert.ok(parseInt(await zoomLabel()) < parseInt(fit))
      await page.keyboard.press('Control+0')
      // Typed zoom: Enter applies (clamped to 25–500), Escape / blur drop the typing.
      await page.fill('#pdf-zoom-input', '200')
      await page.press('#pdf-zoom-input', 'Enter')
      assert.equal(await zoomLabel(), '200')
      await page.fill('#pdf-zoom-input', '9000')
      await page.press('#pdf-zoom-input', 'Enter')
      assert.equal(await zoomLabel(), '500')
      await page.fill('#pdf-zoom-input', '37')
      await page.press('#pdf-zoom-input', 'Escape')
      assert.equal(await zoomLabel(), '500')
      assert.equal(await page.locator('#pdf-preview-modal').count(), 1, 'Escape in the zoom box keeps the preview open')
      await page.keyboard.press('Control+0')
      // Page keys: End / Home / → / ←, and typing a page number.
      const pageNo = () => page.locator('#pdf-page-input').inputValue()
      await page.keyboard.press('End')
      assert.equal(await pageNo(), '3')
      await page.keyboard.press('Home')
      assert.equal(await pageNo(), '1')
      await page.keyboard.press('ArrowRight')
      assert.equal(await pageNo(), '2')
      await page.keyboard.press('ArrowLeft')
      assert.equal(await pageNo(), '1')
      await page.fill('#pdf-page-input', '3')
      await page.press('#pdf-page-input', 'Enter')
      assert.equal(await pageNo(), '3')
      await page.click('#btn-pdf-preview-close')
      assert.equal(await page.locator('#pdf-preview-modal').count(), 0)
      await page.click('#btn-pdf-preview-0')
      await page.locator('#pdf-page-count').waitFor()
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('#pdf-preview-modal').count(), 0)

      await set(page, '#pdf-optimize', 'extract')
      assert.equal(await page.locator('#pdf-level').count(), 0)
      assert.equal(await page.locator('#pdf-password').count(), 0)
      // Page tools don't warn "file will get bigger".
      await page.waitForFunction(() => /→ ~/.test(document.getElementById('file-est-0').textContent))
      assert.ok(!(await page.locator('#file-est-0').innerText()).includes('⚠'))
      // All pages / specific pages: specific is the default and shows the range.
      assert.equal(await page.locator('#pdf-pages-some').getAttribute('aria-checked'), 'true')
      await page.click('#pdf-pages-all')
      assert.equal(await page.locator('#pdf-pages').count(), 0)
      ;[out] = await added(async () => assert.match(await run(page, 1), /^Completed 1 of 1/))
      assert.equal(pdfPages(join(sub, out)), 3)
      await page.click('#pdf-pages-some')
      await set(page, '#pdf-pages', '1')
      ;[out] = await added(async () => assert.match(await run(page, 1), /^Completed 1 of 1/))
      assert.equal(pdfPages(join(sub, out)), 1)

      await set(page, '#pdf-optimize', 'rotate')
      assert.equal(await page.locator('#pdf-angle').inputValue(), '90')
      await set(page, '#pdf-pages', '')
      ;[out] = await added(async () => assert.match(await run(page, 1), /^Completed 1 of 1/))
      assert.equal(pdfPages(join(sub, out)), 3)
      assert.equal(qdf(join(sub, out)).match(/\/Rotate 90\b/g)?.length, 3, 'every page /Rotate 90')

      await set(page, '#pdf-optimize', 'encrypt')
      assert.equal(await page.locator('#pdf-password').getAttribute('type'), 'password')
      await set(page, '#pdf-password', PW)
      ;[out] = await added(async () => assert.match(await run(page, 1), /^Completed 1 of 1/))
      assert.match(execFileSync(QPDF, [`--password=${PW}`, '--show-encryption', join(sub, out)], { encoding: 'utf8' }), /R = 6[\s\S]*AESv3/)
      assert.ok(!(await log(page)).includes(PW), 'password in the log')
      assert.match(await log(page), /> Executing: qpdf --encrypt \*\*\* \*\*\* 256 -- /)

      await set(page, '#pdf-optimize', 'split')
      ;[out] = await added(async () => assert.match(await run(page, 1), /^Completed 1 of 1/))
      assert.equal(out, '頁面 三_pages')
      const pages = readdirSync(join(sub, out)).sort()
      assert.deepEqual(pages, ['頁面 三-1.pdf', '頁面 三-2.pdf', '頁面 三-3.pdf'])
      for (const f of pages) assert.equal(pdfPages(join(sub, out, f)), 1)
      // The row shows the folder's total size.
      const total = pages.reduce((n, f) => n + statSync(join(sub, out, f)).size, 0)
      assert.match(await page.locator('#file-size-0').innerText(), new RegExp(`→ ${(total / (1024 * 1024)).toFixed(2)} MB`))
    } finally {
      await backToHub(page)
    }

    // A bad range / no password: each file fails on its own row, the batch goes on, nothing left behind.
    await open(page, [one, three])
    try {
      const badBatch = async () => {
        const created = await added(async () => {
          await page.click('#btn-execute')
          await page.waitForFunction(() => /^Completed 0 of 2/.test(document.getElementById('progress-text').innerText), null, { timeout: 30_000 })
        })
        assert.deepEqual(created, [])
      }
      await set(page, '#pdf-optimize', 'extract')
      await set(page, '#pdf-pages', 'abc')
      await badBatch()
      for (const i of [0, 1]) assert.match(await page.locator(`#file-size-${i} .file-failed`).getAttribute('title'), /invalid page range/)
      await page.waitForFunction(() => !/Cancel/.test(document.getElementById('btn-execute')?.textContent ?? ''))
      await page.waitForTimeout(5500) // progress text resets 5 s after a batch
      await set(page, '#pdf-optimize', 'encrypt')
      await set(page, '#pdf-password', '')
      await badBatch()
      for (const i of [0, 1]) assert.equal(await page.locator(`#file-size-${i} .file-failed`).getAttribute('title'), 'no password')
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

  // "Merge into one file": one start_merge job, `<first>_merged.<ext>`.
  'converter: merge clips (different size, one silent) into MP4; alike clips + keep codec use the concat demuxer; no checkbox for 1 file or GIF': async ({ page }) => {
    const sub = mkdtempSync(join(dir, 'merge video '))
    const gen = (name, size, secs, sound) => {
      const f = join(sub, name)
      execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `testsrc2=size=${size}:rate=30`,
        ...(sound ? ['-f', 'lavfi', '-i', 'sine=frequency=440'] : []), '-t', String(secs), '-c:v', 'libx264', ...(sound ? ['-c:a', 'aac'] : []), f])
      return f
    }
    const a = gen('合併 一.mp4', '320x240', 2, true)
    const b = gen('合併 二.mp4', '640x360', 3, false)
    const a2 = join(sub, '合併 三.mp4')
    copyFileSync(a, a2)
    const box = () => page.locator('#merge-files').count()

    await open(page, [a])
    try {
      assert.equal(await box(), 0, 'checkbox with 1 file')
    } finally {
      await backToHub(page)
    }

    await open(page, [a, b])
    try {
      await set(page, '#video-format', '.gif')
      assert.equal(await box(), 0, 'checkbox with GIF output')
      await set(page, '#video-format', '.mp4')
      await page.check('#merge-files')
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      const out = join(sub, '合併 一_merged.mp4')
      const p = probe(out)
      assert.ok(Math.abs(p.duration - 5) < 0.3, `duration ${p.duration} (2 s + 3 s)`)
      assert.match(p.streams, /Video: h264.*, 320x240/)
      assert.match(p.streams, /Audio: aac/)
      assert.match(await page.locator('#status-text').innerText(), /合併 一_merged\.mp4/)
      assert.match(await log(page), /合併 一_merged\.mp4/)
    } finally {
      await backToHub(page)
    }

    await open(page, [a, a2])
    try {
      await set(page, '#video-codec', 'copy')
      await page.check('#merge-files')
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      assert.match(await log(page), /> Executing: ffmpeg -y -f concat /)
      assert.ok(Math.abs(probe(join(sub, '合併 一_merged_merged.mp4')).duration - 4) < 0.3)
    } finally {
      await backToHub(page)
    }
  },

  'converter: merge two mp3s; merge PDFs in the order set with move up / down': async ({ page }) => {
    const sub = mkdtempSync(join(dir, 'merge more '))
    const songs = ['歌 一.mp3', '歌 二.mp3'].map((n) => join(sub, n))
    for (const s of songs) copyFileSync(join(fixtures, 'test_fixture_audio.mp3'), s)
    const each = probe(songs[0]).duration
    await open(page, songs)
    try {
      await page.check('#merge-files')
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      const d = probe(join(sub, '歌 一_merged.mp3')).duration
      assert.ok(Math.abs(d - 2 * each) < 0.3, `duration ${d} (2 x ${each})`)
    } catch (e) {
      await backToHub(page)
      throw e
    }

    const one = join(sub, '文 一.pdf')
    copyFileSync(join(fixtures, 'test_fixture.pdf'), one)
    const three = join(sub, '文 三.pdf') // 3 pages, all /Rotate 90
    execFileSync(QPDF, ['--empty', '--pages', one, one, one, '--', '--rotate=+90', three])
    // QDF marks each page with "%% Page N": page 1's own objects.
    const page1 = (file) => execFileSync(QPDF, ['--qdf', '--object-streams=disable', file, '-'], { encoding: 'latin1' }).split('%% Page 2')[0].split('%% Page 1')[1]
    // Same Converter session: empty the queue, add PDFs; merge starts unchecked again.
    try {
      await page.waitForFunction(() => !/Cancel/.test(document.getElementById('btn-execute')?.textContent ?? ''), null, { timeout: 30_000 })
      while ((await rows(page).count()) > 0) await rows(page).first().locator('button.remove').click()
      await stubDialogs(page, { openFiles: [one, three] })
      await page.locator('.drop-zone-message').click()
      await page.waitForFunction(() => document.querySelectorAll('.file-item').length === 2, null, { timeout: 30_000 })
      assert.equal(await page.locator('#merge-files').isChecked(), false, 'merge still checked after the queue emptied')
      assert.equal(await page.locator('#btn-move-up-0').count(), 0)
      assert.equal(await page.locator('#btn-move-down-1').count(), 0)
      await page.check('#merge-files')
      assert.equal(await page.locator('#pdf-settings').isVisible(), false, 'operation dropdown shown while merging')
      await page.click('#btn-move-down-0')
      assert.match(await rows(page).first().innerText(), /文 三\.pdf/)
      assert.match(await run(page, 1), /^Completed 1 of 1/)
      const out = join(sub, '文 三_merged.pdf')
      assert.equal(pdfPages(out), 4)
      assert.match(page1(out), /\/Rotate 90\b/, 'page 1 comes from the file moved up')
      await page.uncheck('#merge-files')
      assert.equal(await page.locator('#pdf-settings').isVisible(), true)
    } finally {
      await backToHub(page)
    }
  },

  'converter: cancelling a merge leaves no _merged file': async ({ page }) => {
    const sub = mkdtempSync(join(dir, 'merge cancel '))
    const clips = ['一', '二'].map((x) => join(sub, `取消合併 ${x}.mp4`))
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440',
      '-t', '20', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', clips[0]])
    copyFileSync(clips[0], clips[1])
    await open(page, clips)
    try {
      await set(page, '#video-codec', 'libsvtav1') // slow: a window to cancel in
      await page.check('#merge-files')
      await page.click('#btn-execute')
      await page.waitForFunction(() => document.getElementById('terminal-log').innerText.includes('> Executing:'), null, { timeout: 20_000 })
      await page.waitForTimeout(500)
      await page.click('#btn-execute') // Cancel
      await page.waitForFunction(() => /^Cancelled/.test(document.getElementById('progress-text').innerText), null, { timeout: 10_000 })
      await page.locator('#btn-execute:has-text("Start Processing"):not([disabled])').waitFor({ timeout: 5_000 })
      assert.deepEqual(readdirSync(sub).filter((f) => f.includes('_merged')), [], 'partial merge left behind')
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
