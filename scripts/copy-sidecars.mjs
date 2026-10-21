// Copies the binaries setup.mjs fetched into binaries/<platform>/ over to
// src-tauri/binaries/<name>-<target-triple>[.exe] -- the naming Tauri's
// bundle.externalBin requires. Runs before every `tauri dev`/`tauri build`.
import { execSync } from 'node:child_process'
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const triple = execSync('rustc -vV').toString().match(/host: (\S+)/)[1]
const platform = { win32: 'win_x64', linux: 'linux_x64' }[process.platform]
  ?? (process.arch === 'arm64' ? 'mac_arm64' : 'mac_x64')
const ext = process.platform === 'win32' ? '.exe' : ''

// ponytail: ffmpeg + yt-dlp only; qpdf/img2pdf (and qpdf's DLLs) join in Phase 2.
const SIDECARS = ['ffmpeg', 'yt-dlp']

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
console.log(`sidecars ready for ${triple}`)
