import { chromium } from 'playwright'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const baseURL = process.env.BASE_URL || 'http://localhost:4173'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()

  page.on('console', (msg) => console.log('PAGE CONSOLE:', msg.type(), msg.text()))
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message))

  console.log('Opening', baseURL)
  await page.goto(baseURL)

  const input = await page.locator('input[type="file"]').first()
  const image = resolve('public/clay.png')
  const video = resolve('public/replay-1786422121.mp4')
  if (!existsSync(image)) throw new Error('Missing ' + image)
  if (!existsSync(video)) throw new Error('Missing ' + video)

  console.log('Uploading image and video')
  await input.setInputFiles([image, video])

  // Wait for file list to appear.
  await page.waitForSelector('text=Convert all')
  console.log('Files added')

  const convertAll = page.getByRole('button', { name: 'Convert all' })

  console.log('Starting conversion')
  await convertAll.click()

  // Wait for both items to show a Download button.
  const downloadButtonLocator = page.getByRole('button', { name: /Download$/ })
  for (let i = 0; i < 900; i++) {
    const count = await downloadButtonLocator.count()
    if (count >= 2) break
    await page.waitForTimeout(1000)
  }
  console.log('Both conversions finished')

  const downloadAll = page.getByRole('button', { name: 'Download all' })
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    downloadAll.click(),
  ])

  const path = await download.path()
  const buffer = readFileSync(path)
  console.log('Downloaded archive:', buffer.length, 'bytes')
  if (buffer.length < 100_000) throw new Error('Downloaded archive too small (expected both files)')

  await browser.close()
}

;(async () => {
  try {
    await run()
    console.log('Smoke test passed')
    process.exit(0)
  } catch (e) {
    console.error('Smoke test failed:', e)
    process.exit(1)
  }
})()
