import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// liquid-glass.js explicitly assigns window.LiquidSelect/window.initLiquidGlass
// (liquid-glass.js:495-496), so it's safe to bundle as a normal side-effect
// ES import. neutralino.js is NOT imported here — it's loaded via a real
// <script src> in index.html instead, see the comment there for why.
import '../resources/js/liquid-glass.js'

// Strangler-fig lib modules (Phase 0.4) — each attaches to
// window.EstellaLib.* explicitly, same reasoning as liquid-glass.js.
// platform.js must load first — the command-builder modules below call
// into window.EstellaLib.platform. i18n.js has no such ordering
// requirement (nothing else here calls into it) but is imported here too
// so window.EstellaLib.i18n exists before first render, same as every
// other EstellaLib.* consumer's expectation.
import '../resources/js/lib/i18n.js'
import '../resources/js/lib/platform.js'
import '../resources/js/lib/filename-collision.js'
import '../resources/js/lib/ffmpeg-commands.js'
import '../resources/js/lib/qpdf-commands.js'
import '../resources/js/lib/img2pdf-commands.js'
import '../resources/js/lib/progress-parser.js'
import '../resources/js/lib/size-estimate.js'
import '../resources/js/lib/range-fill.js'

// Neutralino.init() only functions when this app is actually served by a
// running `neu` process (window.NL_PORT/NL_TOKEN injected by neu's dev
// server into its response for the <script src> above); in a plain Vite
// dev/preview session (no neu process) window.Neutralino still won't exist
// at all, which is expected — see design-system/MASTER.md Phase 2.6 for
// when this becomes fully testable end-to-end.
if (window.Neutralino) {
  window.Neutralino.init()
  // neutralino.config.json's window mode sets exitProcessOnClose: false,
  // which makes Neutralino intercept the window's close button and emit
  // 'windowClose' instead of actually closing anything -- the listener
  // that decides what to do about it (ask / minimize to tray / quit) is
  // src/hooks/useCloseBehavior.js, registered once App.jsx mounts. Nothing
  // registered here means clicking the close button before that mount
  // completes is a silent no-op for the ~tens of ms in between -- an
  // accepted, negligible gap, not a regression from the old unconditional
  // app.exit() this replaced.
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
