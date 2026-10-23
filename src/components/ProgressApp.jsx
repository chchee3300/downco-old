import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { cancelJob, probeSource, startConvert } from 'sorai-toolkit-converter'
import { useTheme } from '../hooks/useTheme.js'
import { useTranslation } from '../hooks/useTranslation.js'
import { tNow } from '../i18n/dict.js'

const AUTO_CLOSE_MS = 3000
const WORKERS = 2
const baseName = (path) => path.split(/[\\/]/).pop()
const ACTIVE = ['queued', 'running']

// The `progress` window (src/main.jsx renders this for that label). Drains
// files queued by the main window (Rust take_progress_jobs, which already
// resolved each file's preset and whether it applies), converts 2 at a time
// through the Converter plugin into each source's own folder. Each run (busy
// until idle again) that ends with outputs and no error/cancel toasts. The
// window closes itself 3 s after a run unless any error/cancel row is showing:
// errors stay visible until the user closes the window, even across later
// all-success runs. Rust (lib.rs) then ends the app if nothing else is
// showing. Closing it (X) mid-run cancels everything first (no headless jobs,
// no partial outputs), then closes.
// Rows: { key, path, status: queued|running|success|error|cancelled|skipped, percent, message }.
export default function ProgressApp() {
  useTheme()
  const { t } = useTranslation()
  const [rows, setRows] = useState([])
  const [toasts, setToasts] = useState(0) // .progress-app[data-toasts], for E2E
  // Refs, not effect locals: StrictMode's double mount shares one pool.
  const queue = useRef([]) // { key, path, preset }
  const active = useRef(0)
  const jobIds = useRef(new Map()) // key -> plugin jobId, while running
  const cancelled = useRef(new Set()) // keys cancelled before their job id existed
  const failed = useRef(false) // an error/cancel row is showing (never cleared: rows stay)
  const runFailed = useRef(false) // ...in the current run (no toast)
  const closing = useRef(false)
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const lastOut = useRef(null)
  const closeTimer = useRef(null)
  const nextKey = useRef(0)
  const update = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const cancel = (key) => {
    const i = queue.current.findIndex((j) => j.key === key)
    if (i >= 0) {
      queue.current.splice(i, 1)
      failed.current = runFailed.current = true
      update(key, { status: 'cancelled' })
      settle()
    } else if (jobIds.current.has(key)) {
      cancelJob(jobIds.current.get(key)).catch(console.error) // its `done` resolves 'cancelled'
    } else {
      cancelled.current.add(key) // still probing / starting
    }
  }
  // Refs, not `rows`: also called from the close handler, and rows just
  // drained may not be rendered yet.
  const cancelAll = () => {
    const keys = new Set([...queue.current.map((j) => j.key), ...rowsRef.current.filter((r) => ACTIVE.includes(r.status)).map((r) => r.key)])
    keys.forEach(cancel)
  }

  // A run finished: toast if it produced outputs without failures; close
  // unless a failure is showing (or right away when the user is closing).
  function settle() {
    if (active.current || queue.current.length) return
    if (closing.current) return getCurrentWindow().destroy()
    if (lastOut.current && !runFailed.current) {
      invoke('notify_done', { title: tNow('progress.notifyTitle'), body: tNow('progress.notifyBody'), reveal: lastOut.current }).catch(console.error)
      setToasts((n) => n + 1)
    }
    lastOut.current = null
    runFailed.current = false
    clearTimeout(closeTimer.current)
    if (!failed.current) closeTimer.current = setTimeout(() => getCurrentWindow().destroy(), AUTO_CLOSE_MS)
  }

  // One file: probe (duration/fps drive progress and target-size bitrates),
  // then start_convert with outDir '' (resolve_out_dir = the source's folder).
  async function convertOne({ key, path, preset }) {
    const { size, duration, fps, width, height } = await probeSource(path, preset.fileType)
    if (cancelled.current.has(key)) return { status: 'cancelled' }
    const job = {
      source: { path, size, duration, fps, width, height },
      fileType: preset.fileType,
      settings: { ...preset.settings, format: preset.format },
    }
    const { jobId, outPath, done } = await startConvert(job, '', { onProgress: (percent) => update(key, { percent }) })
    jobIds.current.set(key, jobId)
    if (cancelled.current.has(key)) cancelJob(jobId).catch(console.error)
    const result = await done
    jobIds.current.delete(key)
    if (result.status === 'success') lastOut.current = outPath
    return result
  }

  function pump() {
    while (active.current < WORKERS && queue.current.length) {
      const job = queue.current.shift()
      active.current++
      update(job.key, { status: 'running' })
      convertOne(job)
        .catch((e) => ({ status: 'error', message: String(e) }))
        .then((result) => {
          if (result.status !== 'success') failed.current = runFailed.current = true
          update(job.key, { status: result.status, message: result.message ?? null, ...(result.status === 'success' && { percent: 100 }) })
          active.current--
          pump()
          settle()
        })
    }
  }

  useEffect(() => {
    const drain = async () => {
      const jobs = await invoke('take_progress_jobs')
      if (!jobs.length) return
      clearTimeout(closeTimer.current) // new files arrived during the 3 s
      const added = jobs.map(({ path, preset, applies }) => {
        const key = nextKey.current++
        if (!preset) failed.current = runFailed.current = true
        else if (applies) queue.current.push({ key, path, preset })
        const status = !preset ? 'error' : applies ? 'queued' : 'skipped'
        return { key, path, status, percent: 0, message: preset ? null : tNow('progress.unknownPreset') }
      })
      setRows((rs) => [...rs, ...added])
      pump()
      settle() // a batch of only skipped files
    }

    // X while busy: cancel everything, settle() destroys once it's all done
    // (the runner removes partial outputs; its backstop bounds the wait).
    const unclose = getCurrentWindow().onCloseRequested((e) => {
      if (!active.current && !queue.current.length) return
      e.preventDefault()
      closing.current = true
      cancelAll()
    })
    const unlisten = listen('sorai://progress-jobs', () => drain().catch(console.error))
    drain().catch(console.error)
    return () => {
      unlisten.then((f) => f())
      unclose.then((f) => f())
    }
  }, [])

  const anyActive = rows.some((r) => ACTIVE.includes(r.status))
  return (
    <div className="progress-app" data-toasts={toasts}>
      <div className="progress-rows">
        {rows.map((r) => (
          <div key={r.key} className="progress-row" data-status={r.status} title={r.path}>
            <div className="progress-row-head">
              <span className="progress-row-name">{baseName(r.path)}</span>
              <span className="progress-row-status">{t(`progress.status.${r.status}`)}</span>
              {ACTIVE.includes(r.status) && (
                <button type="button" className="btn btn-ghost btn-xs progress-row-cancel" onClick={() => cancel(r.key)}>
                  {t('progress.cancel')}
                </button>
              )}
            </div>
            <progress max="100" value={r.percent ?? 0} />
            {r.message && <p className="progress-row-message">{r.message}</p>}
          </div>
        ))}
      </div>
      {anyActive && (
        <button type="button" className="btn btn-outline btn-xs progress-cancel-all" onClick={cancelAll}>
          {t('progress.cancelAll')}
        </button>
      )}
    </div>
  )
}
