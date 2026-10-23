import { getCurrentWindow } from '@tauri-apps/api/window'
import { Image } from '@tauri-apps/api/image'
import { invoke } from '@tauri-apps/api/core'

// Cold start was a right-click preset (Rust launch_is_background): the main
// window stays hidden, and its start-up work (reveal, update check, menu
// rewrite) is skipped. Asked once per page.
let background
export const isBackgroundLaunch = () => (background ??= invoke('launch_is_background'))

// The window is created hidden (tauri.conf.json "visible": false) so a
// secondary instance never flashes one. The primary reveals it here; the
// tray "Open" item reuses the same call.
export async function revealMainWindow({ center = false } = {}) {
  const w = getCurrentWindow()
  if (center) await w.center()
  await w.show()
  await w.unminimize()
  await w.setFocus()
}

// Bundled PNG (Vite asset URL) -> Tauri Image, decoded once per URL.
const images = new Map()
export function imageFromUrl(url) {
  if (!images.has(url)) {
    images.set(url, fetch(url).then((r) => r.arrayBuffer()).then((b) => Image.fromBytes(new Uint8Array(b))))
  }
  return images.get(url)
}
