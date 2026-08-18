import { chromium } from 'playwright'
import { mkdtempSync, rmSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const baseURL = process.env.BASE_URL || 'http://localhost:4173'

async function waitForConversion(page) {
  const result = await Promise.race([
    page.getByRole('button', { name: 'Download', exact: true }).waitFor({ timeout: 180000 }).then(() => 'done'),
    page.locator('.text-destructive').waitFor({ timeout: 180000 }).then(() => 'error'),
  ])
  if (result === 'error') throw new Error(await page.locator('.text-destructive').first().innerText())
}

async function convertAndDownload(page, inputPath, targetFormat, outputPath) {
  await page.goto(baseURL)
  await page.locator('input[type="file"]').first().setInputFiles(inputPath)
  const formatPicker = page.getByTestId(/^item-format-/)
  if ((await formatPicker.innerText()).trim() !== targetFormat) {
    await formatPicker.click()
    await page.getByTestId('format-scroll-area').getByRole('button', { name: targetFormat, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Convert', exact: true }).click()
  await waitForConversion(page)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download', exact: true }).click(),
  ])
  await download.saveAs(outputPath)
}

async function run() {
  const outputDir = mkdtempSync(join(tmpdir(), 'convert-large-image-'))
  const pngPath = join(outputDir, 'large-source.png')
  const tiffPath = join(outputDir, 'large-source.tiff')
  const jpegPath = join(outputDir, 'large-source.jpg')
  const webpPath = join(outputDir, 'large-source.webp')
  const browser = await chromium.launch({ headless: true })

  try {
    const context = await browser.newContext({ acceptDownloads: true })
    const fixturePage = await context.newPage()
    await fixturePage.setViewportSize({ width: 6000, height: 4000 })
    await fixturePage.setContent(`
      <style>
        html, body { margin: 0; width: 100%; height: 100%; }
        body {
          background:
            radial-gradient(circle at 25% 25%, #ef4444, transparent 35%),
            radial-gradient(circle at 75% 70%, #3b82f6, transparent 40%),
            linear-gradient(135deg, #111827, #f8fafc);
        }
      </style>
    `)
    await fixturePage.screenshot({ path: pngPath })
    await fixturePage.close()

    const page = await context.newPage()
    await convertAndDownload(page, pngPath, 'TIFF', tiffPath)

    await page.goto(baseURL)
    await page.locator('input[type="file"]').first().setInputFiles(tiffPath)
    const jpegStartedAt = performance.now()
    await page.getByRole('button', { name: 'Convert', exact: true }).click()
    await waitForConversion(page)
    const jpegSeconds = (performance.now() - jpegStartedAt) / 1000

    const [jpegDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download', exact: true }).click(),
    ])
    await jpegDownload.saveAs(jpegPath)

    const formatPicker = page.getByTestId(/^item-format-/)
    await formatPicker.click()
    await page.getByTestId('format-scroll-area').getByRole('button', { name: 'WebP', exact: true }).click()
    const webpStartedAt = performance.now()
    await page.getByRole('button', { name: 'Convert', exact: true }).click()
    await waitForConversion(page)
    const webpSeconds = (performance.now() - webpStartedAt) / 1000

    const [webpDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download', exact: true }).click(),
    ])
    await webpDownload.saveAs(webpPath)

    const tiffSize = statSync(tiffPath).size
    const jpegSize = statSync(jpegPath).size
    const webpSize = statSync(webpPath).size
    if (tiffSize < 1_000_000) throw new Error(`Large TIFF output is unexpectedly small: ${tiffSize} bytes`)
    if (jpegSize < 10_000) throw new Error(`JPEG output is unexpectedly small: ${jpegSize} bytes`)
    if (webpSize < 10_000) throw new Error(`WebP output is unexpectedly small: ${webpSize} bytes`)
    console.log(
      `Large-image retry passed: 6000x4000 TIFF -> JPEG -> WebP ` +
      `(${tiffSize} -> ${jpegSize} -> ${webpSize} bytes; ${jpegSeconds.toFixed(1)}s + ${webpSeconds.toFixed(1)}s)`
    )
  } finally {
    await browser.close()
    rmSync(outputDir, { recursive: true, force: true })
  }
}

run().catch((error) => {
  console.error('Large-image regression failed:', error)
  process.exit(1)
})
