import { chromium } from 'playwright'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

const baseURL = process.env.BASE_URL || 'http://localhost:5173'
const imagePath = resolve(process.env.IMAGE || 'tests/image_test1.png')
const videoPath = resolve(process.env.VIDEO || 'tests/video_test1.mp4')

const NEW_IMAGE_VALUES = ['ico', 'apng', 'jp2', 'jls', 'exr', 'qoi', 'pcx', 'fits', 'sunras']
const NEW_VIDEO_VALUES = [
  'mp4-hevc', 'mpeg4-avi', 'mpegts', 'prores', 'dnxhr', 'ffv1', 'huffyuv', 'utvideo',
  'dv', 'vob', 'nut', 'y4m', 'rm', 'h261', 'h263', 'amv', 'swf',
]

function parseFormats() {
  const text = readFileSync(resolve('src/lib/formats.ts'), 'utf8')
  const entries = new Map()
  const re = /\{\s*value:\s*'([^']+)',\s*label:\s*'([^']+)',\s*ext:\s*'([^']+)'/g
  let match
  while ((match = re.exec(text)) !== null) {
    entries.set(match[1], { value: match[1], label: match[2], ext: match[3] })
  }
  return entries
}

async function convertAndDownload(page, input, defaultLabel, targetLabel, outputDir) {
  await page.goto(baseURL)
  await page.waitForSelector('text=Drop files here or click to browse', { timeout: 120000 })
  await page.locator('input[type="file"]').first().setInputFiles(input)
  await page.waitForSelector('text=Convert all', { timeout: 120000 })

  if (targetLabel !== defaultLabel) {
    await page.getByRole('button', { name: defaultLabel, exact: true }).first().click({ timeout: 120000 })
    await page.getByRole('button', { name: targetLabel, exact: true }).first().click({ timeout: 120000 })
  }

  await page.getByRole('button', { name: /^Convert$/, exact: true }).first().click({ timeout: 120000 })

  for (let i = 0; i < 1200; i++) {
    if (await page.getByRole('button', { name: /^Download$/, exact: true }).count()) break
    if (await page.locator('.text-destructive').count()) {
      throw new Error(await page.locator('.text-destructive').first().innerText())
    }
    await page.waitForTimeout(500)
  }

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /^Download$/, exact: true }).first().click(),
  ])
  const path = await download.path()
  if (!path) throw new Error(`No downloaded file for ${targetLabel}`)
  const name = download.suggestedFilename()
  const savedPath = resolve(outputDir, `${Date.now()}-${name}`)
  await download.saveAs(savedPath)
  const size = statSync(savedPath).size
  if (!size) throw new Error(`Empty downloaded file for ${targetLabel}`)
  return { path: savedPath, size, name }
}

async function run() {
  if (!existsSync(imagePath)) throw new Error(`Missing image fixture: ${imagePath}`)
  if (!existsSync(videoPath)) throw new Error(`Missing video fixture: ${videoPath}`)

  const formats = parseFormats()
  const requested = (process.env.TARGETS || '').split(',').map((value) => value.trim()).filter(Boolean)
  const include = (value) => requested.length === 0 || requested.includes(value)
  const jobs = [
    ...NEW_IMAGE_VALUES.filter(include).map((value) => ({ type: 'image', value })),
    ...NEW_VIDEO_VALUES.filter(include).map((value) => ({ type: 'video', value })),
  ]

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()
  const outputDir = mkdtempSync(join(tmpdir(), 'convert-roundtrip-'))
  page.on('pageerror', (error) => console.error('PAGE ERROR:', error.message))

  const failures = []
  for (const job of jobs) {
    const format = formats.get(job.value)
    if (!format) {
      failures.push(`${job.value}: missing format definition`)
      continue
    }

    const isImage = job.type === 'image'
    const source = isImage ? imagePath : videoPath
    const defaultLabel = isImage ? 'JPEG' : 'MP4 (H.264)'
    const reverseLabel = isImage ? 'PNG' : 'MP4 (H.264)'
    try {
      const encoded = await convertAndDownload(page, source, defaultLabel, format.label, outputDir)
      if (!encoded.name.toLowerCase().endsWith(`.${format.ext}`)) {
        throw new Error(`Expected .${format.ext}, got ${encoded.name}`)
      }
      const reversed = await convertAndDownload(page, encoded.path, defaultLabel, reverseLabel, outputDir)
      console.log(`[PASS] ${format.label} -> ${reverseLabel} (${encoded.size} byte input)`)
      if (!reversed.size) throw new Error('Reverse output was empty')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${format.label}: ${message}`)
      console.error(`[FAIL] ${format.label}: ${message}`)
    }
  }

  await browser.close()
  rmSync(outputDir, { recursive: true, force: true })
  console.log(`\n${jobs.length - failures.length}/${jobs.length} round trips passed`)
  if (failures.length) {
    console.error(failures.join('\n'))
    process.exitCode = 1
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
