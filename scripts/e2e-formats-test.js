import { chromium } from 'playwright'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const baseURL = process.env.BASE_URL || 'http://localhost:5173'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()

  page.on('console', (msg) => console.log('PAGE CONSOLE:', msg.type(), msg.text()))
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message))

  console.log('Opening', baseURL)
  await page.goto(baseURL)

  const image = resolve('public/clay.png')
  const video = resolve('public/replay-1786422121.mp4')
  if (!existsSync(image)) throw new Error('Missing ' + image)
  if (!existsSync(video)) throw new Error('Missing ' + video)

  await page.locator('input[type="file"]').first().setInputFiles([image, video])
  await page.waitForSelector('text=Convert all')
  console.log('Files added')

  // Open first format picker (image, currently JPEG) and select BMP.
  await page.getByRole('button', { name: 'JPEG' }).first().click()
  await page.getByRole('button', { name: 'BMP' }).click()
  console.log('Selected BMP for first image')

  // Open second format picker (video, currently MP4 (H.264)) and select MP3.
  const mp4Triggers = page.getByRole('button', { name: 'MP4 (H.264)' })
  await mp4Triggers.first().click()
  await page.getByRole('button', { name: 'MP3' }).click()
  console.log('Selected MP3 for video')

  // Convert all and wait for two Download buttons.
  await page.getByRole('button', { name: 'Convert all' }).click()
  const downloadButtonLocator = page.getByRole('button', { name: /Download$/ })
  for (let i = 0; i < 900; i++) {
    const c = await downloadButtonLocator.count()
    if (c >= 2) break
    await page.waitForTimeout(1000)
  }
  console.log('Both conversions finished')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download all' }).click(),
  ])

  const path = await download.path()
  const buffer = readFileSync(path)
  console.log('Downloaded archive:', buffer.length, 'bytes')
  if (buffer.length < 100_000) throw new Error('Archive too small')

  await browser.close()
}

;(async () => {
  try {
    await run()
    console.log('Format test passed')
    process.exit(0)
  } catch (e) {
    console.error('Format test failed:', e)
    process.exit(1)
  }
})()
