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
    // Development dev server port.
    port: 3000,
    proxy: {
      '/api/': {
        // Express backend proxy port (server listens on 3001)
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
