import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { gzipSync } from 'zlib'

const wasmPath = resolve('dist/ffmpeg/ffmpeg-core.wasm')
if (!existsSync(wasmPath)) {
  console.warn('WASM file not found, skipping gzip:', wasmPath)
  process.exit(0)
}

const buf = readFileSync(wasmPath)
if (buf[0] === 0x1f && buf[1] === 0x8b) {
  console.log('WASM already gzipped, skipping')
  process.exit(0)
}

const gz = gzipSync(buf, { level: 9 })
writeFileSync(wasmPath, gz)
console.log(`Gzipped ffmpeg-core.wasm: ${buf.length} -> ${gz.length} bytes`)
