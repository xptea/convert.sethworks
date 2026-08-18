import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { openSync, readSync, closeSync } from 'fs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

function isGzipped(path: string) {
  try {
    const fd = openSync(path, 'r')
    const buf = Buffer.alloc(2)
    readSync(fd, buf, 0, 2, 0)
    closeSync(fd)
    return buf[0] === 0x1f && buf[1] === 0x8b
  } catch {
    return false
  }
}

const wasmGzipPreview = {
  name: 'wasm-gzip-preview',
  configurePreviewServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url === '/ffmpeg/ffmpeg-core.wasm' || req.url === '/ffmpeg/single/ffmpeg-core.wasm') {
        const wasmPath = resolve(__dirname, `dist${req.url}`)
        if (isGzipped(wasmPath)) {
          res.setHeader('Content-Encoding', 'gzip')
        }
      }
      next()
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), wasmGzipPreview],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    headers: isolationHeaders,
  },
  preview: {
    headers: isolationHeaders,
  },
})
