import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'public', 'ffmpeg')
const coreDir = join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm')

if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true })
}

for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
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
