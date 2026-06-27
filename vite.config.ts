import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve as resolvePath } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: 'app',
  plugins: [react()],
  resolve: {
    alias: { '@': resolvePath(__dirname, 'app') },
  },
  server: {
    port: 7725,
    proxy: {
      '/api/': {
        target: 'http://localhost:7726',
        changeOrigin: true,
        configure: proxy => {
          // Suppress ECONNREFUSED noise for the client log endpoint during startup
          // — the client logger already swallows fetch failures silently.
          proxy.on('error', (err, req, res) => {
            const url = (req as { url?: string }).url ?? ''
            // Silently drop errors for fire-and-forget or polling endpoints —
            // their callers already handle failures gracefully.
            const silent = ['/api/local-log', '/api/auth-status', '/api/app-status']
            if (silent.some(p => url.includes(p))) return
            const message = err.message || (err as NodeJS.ErrnoException).code || String(err)
            console.error(`[proxy] ${url} — ${message}`)
            if (!('headersSent' in res && res.headersSent)) {
              (res as import('http').ServerResponse).writeHead(502)
              res.end('Proxy error')
            }
          })
        },
      },
    },
  },
})
