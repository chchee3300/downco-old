import { useEffect, useRef, useState } from 'react'
import { parseLaunchArgs } from '../lib/launchArgs.js'
import {
  bringExistingInstanceToForeground,
  checkAndAcquireLock,
  consumeQueueEntries,
  enqueuePendingLaunch,
  forceOwnWindowForeground,
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
      // itself, exactly once, right here (nothing else ever will). show()
      // alone leaves the window visible but never brought to the
      // foreground/given input focus -- same show()+focus() pairing as
      // useCloseBehavior.js's tray-restore path uses, for the same reason.
      //
      // center() is required too, and isn't redundant with config's
      // "center": true -- that flag only applies to a window's placement
      // at creation, and this window is *created* hidden (that's the
      // whole point of modes.window.hidden), so it never gets a valid
      // "normal" placement to begin with. Verified live: right after
      // show(), GetWindowRect on the real window reported
      // (32767,-32768,33827,-32068) -- Win32's icon-parking sentinel
      // position, not a valid on-screen rect -- despite IsIconic/
      // IsWindowVisible both reporting the window as a normal, visible,
      // non-minimized window. That's a window that "opened" but sits
      // off-screen: nothing the user does (including hovering) reaches
      // it. Calling center() moved it to a real rect immediately.
      //
      // forceOwnWindowForeground is a Windows-only extra safety net on
      // top of that -- see its own comment in instanceLock.js for the
      // real, observed bug (window left genuinely iconic/un-restorable)
      // this works around specifically under neu run's nested spawn
      // chain; a no-op everywhere else. It doesn't fix the off-screen
      // case above -- SW_RESTORE is a no-op on a window that was never
      // minimized in the first place, only ever mis-placed.
      window.Neutralino.window
        .show()
        .then(() => window.Neutralino.window.center())
        .then(() => window.Neutralino.window.focus())
        .then(() => forceOwnWindowForeground())
        .catch(() => {})
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
