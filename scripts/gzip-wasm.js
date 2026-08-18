import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { gzipSync } from 'zlib'

for (const wasmPath of [
  resolve('dist/ffmpeg/ffmpeg-core.wasm'),
  resolve('dist/ffmpeg/single/ffmpeg-core.wasm'),
]) {
  if (!existsSync(wasmPath)) {
    console.warn('WASM file not found, skipping gzip:', wasmPath)
    continue
  }

  const buf = readFileSync(wasmPath)
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    console.log('WASM already gzipped, skipping:', wasmPath)
    continue
  }

  const gz = gzipSync(buf, { level: 9 })
  writeFileSync(wasmPath, gz)
  console.log(`Gzipped ${wasmPath}: ${buf.length} -> ${gz.length} bytes`)
}
