import { chromium } from 'playwright'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const baseURL = process.env.BASE_URL || 'http://localhost:4173'
const imageName = process.env.IMAGE || 'image_test1.png'
const videoName = process.env.VIDEO || 'video_test1.mp4'
const limit = Number(process.env.LIMIT) || 0
const concurrency = Number(process.env.CONCURRENCY) || (process.env.FAST ? 6 : 3)

const FAST_IMAGE = ['PNG', 'JPEG', 'WebP', 'BMP']
const FAST_VIDEO = [
  'MP4 (H.264)', 'MOV', 'M4V', 'MKV', 'AVI', 'FLV', '3GP',
  'MP3', 'WAV', 'FLAC', 'AAC', 'Opus', 'M4A',
]

function findFile(name) {
  const candidates = [resolve(name), resolve('public', name), resolve('tests', name)]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return null
}

function parseSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker)
  if (start === -1) throw new Error(`Missing ${startMarker} in formats.ts`)
  const end = endMarker ? text.indexOf(endMarker, start) : text.length
  const section = text.slice(start, end === -1 ? text.length : end)
  const entries = []
  const re = /\{\s*value:\s*'([^']+)',\s*label:\s*'([^']+)',\s*ext:\s*'([^']+)'/g
  let m
  while ((m = re.exec(section)) !== null) {
    entries.push({ value: m[1], label: m[2], ext: m[3] })
  }
  return entries
}

function loadFormats() {
  const text = readFileSync(resolve('src/lib/formats.ts'), 'utf8')
  const imageFormats = parseSection(text, 'export const IMAGE_OUTPUTS', 'export const VIDEO_OUTPUTS')
  const videoFormats = parseSection(text, 'export const VIDEO_OUTPUTS', 'export const AUDIO_OUTPUTS')
  const audioFormats = parseSection(text, 'export const AUDIO_OUTPUTS', 'const ALL_MEDIA_OUTPUTS')
  return {
    imageFormats,
    videoFormats: [...videoFormats, ...audioFormats],
  }
}

const { imageFormats, videoFormats } = loadFormats()
const imageDefault = imageFormats.find((f) => f.value === 'jpg')?.label || imageFormats[0]?.label
const videoDefault = videoFormats.find((f) => f.value === 'mp4')?.label || videoFormats[0]?.label

const imagePath = findFile(imageName)
const videoPath = findFile(videoName)

if (!imagePath) throw new Error(`Image test file not found: ${imageName}`)
if (!videoPath) throw new Error(`Video test file not found: ${videoName}`)

async function testFormat(page, job) {
  const { file, defaultLabel, format } = job

  await page.goto(baseURL)
  await page.waitForSelector('text=Drop files here or click to browse', { timeout: 120000 })

  const input = page.locator('input[type="file"]').first()
  await input.setInputFiles(file)
  await page.waitForSelector('text=Convert all', { timeout: 120000 })

  // Open the per-item format picker and select the target format.
  await page.getByRole('button', { name: defaultLabel, exact: true }).first().click()
  await page.getByRole('button', { name: format.label, exact: true }).first().click()

  // Start conversion.
  await page.getByRole('button', { name: /^Convert$/, exact: true }).first().click()

  // Wait for the item's Download button or an error message.
  for (let i = 0; i < 1200; i++) {
    const downloads = await page.getByRole('button', { name: /^Download$/, exact: true }).count()
    const errors = await page.locator('.text-destructive').count()
    if (downloads > 0) break
    if (errors > 0) throw new Error(`Conversion failed for ${format.label}`)
    await page.waitForTimeout(1000)
  }

  // Download the single converted file.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /^Download$/, exact: true }).first().click(),
  ])

  const path = await download.path()
  const buffer = readFileSync(path)
  const filename = download.suggestedFilename()

  if (buffer.length === 0) throw new Error(`Downloaded file for ${format.label} is empty`)
  if (!filename.includes('-converted.')) {
    throw new Error(`Unexpected filename for ${format.label}: ${filename}`)
  }
  if (!filename.toLowerCase().endsWith(`.${format.ext}`)) {
    throw new Error(`Expected .${format.ext} for ${format.label}, got ${filename}`)
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ acceptDownloads: true })

  const selectedImage = process.env.FAST
    ? imageFormats.filter((f) => FAST_IMAGE.includes(f.label))
    : imageFormats
  const selectedVideo = process.env.FAST
    ? videoFormats.filter((f) => FAST_VIDEO.includes(f.label))
    : videoFormats

  const queue = []
  for (const format of limit ? selectedImage.slice(0, limit) : selectedImage) {
    queue.push({ type: 'image', file: imagePath, defaultLabel: imageDefault, format })
  }
  for (const format of limit ? selectedVideo.slice(0, limit) : selectedVideo) {
    queue.push({ type: 'video', file: videoPath, defaultLabel: videoDefault, format })
  }

  const results = []
  const workers = Math.min(queue.length, Number(process.env.CONCURRENCY) || queue.length)

  async function worker() {
    const page = await context.newPage()
    page.on('console', (msg) => console.log('PAGE CONSOLE:', msg.type(), msg.text()))
    page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message))

    while (queue.length > 0) {
      const job = queue.shift()
      if (!job) continue
      try {
        await testFormat(page, job)
        console.log(`[PASS] ${job.type} -> ${job.format.label}`)
        results.push({ type: job.type, label: job.format.label, ok: true })
      } catch (e) {
        console.error(`[FAIL] ${job.type} -> ${job.format.label}:`, e.message)
        results.push({ type: job.type, label: job.format.label, ok: false, error: e.message })
      }
    }

    await page.close()
  }

  console.log('Opening', baseURL)
  console.log('Image:', imagePath)
  console.log('Video:', videoPath)
  console.log(`Running with ${workers} parallel workers`)
  if (limit) console.log(`Limit set to ${limit} formats per type`)

  await Promise.all(Array.from({ length: workers }).map(() => worker()))

  const imageResults = results.filter((r) => r.type === 'image')
  const videoResults = results.filter((r) => r.type === 'video')
  const failures = results.filter((r) => !r.ok)
  const total = results.length
  const passed = total - failures.length

  console.log('\n---')
  console.log(`${passed}/${total} conversions passed`)
  if (failures.length > 0) {
    console.log('Failures:')
    for (const f of failures) {
      console.log(`  - ${f.type} ${f.label}: ${f.error}`)
    }
  }

  await browser.close()
  return failures.length === 0
}

;(async () => {
  try {
    const ok = await run()
    console.log(ok ? 'All formats test passed' : 'All formats test failed')
    process.exit(ok ? 0 : 1)
  } catch (e) {
    console.error('All formats test error:', e)
    process.exit(1)
  }
})()
