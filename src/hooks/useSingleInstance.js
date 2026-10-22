import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { parseLaunchArgs } from '../lib/launchArgs.js'
import { revealMainWindow } from '../lib/mainWindow.js'

// Explorer/Finder/Files fires one invocation PER SELECTED FILE for a
// multi-selection right-click, so a 5-file "Convert to OGG" is 5 launches.
// tauri-plugin-single-instance forwards each second instance's argv to
// this (primary) process (src-tauri/src/lib.rs queues them); we merge
// everything that arrives until it's quiet for this long into ONE
// pendingLaunch instead of firing once per file.
const DEBOUNCE_MS = 500

// A cold launch's own --sorai-* args and forwarded ones take the same path
// (both sit in the Rust-side queue), so App.jsx/ConverterApp react to one
// thing: pendingLaunch = { seq, files, format, quickAction } | null.
// Refs, not effect locals: StrictMode's double mount must share one batch/seq.
export function useSingleInstance() {
  const [pendingLaunch, setPendingLaunch] = useState(null)
  const seq = useRef(0)
  const batch = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    // The window is created hidden; a secondary instance exits in Rust
    // before ever getting here, so whoever runs this is the primary. A
    // background-only cold start (--sorai-preset) leaves it hidden.
    invoke('launch_is_background')
      .then((bg) => bg || revealMainWindow({ center: true }))
      .catch(console.error)

    const flush = () => {
      clearTimeout(timer.current)
      const b = batch.current
      batch.current = null
      if (!b) return
      // Preset batches go to the progress window (src-tauri/src/lib.rs
      // queue_background), never into the Converter's queue.
      if (b.preset) invoke('queue_background', { presetId: b.preset, files: b.files }).catch(console.error)
      else setPendingLaunch({ seq: ++seq.current, files: b.files, format: b.format, quickAction: b.quickAction })
    }
    const drain = async () => {
      for (const argv of await invoke('take_launch_args')) {
        const args = parseLaunchArgs(argv)
        if (!args) continue
        // A different action (e.g. "to MP3" then "to OGG", or another preset) is its own batch.
        const b = batch.current
        if (b && (b.format !== args.format || b.preset !== args.preset || JSON.stringify(b.quickAction) !== JSON.stringify(args.quickAction))) flush()
        batch.current ??= { files: [], format: args.format, quickAction: args.quickAction, preset: args.preset }
        batch.current.files.push(...args.files)
        clearTimeout(timer.current)
        timer.current = setTimeout(flush, DEBOUNCE_MS)
      }
    }
    const unlisten = listen('sorai://launch', () => drain().catch(console.error))
    drain().catch(console.error)
    return () => unlisten.then((f) => f())
  }, [])

  return { pendingLaunch }
}
