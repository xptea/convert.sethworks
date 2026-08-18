import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import coreFactory from '@ffmpeg/core-mt'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicRoot = join(root, 'public')
const publicDir = join(publicRoot, 'ffmpeg')
const coreDir = dirname(fileURLToPath(import.meta.resolve('@ffmpeg/core-mt')))

if (typeof coreFactory !== 'function') {
  throw new TypeError('The @ffmpeg/core-mt package does not expose its FFmpeg core factory')
}

if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true })
}

for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm', 'ffmpeg-core.worker.js']) {
  const from = join(coreDir, file)
  const to = join(publicDir, file)
  if (existsSync(from)) {
    copyFileSync(from, to)
    console.log(`copied ${from} -> ${to}`)
  } else {
    console.error(`missing ${from}`)
    process.exit(1)
  }
}

for (const [source, destination] of [
  ['logo.webp', 'logo.webp'],
  ['favcon.ico', 'favicon.ico'],
]) {
  const from = join(root, 'src', 'assets', source)
  const to = join(publicRoot, destination)
  if (existsSync(from)) {
    copyFileSync(from, to)
    console.log(`copied ${from} -> ${to}`)
  } else {
    console.error(`missing ${from}`)
    process.exit(1)
  }
}
