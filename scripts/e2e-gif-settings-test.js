import { chromium } from 'playwright'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const baseURL = process.env.BASE_URL || 'http://localhost:4173'
const videoPath = resolve('tests/video_test1.mp4')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function findBytes(buffer, bytes) {
  return buffer.indexOf(Buffer.from(bytes))
}

async function run() {
  assert(existsSync(videoPath), `Missing ${videoPath}`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  try {
    await page.goto(baseURL)
    await page.locator('input[type="file"]').first().setInputFiles(videoPath)
    await page.getByText('video_test1.mp4', { exact: true }).waitFor()

    await page.getByRole('button', { name: 'MP4 (H.264)', exact: true }).first().click()
    await page.getByRole('button', { name: 'GIF', exact: true }).first().click()
    await page.getByRole('button', { name: 'Conversion settings for video_test1.mp4', exact: true }).click()

    const resolution = page.getByRole('combobox', { name: 'GIF resolution' })
    const frameRate = page.getByRole('combobox', { name: 'GIF frame rate' })
    const colors = page.getByRole('combobox', { name: 'GIF palette colors' })
    const loop = page.getByRole('combobox', { name: 'GIF loop behavior' })
    const dithering = page.getByRole('combobox', { name: 'GIF dithering' })

    assert(await resolution.inputValue() === '640', 'GIF resolution default is not 640px')
    assert(await frameRate.inputValue() === '15', 'GIF frame-rate default is not 15 FPS')
    assert(await colors.inputValue() === '256', 'GIF palette default is not 256 colors')
    assert(await loop.inputValue() === 'forever', 'GIF loop default is not forever')
    assert(await dithering.inputValue() === 'sierra2_4a', 'GIF dithering default is not smooth gradients')
    await page.getByText('GIF has no normal bitrate setting.', { exact: false }).waitFor()

    await resolution.selectOption('640')
    await frameRate.selectOption('30')
    await colors.selectOption('256')
    await loop.selectOption('once')
    await dithering.selectOption('bayer')

    assert(await resolution.inputValue() === '640', 'GIF resolution did not update')
    assert(await frameRate.inputValue() === '30', 'GIF frame rate did not update')
    assert(await colors.inputValue() === '256', 'GIF palette size did not update')
    assert(await loop.inputValue() === 'once', 'GIF loop setting did not update')
    assert(await dithering.inputValue() === 'bayer', 'GIF dithering did not update')

    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Convert', exact: true }).first().click()

    const downloadButton = page.getByRole('button', { name: 'Download', exact: true }).last()
    const progressBar = page.getByRole('progressbar', { name: 'Conversion progress for video_test1.mp4' })
    await progressBar.waitFor({ state: 'visible', timeout: 120_000 })
    const progressSamples = []
    const progressDeadline = Date.now() + 120_000
    while (Date.now() < progressDeadline && await downloadButton.count() === 0) {
      const snapshot = await progressBar.evaluateAll((elements) => {
        const element = elements[0]
        return element ? {
          rawValue: element.getAttribute('aria-valuenow'),
          text: element.getAttribute('aria-valuetext'),
        } : null
      })
      if (snapshot) {
        const value = snapshot.rawValue === null ? null : Number(snapshot.rawValue)
        const text = snapshot.text
        if (progressSamples.at(-1)?.value !== value || progressSamples.at(-1)?.text !== text) {
          progressSamples.push({ value, text })
        }
      }
      await page.waitForTimeout(50)
    }
    await downloadButton.waitFor({ state: 'visible', timeout: 120_000 })
    const queueItemText = await page.getByTestId('queue-item').first().innerText()
    assert(/\d+×\d+.*\d+:\d+/.test(queueItemText), `Completed media details disappeared: ${queueItemText}`)

    await page.getByRole('button', { name: 'Open preview for video_test1.mp4', exact: true }).click()
    const previewDialog = page.getByRole('dialog')
    const originalVideo = previewDialog.locator('video[aria-label^="Original"]')
    await originalVideo.waitFor({ state: 'visible' })
    await page.waitForTimeout(500)
    assert(
      await originalVideo.evaluate((video) => !video.paused && video.currentTime > 0),
      'Original video did not autoplay when the preview opened'
    )
    const convertedImage = previewDialog.locator('img[alt^="Converted"]')
    await convertedImage.waitFor({ state: 'visible' })
    const previewMime = await convertedImage.evaluate(async (image) => (await fetch(image.src)).headers.get('content-type'))
    assert(previewMime === 'image/png', `GIF preview is not frozen to its first frame: ${previewMime}`)
    await page.getByRole('button', { name: 'Close preview', exact: true }).click()

    assert(
      progressSamples.some((sample) => sample.value === null),
      `GIF conversion did not show indeterminate work honestly: ${JSON.stringify(progressSamples)}`
    )
    const measuredGifProgress = progressSamples.filter(
      (sample) => sample.value !== null && sample.text?.startsWith('Encoding GIF')
    )
    assert(
      new Set(measuredGifProgress.map((sample) => sample.value)).size >= 2,
      `GIF conversion did not expose real media-time progress: ${JSON.stringify(progressSamples)}`
    )
    const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()])
    const outputPath = await download.path()
    assert(outputPath, 'GIF download has no path')

    const gif = readFileSync(outputPath)
    const signature = gif.subarray(0, 6).toString('ascii')
    assert(signature === 'GIF87a' || signature === 'GIF89a', `Invalid GIF signature: ${signature}`)
    const gifWidth = gif.readUInt16LE(6)
    assert(gifWidth === 640, `Expected a 640px GIF, got ${gifWidth}px`)
    assert(findBytes(gif, Buffer.from('NETSCAPE2.0')) === -1, 'Play-once GIF unexpectedly contains an infinite-loop extension')

    const graphicsControl = findBytes(gif, [0x21, 0xf9, 0x04])
    assert(graphicsControl >= 0, 'GIF has no graphics-control frame timing block')
    const delayCentiseconds = gif.readUInt16LE(graphicsControl + 4)
    assert(
      delayCentiseconds >= 3 && delayCentiseconds <= 4,
      `Expected about 30 FPS (3–4cs delay), got ${delayCentiseconds}cs`
    )

    // Editing a completed GIF must create a fresh pending job, and the reused
    // FFmpeg worker must not leak the previous job's final 100% event into it.
    await page.getByRole('button', { name: 'Conversion settings for video_test1.mp4', exact: true }).click()
    await resolution.selectOption('480')
    await frameRate.selectOption('10')
    await colors.selectOption('128')
    await page.keyboard.press('Escape')
    assert(await progressBar.count() === 0, 'Editing completed GIF settings did not clear the old progress bar')
    await page.getByRole('button', { name: 'Convert', exact: true }).first().click()
    await progressBar.waitFor({ state: 'visible', timeout: 120_000 })

    const secondRunValues = []
    const secondRunDeadline = Date.now() + 120_000
    while (Date.now() < secondRunDeadline && await downloadButton.count() === 0) {
      const snapshot = await progressBar.evaluateAll((elements) => {
        const element = elements[0]
        return element ? element.getAttribute('aria-valuenow') : null
      })
      if (snapshot !== null) secondRunValues.push(Number(snapshot))
      await page.waitForTimeout(50)
    }
    await downloadButton.waitFor({ state: 'visible', timeout: 120_000 })
    assert(secondRunValues.length > 0, 'Second GIF conversion did not report measurable progress')
    assert(secondRunValues[0] < 100, `Second GIF conversion restarted at ${secondRunValues[0]}%`)
    assert(secondRunValues.some((value) => value > 0 && value < 100), 'Second GIF conversion stayed pinned at 100%')

    console.log(`GIF high-quality and reconversion test passed (${gif.length} bytes, ${gifWidth}px, ${delayCentiseconds}cs frame delay)`)
  } finally {
    await browser.close()
  }
}

run().catch((error) => {
  console.error('GIF settings test failed:', error)
  process.exit(1)
})
