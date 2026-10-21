// One-command Tauri dev mode: `npm run tauri:dev`.
//   VITE_PORT (default 5173)  Vite dev server port; tauri's devUrl follows it
//   CDP_PORT  (default 9229)  WebView2 remote debugging port (Playwright connectOverCDP)
//   CONVERTER_REPO / DOWNLOADER_REPO  sibling checkouts (scripts/siblings.mjs)
// Rust edits (hub or sibling plugin/) rebuild + restart the app; JS edits
// (hub src/ or sibling src/) hot-reload through Vite.
import { spawn, spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { linkPlugins, root, siblings } from './siblings.mjs'

export const ports = () => ({
  vitePort: Number(process.env.VITE_PORT) || 5173,
  cdpPort: Number(process.env.CDP_PORT) || 9229,
})

export function tauriDev({ vitePort, cdpPort, userDataDir, stdio = 'inherit' }) {
  for (const line of linkPlugins()) console.log(`plugin ${line}`)
  const devUrl = `http://localhost:${vitePort}`
  // tauri dev only watches src-tauri; sibling crates must be added explicitly.
  const watch = siblings().flatMap((s) => ['--additional-watch-folders', join(s.dir, 'plugin')])
  return spawn(
    process.execPath,
    [join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'), 'dev', '--config', JSON.stringify({ build: { devUrl } }), ...watch],
    {
      cwd: root,
      stdio,
      // POSIX: own process group so killTree can signal the whole tree.
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        VITE_PORT: String(vitePort),
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${cdpPort}`,
        // WebView2 shares one browser process per user-data folder and ignores
        // the debug-port flag when joining an existing one -- so each port
        // gets its own folder, or two worktrees' windows would collide.
        WEBVIEW2_USER_DATA_FOLDER: userDataDir ?? join(root, 'src-tauri', 'target', `webview2-${cdpPort}`),
      },
    },
  )
}

// tauri CLI -> (vite, cargo -> app -> msedgewebview2): kill all of it.
export function killTree(child) {
  if (child.exitCode !== null) return
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else try { process.kill(-child.pid, 'SIGTERM') } catch {}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const child = tauriDev(ports())
  child.on('exit', (code) => process.exit(code ?? 0))
  process.on('SIGINT', () => killTree(child))
}
