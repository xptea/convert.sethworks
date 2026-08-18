const CACHE_NAME = 'local-convert-v1'
const CORE_ASSETS = [
  '/',
  '/about/',
  '/site.webmanifest',
  '/favicon.ico',
  '/logo.webp',
  '/ffmpeg/ffmpeg-core.js',
  '/ffmpeg/ffmpeg-core.wasm',
  '/ffmpeg/ffmpeg-core.worker.js',
  '/ffmpeg/single/ffmpeg-core.js',
  '/ffmpeg/single/ffmpeg-core.wasm',
]

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(CORE_ASSETS)

    const home = await cache.match('/')
    const html = home ? await home.text() : ''
    const builtAssets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])
    await cache.addAll([...new Set(builtAssets)])
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        const cache = await caches.open(CACHE_NAME)
        await cache.put(request, response.clone())
        return response
      } catch {
        const cache = await caches.open(CACHE_NAME)
        return await cache.match(request) ?? await cache.match(url.pathname.startsWith('/about') ? '/about/' : '/')
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(request, response.clone())
    }
    return response
  })())
})
