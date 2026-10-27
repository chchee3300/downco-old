// Settings "Conversion engines" + the Ghostscript route of PDF compress,
// with a fake gs (tests/fixtures/fake-gs.rs, built here with rustc): the
// converter's status line links to Settings, "Use my own program…" picks
// the fake (stored in engines.json), the smaller of built-in / gs wins, a
// failing gs keeps the built-in result, "Back to auto-detect" clears it.
// Install / Cancel / Remove against a local server (run.mjs sets the dev
// URL + SHA override) serving tests/fixtures/fake-ghostscript.conda.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { invoke, stubDialogs } from './helpers.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const fixtures = join(root, 'tests', 'fixtures')
const dir = mkdtempSync(join(tmpdir(), 'sorai 引擎 '))
const gsDir = join(dir, 'gs 假')
const fakeGs = join(gsDir, 'gswin64c.exe')
const gsOutput = join(gsDir, 'gs-output.pdf')
// Tauri's app_config_dir for the dev identifier (Windows).
const enginesJson = join(process.env.APPDATA, `com.soraitoolkit.hub.dev${process.env.CDP_PORT || 9229}`, 'engines.json')

// Tauri's app_local_data_dir: the app's own copy lives in engines/ghostscript.
const enginesDir = join(process.env.LOCALAPPDATA, `com.soraitoolkit.hub.dev${process.env.CDP_PORT || 9229}`, 'engines')
const listEngines = () => (existsSync(enginesDir) ? readdirSync(enginesDir) : [])

const set = (page, selector, value) =>
  page.evaluate(([sel, v]) => {
    const el = document.querySelector(sel)
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, [selector, String(value)])

const log = (page) => page.locator('#terminal-log').innerText()
const executions = async (page) => (await log(page)).split('> Executing:').length - 1

// Same as converter-convert's run(): wait for this job's header, then "Completed".
async function run(page) {
  const before = await executions(page)
  await page.click('#btn-execute')
  await page.waitForFunction((n) => document.getElementById('terminal-log').innerText.split('> Executing:').length - 1 > n, before, { timeout: 60_000 })
  await page.waitForFunction(() => /^(Completed|Cancelled)/.test(document.getElementById('progress-text').innerText), null, { timeout: 60_000 })
  return page.locator('#progress-text').innerText()
}

const ghostscript = async (page) => (await invoke(page, 'plugin:sorai-converter|engine_status')).find((e) => e.id === 'ghostscript')

export const tests = {
  'engines: status links to Settings, "Use my own program…" picks a fake gs, smaller result wins, failure keeps built-in': async ({ page }) => {
    mkdirSync(gsDir)
    execFileSync('rustc', ['-O', '-o', fakeGs, join(fixtures, 'fake-gs.rs')], { stdio: 'pipe' })
    await invoke(page, 'plugin:sorai-converter|engine_set_path', { engine: 'ghostscript', path: null })
    const before = await ghostscript(page)
    assert.equal(before.license, 'AGPL-3.0')
    const doc = join(dir, '文件 一.pdf')
    copyFileSync(join(fixtures, 'test_fixture.pdf'), doc)
    const out = join(dir, '文件 一_converted.pdf')

    await page.locator('.hub-card:has-text("Converter")').click()
    await page.locator('.drop-zone-message').waitFor()
    await stubDialogs(page, { openFiles: [doc] })
    await page.locator('.drop-zone-message').click()
    await page.locator('.file-item').first().waitFor()
    const row = page.locator('#settings-engines .engine-row[data-id="ghostscript"]')
    try {
      await set(page, '#pdf-optimize', 'compress')
      // No Ghostscript on this machine: the line says so; built-in only.
      if (before.state === 'missing') {
        await page.locator('#pdf-engine-status[data-state="missing"]').waitFor()
        assert.match(await page.locator('#pdf-engine-status').innerText(), /Install Ghostscript to compress smaller/)
        assert.match(await run(page), /^Completed 1 of 1/)
        assert.doesNotMatch(await log(page), /\+ Ghostscript:/)
      } else {
        console.log(`  (Ghostscript already here: ${before.state} ${before.path}; "missing" checks skipped)`)
      }
      rmSync(out, { force: true })

      // The line's link opens Settings at the engines section.
      await page.click('#pdf-engine-settings')
      await row.waitFor({ state: 'visible' })
      assert.match(await row.innerText(), /AGPL-3\.0/)
      if (before.state === 'missing') assert.match(await row.locator('.engine-state').innerText(), /Not installed/)

      await stubDialogs(page, { openFiles: [fakeGs] })
      await row.locator('.engine-pick').click()
      await page.locator('#settings-engines .engine-row[data-state="user"]').waitFor()
      assert.match(await row.locator('.engine-state').innerText(), /Using the program on this computer/)
      assert.equal(await row.locator('.engine-path').innerText(), fakeGs)
      assert.equal(JSON.parse(readFileSync(enginesJson, 'utf8')).ghostscriptPath, fakeGs)
      assert.equal((await ghostscript(page)).path, fakeGs)
      await row.locator('.engine-recheck').click()
      await page.locator('#settings-engines .engine-row[data-state="user"]').waitFor()
      await page.locator('.settings-modal-content .about-modal-close').click()
      // The converter's line re-checked on its own.
      await page.locator('#pdf-engine-status[data-state="user"]').waitFor()
      assert.match(await page.locator('#pdf-engine-status').innerText(), /Ghostscript is enabled/)

      // gs gives the smaller file: it's the output; args carry the level.
      writeFileSync(gsOutput, '%PDF-1.6\n% fake gs\n')
      await set(page, '#pdf-level', 'screen')
      assert.match(await run(page), /^Completed 1 of 1/)
      assert.ok(readFileSync(out).equals(readFileSync(gsOutput)), 'output is not the gs result')
      const args = readFileSync(join(gsDir, 'args.txt'), 'utf8').split('\n')
      for (const a of ['-sDEVICE=pdfwrite', '-dPDFSETTINGS=/screen', '-dCompatibilityLevel=1.6']) assert.ok(args.includes(a), `${a} not in ${args}`)
      assert.equal(args.at(-1), doc)
      const tmpOut = args.find((a) => a.startsWith('-sOutputFile=')).slice('-sOutputFile='.length)
      assert.ok(!existsSync(tmpOut), 'gs temp file left behind')
      assert.match(await log(page), /\+ Ghostscript: .*-dPDFSETTINGS=\/screen/)
      rmSync(out)

      // gs gives a bigger file: the built-in result is kept.
      writeFileSync(gsOutput, Buffer.alloc(200_000, 'x'))
      assert.match(await run(page), /^Completed 1 of 1/)
      const builtin = statSync(out).size
      assert.ok(builtin < statSync(doc).size, `built-in ${builtin} not smaller`)
      assert.match(readFileSync(out, 'latin1'), /^%PDF-/)
      rmSync(out)

      // gs fails: logged, the built-in result is kept, the job succeeds.
      rmSync(gsOutput)
      assert.match(await run(page), /^Completed 1 of 1/)
      assert.match(await log(page), /Ghostscript failed, keeping the built-in result: exited with .*fake gs: gs-output\.pdf/)
      assert.equal(statSync(out).size, builtin)
      rmSync(out)

      // "Back to auto-detect" clears it from engines.json.
      await page.evaluate(() => window.SoraiSettings.open('engines'))
      await row.locator('.engine-clear').click()
      await page.locator(`#settings-engines .engine-row[data-state="${before.state}"]`).waitFor()
      assert.equal(JSON.parse(readFileSync(enginesJson, 'utf8')).ghostscriptPath, undefined)
      await page.locator('.settings-modal-content .about-modal-close').click()
    } finally {
      await invoke(page, 'plugin:sorai-converter|engine_set_path', { engine: 'ghostscript', path: null })
      await page.waitForFunction(() => !/Cancel/.test(document.getElementById('btn-execute')?.textContent ?? ''), null, { timeout: 30_000 })
      if (await page.locator('.settings-modal-content .about-modal-close:visible').count()) await page.locator('.settings-modal-content .about-modal-close').click()
      while ((await page.locator('.file-item').count()) > 0) await page.locator('.file-item').first().locator('button.remove').click()
      await page.locator('[aria-label="Back to hub"]').click()
      await page.locator('.hub-card').first().waitFor()
    }
  },

  'engines: Install downloads the package (SHA checked), Cancel and a bad SHA leave nothing, Remove deletes it': async ({ page }) => {
    // run.mjs points the dev build at this server, SHA = the fixture's.
    const conda = readFileSync(join(fixtures, 'fake-ghostscript.conda'))
    let mode = 'bad'
    const server = createServer((req, res) => {
      if (mode === 'stall') {
        // Half the bytes, then nothing: Cancel must not wait for more.
        res.writeHead(200, { 'Content-Length': conda.length })
        res.write(conda.subarray(0, conda.length / 2))
        return
      }
      const body = mode === 'bad' ? Buffer.concat([conda, Buffer.from('x')]) : conda
      res.writeHead(200, { 'Content-Length': body.length }).end(body)
    })
    await new Promise((r) => server.listen(Number(process.env.CDP_PORT || 9229) + 2, '127.0.0.1', r))
    const row = page.locator('#settings-engines .engine-row[data-id="ghostscript"]')
    try {
      await invoke(page, 'plugin:sorai-converter|engine_remove', { engine: 'ghostscript' })
      await invoke(page, 'plugin:sorai-converter|engine_set_path', { engine: 'ghostscript', path: null })
      const before = await ghostscript(page)
      assert.equal(before.installable, true)
      assert.equal(before.installed, false)
      await page.evaluate(() => window.SoraiSettings.open('engines'))
      await row.locator('.engine-install').waitFor()
      assert.equal(await row.locator('.engine-remove').count(), 0)

      // Wrong SHA: refused, the download deleted, nothing installed.
      await row.locator('.engine-install').click()
      await page.locator('#settings-engines [role="alert"]').waitFor()
      assert.match(await page.locator('#settings-engines [role="alert"]').innerText(), /SHA-256 mismatch/)
      await row.locator('.engine-install').waitFor()
      assert.deepEqual(listEngines(), [])

      // Cancel mid-download: no staging or install folder left.
      mode = 'stall'
      await row.locator('.engine-install').click()
      await page.waitForFunction(() => Number(document.querySelector('.engine-progress progress')?.value) > 0, null, { timeout: 30_000 })
      assert.match(await row.locator('.engine-progress').innerText(), /Downloading… \d+%/)
      await row.locator('.engine-cancel').click()
      await row.locator('.engine-install').waitFor({ timeout: 5_000 })
      assert.equal(await page.locator('#settings-engines [role="alert"]').count(), 0, 'cancel shown as an error')
      assert.deepEqual(listEngines(), [])
      assert.equal((await ghostscript(page)).installed, false)

      // Install: "Installed", only Library/bin in the own-copy folder.
      mode = 'good'
      await row.locator('.engine-install').click()
      await page.locator('#settings-engines .engine-row[data-state="installed"]').waitFor({ timeout: 30_000 })
      assert.match(await row.locator('.engine-state').innerText(), /^Installed$/)
      assert.deepEqual(listEngines(), ['ghostscript'])
      assert.deepEqual(readdirSync(join(enginesDir, 'ghostscript')).sort(), ['gsdll64.dll', 'gswin64c.exe'])
      const gs = join(enginesDir, 'ghostscript', 'gswin64c.exe')
      assert.equal(await row.locator('.engine-path').innerText(), gs)
      assert.equal((await ghostscript(page)).path, gs)
      assert.equal(await row.locator('.engine-install').count(), 0)

      // Remove: folder gone, back to what it was.
      await row.locator('.engine-remove').click()
      await page.locator(`#settings-engines .engine-row[data-state="${before.state}"]`).waitFor()
      assert.ok(!existsSync(join(enginesDir, 'ghostscript')))
      await row.locator('.engine-install').waitFor()
      await page.locator('.settings-modal-content .about-modal-close').click()
    } finally {
      server.closeAllConnections()
      server.close()
      await invoke(page, 'plugin:sorai-converter|engine_cancel').catch(() => {})
      await invoke(page, 'plugin:sorai-converter|engine_remove', { engine: 'ghostscript' }).catch(() => {})
      if (await page.locator('.settings-modal-content .about-modal-close:visible').count()) await page.locator('.settings-modal-content .about-modal-close').click()
    }
  },
}
