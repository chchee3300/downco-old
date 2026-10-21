// E2E runner: `npm run test:e2e [-- <filter>]`.
// Starts `tauri dev` (scripts/tauri-dev.mjs), waits for the real Tauri window,
// connects Playwright over CDP, runs every tests/e2e/*.test.mjs, then kills
// the whole process tree. Ports: VITE_PORT / CDP_PORT (defaults 5173 / 9229)
// -- pick a unique pair per worktree when several run at once.
//
// A test file exports `tests = { 'name': async ({ page, browser }) => {} }`.
// The filter (substring) matches file or test names.
import { chromium } from 'playwright'
import { mkdtempSync, readdirSync, createWriteStream, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { killTree, ports, tauriDev } from '../../scripts/tauri-dev.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const filter = process.argv[2] ?? ''
const { vitePort, cdpPort } = ports()
const cdp = `http://127.0.0.1:${cdpPort}`
const devUrl = `http://localhost:${vitePort}`
const BOOT_TIMEOUT_MS = 15 * 60_000 // a cold Rust build alone takes minutes

const up = (url) => fetch(url).then((r) => r.ok, () => false)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (await up(`${cdp}/json/version`)) {
  console.error(`CDP port ${cdpPort} is already in use -- set CDP_PORT to a free port`)
  process.exit(1)
}

const scratch = mkdtempSync(join(tmpdir(), 'sorai-e2e-'))
const logPath = join(scratch, 'tauri-dev.log')
const log = createWriteStream(logPath)
const child = tauriDev({ vitePort, cdpPort, userDataDir: join(scratch, 'webview2'), stdio: ['ignore', 'pipe', 'pipe'] })
child.stdout.pipe(log)
child.stderr.pipe(log)
let exited = false
child.on('exit', () => (exited = true))
console.log(`tauri dev starting (vite ${vitePort}, cdp ${cdpPort}); log: ${logPath}`)

let failed = 0
let passed = 0
let browser
try {
  const deadline = Date.now() + BOOT_TIMEOUT_MS
  while (!(await up(`${cdp}/json/version`))) {
    if (exited) throw new Error('tauri dev exited before the window came up')
    if (Date.now() > deadline) throw new Error('timed out waiting for the Tauri window')
    await sleep(1000)
  }
  browser = await chromium.connectOverCDP(cdp)
  let page
  while (!(page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith(devUrl)))) {
    if (Date.now() > deadline) throw new Error(`no page at ${devUrl}`)
    await sleep(500)
  }
  // Fresh profile follows the OS locale (zh-TW here); pin English so tests
  // can match on UI text.
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => localStorage.setItem('sorai-lang', 'en'))
  await page.reload()

  const files = readdirSync(here).filter((f) => f.endsWith('.test.mjs')).sort()
  for (const file of files) {
    const { tests } = await import(pathToFileURL(join(here, file)))
    for (const [name, fn] of Object.entries(tests)) {
      if (filter && !file.includes(filter) && !name.includes(filter)) continue
      try {
        await fn({ page, browser })
        passed++
        console.log(`  ok   ${file} > ${name}`)
      } catch (e) {
        failed++
        console.log(`  FAIL ${file} > ${name}\n       ${String(e?.stack ?? e).split('\n').join('\n       ')}`)
      }
    }
  }
} catch (e) {
  failed++
  console.error(`E2E harness error: ${e.message}`)
  console.error('--- last lines of tauri dev log ---')
  console.error(readFileSync(logPath, 'utf8').split('\n').slice(-40).join('\n'))
} finally {
  await browser?.close().catch(() => {})
  killTree(child)
  log.end()
}

console.log(`\n${passed} passed, ${failed} failed`)
if (!failed) rmSync(scratch, { recursive: true, force: true, maxRetries: 5 })
process.exit(failed ? 1 : 0)
