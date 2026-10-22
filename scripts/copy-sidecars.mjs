// Copies the binaries setup.mjs fetched into binaries/<platform>/ over to
// src-tauri/binaries/<name>-<target-triple>[.exe] -- the naming Tauri's
// bundle.externalBin requires. Runs before every `tauri dev`/`tauri build`.
import { execSync } from 'node:child_process'
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// `tauri build --target <triple>` exports TAURI_ENV_TARGET_TRIPLE to this hook
// (CI builds mac x64 on an arm64 runner); otherwise use the host triple.
const triple = process.env.TAURI_ENV_TARGET_TRIPLE || execSync('rustc -vV').toString().match(/host: (\S+)/)[1]
const platform = { win32: 'win_x64', linux: 'linux_x64' }[process.platform]
  ?? (triple.startsWith('aarch64') ? 'mac_arm64' : 'mac_x64')
const ext = process.platform === 'win32' ? '.exe' : ''

// qpdf/img2pdf are bundled on Windows only (setup.mjs); macOS/Linux use the
// system installs from PATH (the converter plugin falls back to PATH when no
// sidecar sits next to the exe). Must match externalBin in tauri.conf.json
// + tauri.windows.conf.json.
const win = process.platform === 'win32'
const SIDECARS = ['ffmpeg', 'yt-dlp', ...(win ? ['qpdf', 'img2pdf'] : [])]

const destDir = join(root, 'src-tauri', 'binaries')
mkdirSync(destDir, { recursive: true })
for (const name of SIDECARS) {
  const src = join(root, 'binaries', platform, name + ext)
  if (!existsSync(src)) {
    console.error(`missing ${src} -- run \`node setup.mjs\` first`)
    process.exit(1)
  }
  copyFileSync(src, join(destDir, `${name}-${triple}${ext}`))
}
// qpdf.exe's DLLs (names change between qpdf releases, so take them all):
// bundled as resources (tauri.windows.conf.json) -> land next to qpdf.exe,
// where Windows' DLL search looks first.
if (win) {
  for (const f of readdirSync(join(root, 'binaries', platform)).filter((f) => f.endsWith('.dll'))) {
    copyFileSync(join(root, 'binaries', platform, f), join(destDir, f))
  }
}
console.log(`sidecars ready for ${triple}`)
