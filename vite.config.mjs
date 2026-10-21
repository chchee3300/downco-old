import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { join } from 'node:path'
import { siblings } from './scripts/siblings.mjs'

// Cross-repo dev mode: sibling tool checkouts are served from source (HMR)
// instead of node_modules/<pkg>/dist -- see scripts/siblings.mjs.
const local = siblings()

export default defineConfig({
  // Port must match tauri's devUrl; scripts/tauri-dev.mjs keeps both in sync
  // via VITE_PORT so several worktrees can run side by side.
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    strictPort: true,
    // Cargo output (src-tauri/target, plugin/target behind .plugins links)
    // churns and locks files mid-build; watching it crashes Vite (EBUSY).
    watch: { ignored: ['**/src-tauri/**', '**/.plugins/**'] },
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), ...local.map((s) => s.dir)] },
  },
  clearScreen: false,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: local.map((s) => ({ find: new RegExp(`^${s.pkg}$`), replacement: join(s.dir, 'src', 'index.js') })),
    // Sibling sources must share the hub's copies, not resolve their own.
    dedupe: ['react', 'react-dom', '@tauri-apps/api'],
  },
  build: {
    outDir: 'web-dist',
    emptyOutDir: true,
  },
})
