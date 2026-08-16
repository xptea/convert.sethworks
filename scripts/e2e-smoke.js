import { chromium } from 'playwright'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const baseURL = process.env.BASE_URL || 'http://localhost:4173'

async function testImage() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()

  console.log('Opening', baseURL)
  await page.goto(baseURL)
  await page.waitForSelector('text=Image')

  const fileChooser = await page.locator('input[type="file"]').first()
  const testImage = resolve('public/clay.png')
  if (!existsSync(testImage)) throw new Error('Missing test image: ' + testImage)

  await fileChooser.setInputFiles(testImage)

  // Wait for preview to appear.
  await page.waitForSelector('img[alt="Preview"]')

  // Convert to WebP.
  await page.locator('text=JPEG').first().click()
  await page.getByText('WebP', { exact: false }).first().click()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Convert & download' }).first().click(),
  ])

  const path = await download.path()
  const buffer = readFileSync(path)
  console.log('Image converted:', buffer.length, 'bytes')
  if (buffer.length < 1000) throw new Error('Converted image too small')

  await browser.close()
}

async function testVideo() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()

  page.on('console', (msg) => console.log('PAGE CONSOLE:', msg.type(), msg.text()))
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message))

  await page.goto(baseURL)

  await page.getByRole('tab', { name: 'Video' }).click()

  // Wait for the Video tab to become active; the active tab only has one visible file input.
  await page.waitForFunction(() => document.body.innerText.includes('Video converter'))
  const fileChooser = await page.locator('input[type="file"]').first()
  const testVideo = resolve('public/replay-1786422121.mp4')
  if (!existsSync(testVideo)) {
    console.log('No test video, skipping video test')
    await browser.close()
    return
  }

  console.log('Uploading test video')
  await fileChooser.setInputFiles(testVideo)

  // Wait for the file name to show and the button to enable.
  await page.waitForSelector('text=Selected:')
  const button = page.getByRole('button', { name: /Convert & download/ }).first()
  await expectEnabled(button)

  console.log('Starting video conversion')
  const downloadPromise = page.waitForEvent('download', { timeout: 900_000 })
  await button.click()

  // Wait for conversion to start (core load + progress).
  try {
    await page.waitForFunction(
      () => document.body.innerText.includes('Converting to'),
      { timeout: 120_000 }
    )
    console.log('FFmpeg loaded and conversion started')
  } catch (e) {
    const text = await page.evaluate(() => document.body.innerText)
    console.error('Page text at failure:', text.slice(0, 2000))
    throw e
  }

  // Wait for the download to complete (up to 15 minutes for the full test file).
  const download = await downloadPromise
  const path = await download.path()
  const buffer = readFileSync(path)
  console.log('Video converted:', buffer.length, 'bytes')
  if (buffer.length < 1000) throw new Error('Converted video too small')

  await browser.close()
}

async function expectEnabled(locator) {
  for (let i = 0; i < 50; i++) {
    if (await locator.isEnabled()) return
    await locator.page().waitForTimeout(100)
  }
  throw new Error('Button did not become enabled')
}

;(async () => {
  try {
    await testImage()
    await testVideo()
    console.log('Smoke tests passed')
    process.exit(0)
  } catch (e) {
    console.error('Smoke test failed:', e)
    process.exit(1)
  }
})()
