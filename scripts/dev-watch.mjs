// One-command local dev loop: rebuilds whichever repo you just edited (this
// hub, or a sibling sorai-toolkit-converter/sorai-toolkit-downloader
// checkout), refreshes web-dist, then launches `neu run` -- whose own
// --neu-dev-extension/--neu-dev-auto-reload flags (the neu CLI's default dev
// behavior, not something this script adds) live-reload the window the
// moment web-dist changes.
//
// Why this exists instead of just `vite build --watch`: Converter/Downloader
// are npm git dependencies, built into node_modules/<pkg>/dist/index.js by
// their own `prepare` script at install time. Editing their *source* (in the
// sibling checkout) never touches that copy -- and empirically, vite's own
// build watcher does not react to node_modules changes either (verified:
// touching node_modules/sorai-toolkit-converter/dist/index.js while `vite
// build --watch` was running produced no rebuild, because rollup's watcher
// excludes node_modules/** by default). So this script does the two steps
// vite won't: rebuild the sub-package's lib bundle and copy its dist/ into
// this hub's node_modules, before rebuilding the hub itself.
//
// Sibling-directory assumption: sorai-toolkit-converter and
// sorai-toolkit-downloader are expected next to this repo (…/toolkit/
// sorai-toolkit, …/toolkit/sorai-toolkit-converter, …/toolkit/
// sorai-toolkit-downloader -- this dev machine's actual layout). Override
// with CONVERTER_REPO/DOWNLOADER_REPO env vars if yours differs. A missing
// sibling is skipped (not an error) so this still works with only one of
// the two tool repos checked out.
//
// fs.watch({ recursive: true }) is Windows/macOS-only (this dev machine is
// Windows) -- unsupported on Linux, where this script would need a
// polling-based watcher instead; not implemented here since nobody's
// developing this hub on Linux yet.
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HUB_ROOT = path.resolve(__dirname, '..')

const CONVERTER_DIR = process.env.CONVERTER_REPO || path.resolve(HUB_ROOT, '..', 'sorai-toolkit-converter')
const DOWNLOADER_DIR = process.env.DOWNLOADER_REPO || path.resolve(HUB_ROOT, '..', 'sorai-toolkit-downloader')

const PACKAGES = [
  { name: 'sorai-toolkit-converter', dir: CONVERTER_DIR },
  { name: 'sorai-toolkit-downloader', dir: DOWNLOADER_DIR },
].filter((p) => {
  const exists = fs.existsSync(path.join(p.dir, 'src'))
  if (!exists) console.warn(`[dev-watch] skipping ${p.name} -- no checkout at ${p.dir}`)
  return exists
})

function log(...args) {
  console.log('[dev-watch]', ...args)
}

function rebuildPackage(pkg) {
  log(`building ${pkg.name}...`)
  execSync('npm run build:lib', { cwd: pkg.dir, stdio: 'inherit' })
  const destDist = path.join(HUB_ROOT, 'node_modules', pkg.name, 'dist')
  fs.rmSync(destDist, { recursive: true, force: true })
  fs.cpSync(path.join(pkg.dir, 'dist'), destDist, { recursive: true })
  log(`${pkg.name} dist -> hub node_modules`)
}

function rebuildHub() {
  log('building hub...')
  execSync('npx vite build', { cwd: HUB_ROOT, stdio: 'inherit' })
}

// Serializes builds and coalesces bursts of change events (several files
// saved by one edit, or two watchers firing for the same save) into a
// single rebuild instead of racing overlapping `vite build` runs.
let building = false
let queuedPackage = undefined // pkg object | null (hub-only) | undefined (none queued)

function runBuild(changedPackage) {
  if (building) {
    // A specific package rebuild always wins over a hub-only one already
    // queued, since it's a superset of the work needed.
    if (changedPackage || queuedPackage === undefined) queuedPackage = changedPackage
    return
  }
  building = true
  try {
    if (changedPackage) rebuildPackage(changedPackage)
    rebuildHub()
  } catch (e) {
    console.error('[dev-watch] build failed:', e.message)
  } finally {
    building = false
  }
  if (queuedPackage !== undefined) {
    const next = queuedPackage
    queuedPackage = undefined
    runBuild(next)
  }
}

const debounceTimers = new Map()
function scheduleRebuild(key, changedPackage, delay = 300) {
  clearTimeout(debounceTimers.get(key))
  debounceTimers.set(
    key,
    setTimeout(() => runBuild(changedPackage), delay),
  )
}

// Initial full build so `neu run` has something current the instant it
// starts, regardless of what state node_modules/web-dist were left in.
for (const pkg of PACKAGES) rebuildPackage(pkg)
rebuildHub()

fs.watch(path.join(HUB_ROOT, 'src'), { recursive: true }, () => scheduleRebuild('hub', null))
fs.watch(path.join(HUB_ROOT, 'resources'), { recursive: true }, () => scheduleRebuild('hub', null))
for (const pkg of PACKAGES) {
  fs.watch(path.join(pkg.dir, 'src'), { recursive: true }, () => scheduleRebuild(pkg.name, pkg))
}

log('watching for changes in: hub, ' + PACKAGES.map((p) => p.name).join(', '))
log('starting neu run...')

const neu = process.platform === 'win32'
  ? spawn('cmd.exe', ['/c', 'neu run'], { cwd: HUB_ROOT, stdio: 'inherit' })
  : spawn('neu', ['run'], { cwd: HUB_ROOT, stdio: 'inherit' })

neu.on('exit', (code) => process.exit(code ?? 0))
process.on('SIGINT', () => {
  neu.kill()
  process.exit(0)
})
