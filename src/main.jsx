import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import App from './App.jsx'
import ProgressApp from './components/ProgressApp.jsx'
import './index.css'

// UI-only runtime globals, imported for their side effects:
// window.LiquidSelect/initLiquidGlass and window.EstellaLib.{i18n,rangeFill}.
// Both tool packages read them at call time, so they must load before render.
import '../resources/js/liquid-glass.js'
import '../resources/js/lib/i18n.js'
import '../resources/js/lib/range-fill.js'
// Installs window.SoraiDialogs (native file/folder pickers, E2E-replaceable).
import './lib/dialogs.js'
// Installs window.SoraiPresets (right-click presets; Converter saves through it).
import './lib/presets.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* The `progress` window (src-tauri/src/lib.rs queue_background) loads
        this same frontend but only renders the background-convert view. */}
    {getCurrentWindow().label === 'progress' ? <ProgressApp /> : <App />}
  </StrictMode>,
)
