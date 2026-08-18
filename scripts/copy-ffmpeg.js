import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicRoot = join(root, 'public')
const publicDir = join(publicRoot, 'ffmpeg')

if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true })
}

for (const core of [
  { packageName: '@ffmpeg/core-mt', destination: publicDir, files: ['ffmpeg-core.js', 'ffmpeg-core.wasm', 'ffmpeg-core.worker.js'] },
  { packageName: '@ffmpeg/core', destination: join(publicDir, 'single'), files: ['ffmpeg-core.js', 'ffmpeg-core.wasm'] },
]) {
  const coreDir = dirname(fileURLToPath(import.meta.resolve(core.packageName)))
  mkdirSync(core.destination, { recursive: true })
  for (const file of core.files) {
    const from = join(coreDir, file)
    const to = join(core.destination, file)
    if (existsSync(from)) {
      copyFileSync(from, to)
      console.log(`copied ${from} -> ${to}`)
    } else {
      console.error(`missing ${from}`)
      process.exit(1)
    }
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
