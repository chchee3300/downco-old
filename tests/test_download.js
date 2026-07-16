// Real end-to-end regression test: metadata fetch + a real download through
// yt-dlp, driving the Downloader tool through the HUB (not the
// sorai-toolkit-downloader repo's own standalone harness) -- confirms the
// composed app (hub shell + git-dependency package + shared platform.js/
// binaries/) actually works, not just the isolated package. Ported from
// sorai-toolkit-downloader's own tests/test_download.js with a navigation
// step added (see test_conversion.js's `.hub-card` pattern from Phase A/B).
// Uses a short, stable, well-known public test video ("Me at the zoo", the
// first YouTube video, ~19s) so a real download completes quickly.
// Run with: node tests/test_download.js (from the project root)
// Exits 0 on success, 1 on any failure.
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const { chromium } = require('playwright');
const { spawnNeu, killNeuTree } = require('./lib/neu-launch');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

const results = [];
function check(name, cond, extra) {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && extra !== undefined ? '  -> ' + extra : ''}`);
}

function waitForAuthInfo(sinceMs, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function poll() {
      try {
        const st = fs.statSync(path.join(PROJECT_ROOT, '.tmp', 'auth_info.json'));
        if (st.mtimeMs > sinceMs) return resolve();
      } catch (e) {
        /* not written yet */
      }
      if (Date.now() - t0 > timeoutMs) return reject(new Error('auth_info.json not refreshed within ' + timeoutMs + 'ms'));
      setTimeout(poll, 500);
    })();
  });
}

async function main() {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-verify-hub-'));
  console.log('Output dir:', outDir);

  const launchTime = Date.now();
  const neu = spawnNeu(PROJECT_ROOT);
  neu.stdout.on('data', (d) => process.stdout.write('[neu] ' + d));
  neu.stderr.on('data', (d) => process.stderr.write('[neu:err] ' + d));
  let browser = null;

  try {
    await waitForAuthInfo(launchTime);
    const auth = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, '.tmp', 'auth_info.json'), 'utf8'));
    const url = 'http://localhost:' + auth.nlPort + '/?nlToken=' + auth.nlToken;
    console.log('Connecting to', url);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
    await page.addInitScript((t) => { try { sessionStorage.setItem('NL_TOKEN', t); } catch (e) {} }, auth.nlToken);
    await page.goto(url);
    await page.waitForSelector('.hub-grid');
    await page.click('.hub-card:has-text("Downloader")');
    await page.waitForSelector('#url-panel');
    await page.waitForFunction(() => typeof window.Neutralino !== 'undefined' && !!window.EstellaLib?.platform);

    // Mock the native folder dialog -- Playwright can't drive a real OS
    // dialog, and this test's goal is the download pipeline, not the
    // picker UI.
    await page.evaluate((dir) => {
      window.Neutralino.os.showFolderDialog = async () => dir;
    }, outDir);

    console.log('\n--- METADATA FETCH ---');
    // Downloader now queues videos rather than handling one at a time --
    // adding a URL appends it to a queue list and auto-selects it; the
    // right panel (with the video/audio format selects, split into two
    // independent dropdowns) shows whichever item is selected. Metadata
    // lands on the queue row (.queue-item-*), not a standalone #metadata-*
    // block. waitForFunction, not waitForSelector, on the format selects --
    // the native <select> is display:none by design (GlassSelect replaces
    // it with a LiquidSelect overlay), so a visibility-based wait would hang.
    await page.fill('#video-url', TEST_URL);
    await page.click('#btn-fetch');
    await page.waitForFunction(
      () => document.querySelectorAll('#video-format-select option').length > 0,
      null,
      { timeout: 30000 },
    );
    const title = await page.$eval('.queue-item-title', (el) => el.textContent);
    check('M1: title fetched', title && title.length > 0, title);
    const hasThumb = await page.$eval('.queue-item-thumb', (el) => el.tagName === 'IMG');
    check('M2: thumbnail element present', hasThumb);
    const channelText = await page.$eval('.queue-item-channel', (el) => el.textContent).catch(() => null);
    check('M3: duration text present', !!channelText, channelText);
    const videoFormatCount = await page.$$eval('#video-format-select option', (opts) => opts.length);
    check('M4: video format options populated', videoFormatCount > 0, videoFormatCount);
    const audioFormatCount = await page.$$eval('#audio-format-select option', (opts) => opts.length);
    check('M4b: audio format options populated', audioFormatCount > 0, audioFormatCount);

    // No need to force a specific format here -- the video/audio selects
    // only ever list video-only/audio-only formats respectively, so leaving
    // the default best-quality picks (both streams + auto-merge, all on by
    // default) already exercises the --ffmpeg-location merge path against
    // the hub's own bundled ffmpeg (shared with Converter).
    check('M5: both streams included and auto-merge on by default', await page.evaluate(() => (
      document.getElementById('include-video-checkbox').checked &&
      document.getElementById('include-audio-checkbox').checked &&
      document.getElementById('auto-merge-checkbox').checked
    )));

    console.log('\n--- DOWNLOAD ---');
    await page.click('#btn-select-output');
    await page.waitForFunction((dir) => document.getElementById('output-path').value === dir, outDir);
    check('D1: output path set', true);

    await page.click('#btn-download');
    // waitForFunction's 3-arg form is (pageFunction, arg, options) -- pass
    // `null` for the unused arg so `{ timeout }` lands as options and not as
    // arg (a callback that takes no parameter silently swallows a 2-arg
    // `{ timeout }` as its arg instead, falling back to Playwright's default
    // 30s timeout regardless of what's requested here).
    await page.waitForFunction(
      () => /Download complete|Cancelled|Error/.test(document.querySelector('.statusbar-text')?.textContent || ''),
      null,
      { timeout: 120000 },
    );
    const statusText = await page.$eval('.statusbar-text', (el) => el.textContent);
    check('D2: download completed', /Download complete/.test(statusText), statusText);

    const files = fs.readdirSync(outDir);
    check('D3: output file exists in chosen folder', files.length > 0, files.join(', '));
    if (files.length > 0) {
      const outFile = path.join(outDir, files[0]);
      const stat = fs.statSync(outFile);
      check('D4: output file non-empty', stat.size > 0, stat.size);

      // Confirm the merge actually happened using the HUB's own bundled
      // ffmpeg (binaries/win_x64/ffmpeg.exe, shared with Converter) -- not
      // a copy bundled by Downloader itself.
      const ffmpegBin = path.join(PROJECT_ROOT, 'binaries', 'win_x64', 'ffmpeg.exe');
      const probe = cp.spawnSync(ffmpegBin, ['-i', outFile], { encoding: 'utf8' });
      const probeOut = (probe.stderr || '') + (probe.stdout || '');
      check('D5: merged output has a video stream', /Stream #\d+:\d+.*Video:/.test(probeOut));
      check('D6: merged output has an audio stream', /Stream #\d+:\d+.*Audio:/.test(probeOut));
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    killNeuTree(neu.pid);
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n==== ${results.length - failed}/${results.length} checks passed ====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
