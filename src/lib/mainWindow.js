import { getCurrentWindow } from '@tauri-apps/api/window'
import { Image } from '@tauri-apps/api/image'

// The window is created hidden (tauri.conf.json "visible": false) so a
// secondary instance never flashes one. The primary reveals it here; the
// tray "Open" item reuses the same call. None of the Neutralino-era
// off-screen/iconic workarounds are needed under Tauri.
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
