// Phase 0 probe (temporary): shows what Tauri's native drag-drop hands us
// and whether both sidecars run. Replaced by the real Converter drop path in
// Phase 2 -- delete this file then.
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { invoke } from '@tauri-apps/api/core'

const box = document.createElement('pre')
box.id = 'tauri-probe'
box.style.cssText =
  'position:fixed;left:8px;bottom:8px;z-index:99999;max-width:60vw;max-height:40vh;overflow:auto;' +
  'margin:0;padding:8px 10px;font:12px/1.4 monospace;background:rgba(0,0,0,.8);color:#7CFC9A;' +
  'border-radius:6px;white-space:pre-wrap;pointer-events:none'
document.body.appendChild(box)
const log = (line) => {
  box.textContent += line + '\n'
  console.log('[probe]', line)
}

invoke('sidecar_versions').then(
  (lines) => lines.forEach(log),
  (e) => log('sidecar error: ' + e),
)

getCurrentWebview().onDragDropEvent((event) => {
  const { type, paths } = event.payload
  if (type === 'drop') log('drop: ' + JSON.stringify(paths))
  else if (type === 'enter') log('enter: ' + (paths?.length ?? 0) + ' file(s)')
})
