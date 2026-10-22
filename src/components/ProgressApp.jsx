import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { probeSource, startConvert } from 'sorai-toolkit-converter'
import { useTheme } from '../hooks/useTheme.js'
import { useTranslation } from '../hooks/useTranslation.js'

const AUTO_CLOSE_MS = 3000

// ponytail: copy of the Converter's useFileManager.js input lists; ticket 03
// replaces this with the Rust "preset x file -> apply or skip" function.
const INPUT_TYPES = {
  video: ['mp4', 'mkv', 'avi', 'mov', 'webm'],
  image: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'ico'],
  audio: ['mp3', 'wav', 'aac', 'flac', 'ogg'],
  pdf: ['pdf'],
}
const fileTypeOf = (path) => {
  const ext = path.split('.').pop().toLowerCase()
  return Object.keys(INPUT_TYPES).find((t) => INPUT_TYPES[t].includes(ext)) ?? null
}
const baseName = (path) => path.split(/[\\/]/).pop()

// One preset file through the Converter plugin: probe (duration/fps drive
// progress and target-size bitrates), then start_convert into the source's
// own folder (outDir '' -> resolve_out_dir picks it; never overwrites).
async function convertOne(preset, path, onProgress) {
  if (!preset) return { status: 'error', message: 'unknown preset' }
  if (fileTypeOf(path) !== preset.fileType) return { status: 'skipped' }
  const { size, duration, fps, width, height } = await probeSource(path, preset.fileType)
  const job = {
    source: { path, size, duration, fps, width, height },
    fileType: preset.fileType,
    settings: { ...preset.settings, format: preset.format },
  }
  const { done } = await startConvert(job, '', { onProgress })
  return done
}

// The `progress` window (src/main.jsx renders this for that label). Drains
// batches queued by the main window (Rust ProgressQueue), converts them one
// file at a time, and closes itself 3 s after everything succeeded; Rust
// (lib.rs on_window_event) then ends the app if nothing else is showing.
// Rows: { key, path, status: queued|running|success|error|cancelled|skipped, percent, message }.
export default function ProgressApp() {
  useTheme()
  const { t } = useTranslation()
  const [rows, setRows] = useState([])
  // Refs, not effect locals: StrictMode's double mount shares one loop.
  const queue = useRef([])
  const running = useRef(false)
  const failed = useRef(false)
  const closeTimer = useRef(null)
  const nextKey = useRef(0)

  useEffect(() => {
    const update = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

    const run = async () => {
      if (running.current) return
      running.current = true
      while (queue.current.length) {
        const { key, path, preset } = queue.current.shift()
        update(key, { status: 'running' })
        let result
        try {
          result = await convertOne(preset, path, (percent) => update(key, { percent }))
        } catch (e) {
          result = { status: 'error', message: String(e) }
        }
        if (result.status === 'error' || result.status === 'cancelled') failed.current = true
        update(key, { status: result.status, message: result.message ?? null, percent: result.status === 'success' ? 100 : undefined })
      }
      running.current = false
      if (!failed.current) closeTimer.current = setTimeout(() => getCurrentWindow().destroy(), AUTO_CLOSE_MS)
    }

    const drain = async () => {
      const batches = await invoke('take_progress_jobs')
      if (!batches.length) return
      clearTimeout(closeTimer.current) // new files arrived during the 3 s
      const presets = await invoke('list_presets')
      const added = []
      for (const { presetId, files } of batches) {
        const preset = presets.find((p) => p.id === presetId)
        for (const path of files) {
          const key = nextKey.current++
          queue.current.push({ key, path, preset })
          added.push({ key, path, status: 'queued', percent: 0, message: null })
        }
      }
      setRows((rs) => [...rs, ...added])
      run()
    }

    const unlisten = listen('sorai://progress-jobs', () => drain().catch(console.error))
    drain().catch(console.error)
    return () => unlisten.then((f) => f())
  }, [])

  return (
    <div className="progress-app">
      {rows.map((r) => (
        <div key={r.key} className="progress-row" data-status={r.status} title={r.path}>
          <div className="progress-row-head">
            <span className="progress-row-name">{baseName(r.path)}</span>
            <span className="progress-row-status">{t(`progress.status.${r.status}`)}</span>
          </div>
          <progress max="100" value={r.percent ?? 0} />
          {r.message && <p className="progress-row-message">{r.message}</p>}
        </div>
      ))}
    </div>
  )
}
