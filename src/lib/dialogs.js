// The only place native dialogs are opened. Everything (hub and the tool
// packages) calls them through window.SoraiDialogs, looked up at call time,
// so an E2E test can swap a method in the live window -- see
// tests/e2e/helpers.mjs stubDialogs().
import { open } from '@tauri-apps/plugin-dialog'

const dialogs = {
  // -> string[] of absolute paths, or null if cancelled
  openFiles: (options = {}) => open({ ...options, multiple: true, directory: false }),
  // -> absolute folder path, or null if cancelled
  openFolder: (options = {}) => open({ ...options, multiple: false, directory: true }),
}

window.SoraiDialogs = dialogs
export default dialogs
