// Shared helpers for tests/e2e/*.test.mjs.

// Call a Tauri command (e.g. 'plugin:sorai-converter|ping') from the window.
export const invoke = (page, cmd, args = {}) =>
  page.evaluate(([c, a]) => window.__TAURI_INTERNALS__.invoke(c, a), [cmd, args])

// Replace native dialogs with canned results (see src/lib/dialogs.js).
// Pass only the ones you need; null = user cancelled. Lost on page reload.
export const stubDialogs = (page, results) =>
  page.evaluate((r) => {
    for (const [name, value] of Object.entries(r)) window.SoraiDialogs[name] = async () => value
  }, results)
