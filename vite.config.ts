import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const monacoEsm = fileURLToPath(new URL('./node_modules/monaco-editor/esm/vs/', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // monaco-editor's "exports" map rewrites every deep path through
      // `./esm/vs/*` and appends `.js` — which double-prefixes the ESM paths its
      // own docs use and breaks its stylesheet imports outright. Resolving the
      // ESM tree directly is the documented Vite integration path.
      { find: /^monaco-editor\/esm\/vs\//, replacement: monacoEsm },
    ],
  },
  optimizeDeps: {
    // `?worker` imports must not be pre-bundled — esbuild rewrites them into
    // modules with no default export, and Monaco's editor/JSON workers fail to
    // construct at runtime.
    exclude: ['monaco-editor'],
  },
  build: {
    // Monaco is large and inherently one chunk; the warning adds no signal.
    chunkSizeWarningLimit: 4000,
  },
})
