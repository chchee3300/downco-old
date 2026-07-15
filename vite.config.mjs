import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// neutralino.js must be requested via a real <script src>, not bundled —
// neu's dev server injects window.NL_PORT/NL_TOKEN/etc. into its response
// for whatever file neutralino.config.json's cli.clientLibrary points at,
// matched by resolving documentRoot + the request path, which only fires on
// a genuine HTTP request. This plugin copies the real source (single
// source of truth, resources/js/neutralino.js) to web-dist/js/neutralino.js
// on every build, so index.html's <script src="/js/neutralino.js"> and
// neutralino.config.json's clientLibrary (/web-dist/js/neutralino.js) both
// resolve to a real file.
function copyNeutralinoClient() {
  return {
    name: 'copy-neutralino-client',
    closeBundle() {
      const src = resolve(__dirname, 'resources/js/neutralino.js')
      const dest = resolve(__dirname, 'web-dist/js/neutralino.js')
      mkdirSync(dirname(dest), { recursive: true })
      copyFileSync(src, dest)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyNeutralinoClient()],
  build: {
    outDir: 'web-dist',
    emptyOutDir: true,
  },
})
