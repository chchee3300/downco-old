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
      //
      // Four separate native calls, not one -- each one fixes a distinct,
      // independently-observed way the window can come up unusable
      // (looks "open" but can't be hovered/clicked/dropped onto), and
      // each is run in its own try/catch (not one .then() chain with a
      // single trailing .catch()) so one call throwing can't skip the
      // rest:
      //  - show(): the window was created with modes.window.hidden, so
      //    it's actually invisible (native isVisible() is false) until
      //    this runs -- nothing else ever calls it.
      //  - unminimize(): verified live that a fresh launch can come up
      //    genuinely iconic (Win32 IsIconic() true, GetWindowRect at the
      //    minimized-icon sentinel around (-32000,-32000)) even though
      //    show() alone reports success -- show()'s own internal
      //    "already visible, nothing to do" fast path in this Neutralino
      //    version doesn't restore from iconic. unminimize() is
      //    Neutralino's own native SW_RESTORE and fixes this directly;
      //    no need to shell out to PowerShell for our own window (that's
      //    still necessary in bringExistingInstanceToForeground, which
      //    has to reach a *different* process's window).
      //  - center(): isn't redundant with config's "center": true --
      //    that flag only applies to a window's placement at creation,
      //    and this window is *created* hidden, so it never gets a valid
      //    "normal" placement to begin with. Verified live: right after
      //    show(), GetWindowRect on the real window reported
      //    (32767,-32768,33827,-32068) -- a different, positive-side
      //    off-screen sentinel than the iconic one above -- despite
      //    IsIconic/IsWindowVisible both reporting the window as a
      //    normal, visible, non-minimized window. center() moved it to a
      //    real on-screen rect immediately.
      //  - focus(): show()/unminimize() alone leave the window visible
      //    but never given input focus -- same show()+focus() pairing
      //    useCloseBehavior.js's tray-restore path uses, for the same
      //    reason.
      ;(async () => {
        try {
          await window.Neutralino.window.show()
        } catch (e) {
          /* best-effort, see comment above */
        }
        try {
          await window.Neutralino.window.unminimize()
        } catch (e) {
          /* best-effort, see comment above */
        }
        try {
          await window.Neutralino.window.center()
        } catch (e) {
          /* best-effort, see comment above */
        }
        try {
          await window.Neutralino.window.focus()
        } catch (e) {
          /* best-effort, see comment above */
        }
      })()
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
