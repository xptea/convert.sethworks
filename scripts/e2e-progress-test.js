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
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  await page.goto(baseURL)

  await page.locator('input[type="file"]').first().setInputFiles(videoPath)
  await page.getByRole('button', { name: 'MP4 (H.264)', exact: true }).first().click()
  await page.getByRole('button', { name: 'WebM (VP8)', exact: true }).first().click()
  await page.getByRole('button', { name: 'Convert', exact: true }).first().click()

  await page.getByText(/Encoding media/).waitFor({ state: 'visible', timeout: 120_000 })
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Convert', exact: true }).waitFor({ state: 'visible' })
  assert(await page.getByRole('button', { name: 'Download', exact: true }).count() === 0, 'Cancelled conversion produced a download')
  await page.getByRole('button', { name: 'Convert', exact: true }).click()

  const progress = page.getByRole('progressbar', { name: `Conversion progress for video_test1.mp4` })
  await progress.waitFor({ state: 'visible', timeout: 120_000 })

  const samples = []
  let previousEncodingValue = 0
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (await page.getByRole('button', { name: 'Download', exact: true }).count()) break

    const error = page.locator('.text-destructive')
    if (await error.count()) throw new Error(await error.first().innerText())

    if (await progress.count()) {
      const valueAttribute = await progress.getAttribute('aria-valuenow')
      const value = valueAttribute === null ? null : Number(valueAttribute)
      const text = await progress.getAttribute('aria-valuetext')
      if (value !== null) {
        assert(Number.isFinite(value), 'Progress bar reported a non-numeric value')
        assert(text?.startsWith('Encoding media'), `A made-up percentage was shown during: ${text}`)
        assert(
          value >= previousEncodingValue,
          `Encoding progress moved backward from ${previousEncodingValue}% to ${value}%`
        )
        previousEncodingValue = value
      }
      if (samples.at(-1)?.value !== value || samples.at(-1)?.text !== text) {
        samples.push({ value, text })
      }
    }

    await page.waitForTimeout(100)
  }

  await page.getByRole('button', { name: 'Download', exact: true }).first().waitFor({ state: 'visible', timeout: 10_000 })
  const encodedValues = samples
    .filter((sample) => sample.text?.startsWith('Encoding media') && sample.value !== null)
    .map((sample) => sample.value)
  assert(samples.some((sample) => sample.value === null), `Expected honest indeterminate stages, got ${JSON.stringify(samples)}`)
  assert(new Set(encodedValues).size >= 3, `Expected timestamp-based encoding progress, got ${JSON.stringify(samples)}`)
  assert(samples.every((sample) => !sample.text?.includes('processed')), 'Processed-media time is still exposed')
  assert(await page.locator('[data-testid="overall-elapsed"], [data-testid^="item-elapsed-"]').count() === 0, 'Elapsed timers are still rendered')

  await browser.close()
  console.log(`Progress regression test passed with ${samples.length} updates: ${samples.map((sample) => sample.text).join(' | ')}`)
}

run().catch((error) => {
  console.error('Progress regression test failed:', error)
  process.exit(1)
})
