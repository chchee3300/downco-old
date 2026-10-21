import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Tauri dev server expects a fixed port (tauri.conf.json devUrl).
  server: { port: 5173, strictPort: true },
  clearScreen: false,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'web-dist',
    emptyOutDir: true,
  },
})
