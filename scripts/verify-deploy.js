import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

const dist = resolve('dist')
const cloudflareFileLimit = 25 * 1024 * 1024

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(relativePath) {
  const path = join(dist, relativePath)
  assert(existsSync(path), `Missing deployment file: ${relativePath}`)
  return readFileSync(path)
}

function collectFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = join(prefix, entry.name)
    const absolutePath = join(directory, entry.name)
    return entry.isDirectory() ? collectFiles(absolutePath, relativePath) : [relativePath]
  })
}

const requiredFiles = [
  'index.html',
  'about/index.html',
  '404.html',
  'favicon.ico',
  'logo.webp',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  'sw.js',
  '_headers',
  '_redirects',
  'ffmpeg/ffmpeg-core.js',
  'ffmpeg/ffmpeg-core.wasm',
  'ffmpeg/ffmpeg-core.worker.js',
  'ffmpeg/single/ffmpeg-core.js',
  'ffmpeg/single/ffmpeg-core.wasm',
]
requiredFiles.forEach(read)

const files = collectFiles(dist)
for (const relativePath of files) {
  const size = statSync(join(dist, relativePath)).size
  assert(size <= cloudflareFileLimit, `${relativePath} is ${(size / 1024 / 1024).toFixed(2)} MiB; Cloudflare Pages allows 25 MiB per asset`)
}

const wasm = read('ffmpeg/ffmpeg-core.wasm')
assert(wasm[0] === 0x1f && wasm[1] === 0x8b, 'FFmpeg WASM is not gzip-compressed')
const singleWasm = read('ffmpeg/single/ffmpeg-core.wasm')
assert(singleWasm[0] === 0x1f && singleWasm[1] === 0x8b, 'Single-thread FFmpeg WASM is not gzip-compressed')

for (const page of ['index.html', 'about/index.html']) {
  const html = read(page).toString('utf8')
  assert(html.includes('rel="canonical"'), `${page} has no canonical URL`)
  assert(html.includes('property="og:title"'), `${page} has no Open Graph title`)
  assert(html.includes('name="twitter:card"'), `${page} has no Twitter card metadata`)
  assert(html.includes('type="application/ld+json"'), `${page} has no structured data`)
  assert(!html.includes('/src/'), `${page} contains a source-only asset URL`)

  const structuredData = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]
  assert(structuredData, `${page} structured data could not be found`)
  JSON.parse(structuredData)
}

const headers = read('_headers').toString('utf8')
assert(headers.includes('Cross-Origin-Opener-Policy: same-origin'), 'COOP header is missing')
assert(headers.includes('Cross-Origin-Embedder-Policy: require-corp'), 'COEP header is missing')
assert(headers.includes('Content-Encoding: gzip'), 'WASM gzip response header is missing')
assert(headers.includes('Content-Type: application/wasm'), 'WASM content type header is missing')

const sitemap = read('sitemap.xml').toString('utf8')
assert(sitemap.includes('https://convert.sethworks.xyz/'), 'Homepage is missing from sitemap')
assert(sitemap.includes('https://convert.sethworks.xyz/about/'), 'About page is missing from sitemap')

const largest = files
  .map((relativePath) => ({ relativePath, size: statSync(join(dist, relativePath)).size }))
  .sort((a, b) => b.size - a.size)[0]

console.log(`Cloudflare deployment verified: ${files.length} files, largest asset ${(largest.size / 1024 / 1024).toFixed(2)} MiB (${largest.relativePath})`)
