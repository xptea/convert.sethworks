import { chromium } from 'playwright'
import { existsSync } from 'fs'
import { resolve } from 'path'

const baseURL = process.env.BASE_URL || 'http://localhost:4173'
const videoPath = resolve('tests/video_test1.mp4')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function run() {
  assert(existsSync(videoPath), `Missing ${videoPath}`)
  const browser = await chromium.launch({ headless: true })

  try {
    const context = await browser.newContext()
    await context.route('**/*', async (route) => {
      if (route.request().resourceType() !== 'document') {
        await route.continue()
        return
      }
      const response = await route.fetch()
      const headers = response.headers()
      delete headers['cross-origin-opener-policy']
      delete headers['cross-origin-embedder-policy']
      await route.fulfill({ response, headers })
    })

    const page = await context.newPage()
    await page.goto(baseURL)
    assert(!await page.evaluate(() => globalThis.crossOriginIsolated), 'Fallback test unexpectedly has cross-origin isolation')
    await page.locator('input[type="file"]').first().setInputFiles(videoPath)
    await page.getByRole('button', { name: 'Convert', exact: true }).click()

    await Promise.race([
      page.getByRole('button', { name: 'Download', exact: true }).waitFor({ timeout: 120_000 }),
      page.locator('.text-destructive').waitFor({ timeout: 120_000 }).then(async () => {
        throw new Error(await page.locator('.text-destructive').first().innerText())
      }),
    ])
    console.log('Single-thread FFmpeg fallback test passed')
  } finally {
    await browser.close()
  }
}

run().catch((error) => {
  console.error('Single-thread FFmpeg fallback test failed:', error)
  process.exit(1)
})
