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
      },
    },
  },
})
