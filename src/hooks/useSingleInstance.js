import { useEffect, useRef, useState } from 'react'
import { parseLaunchArgs } from '../lib/launchArgs.js'
import {
  bringExistingInstanceToForeground,
  checkAndAcquireLock,
  consumeQueueEntries,
  enqueuePendingLaunch,
  listQueueEntryNames,
} from '../lib/instanceLock.js'

// Debounce window: Explorer/Finder/Files fires one invocation PER
// SELECTED FILE for a multi-selection right-click (see instanceLock.js's
// top comment -- there's no static-registry mechanism that bundles a
// multi-selection into one invocation), so a 5-file "Convert to OGG"
// click produces 5 near-simultaneous enqueues. The primary waits for the
// queue listing to go quiet for this long before treating whatever
// landed as one complete batch, rather than firing pendingLaunch once
// per file.
const POLL_INTERVAL_MS = 300
const DEBOUNCE_MS = 500

// Orchestrates instanceLock.js + launchArgs.js on mount. A cold launch
// with --sorai-* args (Explorer/Finder/Files right-click) and launches
// forwarded from secondary instances while this one is already running
// both funnel into the same pendingLaunch shape/consumer -- App.jsx and
// ConverterApp only ever need to react to one thing, not two.
//
// isPrimary is false for the ~always-brief life of a secondary-instance
// process: it enqueues its parsed args, asks the primary's window to
// come forward, and calls app.exit() before ever rendering anything real
// (see App.jsx, which returns null while !isPrimary).
export function useSingleInstance() {
  const [ready, setReady] = useState(false)
  const [isPrimary, setIsPrimary] = useState(false)
  const [pendingLaunch, setPendingLaunch] = useState(null)
  const seqRef = useRef(0)
  const lastNamesKeyRef = useRef('')
  const lastChangeAtRef = useRef(0)

  useEffect(() => {
    if (!window.Neutralino) {
      // Plain Vite dev/preview session, no Neutralino runtime at all --
      // render normally as if we're the only (primary) instance, same
      // reasoning main.jsx's own `if (window.Neutralino)` guard uses.
      setIsPrimary(true)
      setReady(true)
      return undefined
    }

    let cancelled = false
    let pollInterval = null

    ;(async () => {
      const initialArgs = parseLaunchArgs(window.NL_ARGS)
      const { isPrimary: primary, existingPid } = await checkAndAcquireLock()
      if (cancelled) return

      if (!primary) {
        if (initialArgs) await enqueuePendingLaunch(initialArgs)
        await bringExistingInstanceToForeground(existingPid)
        window.Neutralino.app.exit()
        return
      }

      setIsPrimary(true)
      // neutralino.config.json's modes.window.hidden is true specifically
      // so a secondary instance never flashes a window before exiting --
      // that means the primary is the one that has to explicitly show
      // itself, exactly once, right here (nothing else ever will).
      window.Neutralino.window.show().catch(() => {})
      if (initialArgs) {
        seqRef.current += 1
        setPendingLaunch({ seq: seqRef.current, ...initialArgs })
      }
      setReady(true)

      pollInterval = setInterval(async () => {
        const names = await listQueueEntryNames()
        const namesKey = names.join('|')

        if (namesKey !== lastNamesKeyRef.current) {
          // Listing changed since last tick (new entries landed, or --
          // shouldn't normally happen mid-debounce -- some disappeared).
          // Reset the quiet timer, don't consume yet.
          lastNamesKeyRef.current = namesKey
          lastChangeAtRef.current = Date.now()
          return
        }

        if (names.length === 0) return
        if (Date.now() - lastChangeAtRef.current < DEBOUNCE_MS) return

        // Listing has been stable and non-empty for the whole debounce
        // window -- every invocation from one context-menu click has
        // landed. Consume as a single batch.
        const batch = await consumeQueueEntries(names)
        lastNamesKeyRef.current = ''
        lastChangeAtRef.current = 0
        if (!batch) return
        seqRef.current += 1
        setPendingLaunch({ seq: seqRef.current, ...batch })
      }, POLL_INTERVAL_MS)
    })()

    return () => {
      cancelled = true
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [])

  return { ready, isPrimary, pendingLaunch }
}
