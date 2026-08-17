import { chromium } from 'playwright'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const baseURL = process.env.BASE_URL || 'http://localhost:4173'
const imagePath = resolve('tests/image_test1.png')
const videoPath = resolve('tests/video_test1.mp4')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function run() {
  assert(existsSync(imagePath), `Missing ${imagePath}`)
  assert(existsSync(videoPath), `Missing ${videoPath}`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  await page.goto(baseURL)

  await page.locator('input[type="file"]').first().setInputFiles([imagePath, imagePath])
  await page.waitForSelector('text=2 files added')
  const setAllImages = page.getByTestId('set-all-images')
  assert(await setAllImages.innerText() === 'JPEG', 'Matching image formats are not reflected in Set All')
  await setAllImages.click()
  const setAllMenu = page.getByTestId('set-all-images-menu')
  assert(
    await setAllMenu.getByRole('button', { name: 'JPEG', exact: true }).getAttribute('aria-pressed') === 'true',
    'Shared JPEG format is not active in the Set All menu'
  )
  await setAllMenu.getByRole('button', { name: 'PNG', exact: true }).click()
  assert(await setAllImages.innerText() === 'PNG', 'Set All did not resync after applying PNG')

  await page.getByRole('button', { name: 'PNG', exact: true }).nth(1).click()
  await page.getByRole('button', { name: 'JPEG', exact: true }).last().click()
  assert(await setAllImages.innerText() === 'Set all images', 'Mixed image formats did not reset Set All')
  await setAllImages.click()
  assert(
    await setAllMenu.locator('button[aria-pressed="true"]').count() === 0,
    'Mixed image formats should not show an active Set All option'
  )
  await page.keyboard.press('Escape')

  const compactFormatButton = page.getByRole('button', { name: 'JPEG', exact: true }).last()
  const compactFormatBox = await compactFormatButton.boundingBox()
  assert(compactFormatBox && compactFormatBox.width < 130, `Format button is still oversized at ${compactFormatBox?.width}px`)

  await page.getByRole('button', { name: 'Clear all', exact: true }).click()
  await page.getByText('Your conversion queue will appear here after you add a file.', { exact: true }).waitFor()
  assert(await page.getByText('image_test1.png', { exact: true }).count() === 0, 'Clear all did not empty the queue')

  await page.goto(baseURL)

  await page.locator('input[type="file"]').first().setInputFiles([imagePath, videoPath])
  await page.waitForSelector('text=2 files added')

  const toolbarBox = await page.getByRole('button', { name: 'Convert all', exact: true }).boundingBox()
  const firstFileBox = await page.getByText('image_test1.png', { exact: true }).boundingBox()
  assert(toolbarBox && firstFileBox && toolbarBox.y < firstFileBox.y, 'Batch controls are not above the files')

  await page.getByRole('button', { name: 'Set all quality', exact: true }).click()
  const bulkSlider = page.getByRole('slider', { name: 'Output quality' })
  const sliderBox = await bulkSlider.boundingBox()
  assert(sliderBox, 'Set-all quality slider is missing')
  await page.mouse.move(sliderBox.x + sliderBox.width - 2, sliderBox.y + sliderBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(sliderBox.x + sliderBox.width * 0.414, sliderBox.y + sliderBox.height / 2, { steps: 5 })
  await page.mouse.up()
  const bulkValue = await bulkSlider.inputValue()
  assert(Number(bulkValue) >= 40 && Number(bulkValue) <= 44, `Chrome slider drag produced ${bulkValue}`)
  await page.getByRole('button', { name: 'Apply to all files', exact: true }).click()

  for (const fileName of ['image_test1.png', 'video_test1.mp4']) {
    await page.getByRole('button', { name: `Output settings for ${fileName}`, exact: true }).click()
    const value = await page.getByRole('slider', { name: 'Output quality' }).inputValue()
    assert(value === bulkValue, `Set-all quality did not update ${fileName}: ${value}`)
    await page.keyboard.press('Escape')
  }

  await page.getByRole('button', { name: 'MP4 (H.264)', exact: true }).first().click()
  const scrollArea = page.getByTestId('format-scroll-area')
  const track = page.getByTestId('format-scroll-track')
  await track.waitFor({ state: 'visible' })

  const metrics = await scrollArea.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  assert(metrics.scrollHeight > metrics.clientHeight, 'Format list is not scrollable')

  await scrollArea.hover()
  await page.mouse.wheel(0, 300)
  await page.waitForTimeout(100)
  assert((await scrollArea.evaluate((element) => element.scrollTop)) > 0, 'Mouse wheel did not scroll formats')

  await scrollArea.evaluate((element) => { element.scrollTop = 0 })
  const thumb = page.getByRole('scrollbar')
  const thumbBox = await thumb.boundingBox()
  assert(thumbBox, 'Custom scrollbar thumb is missing')
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2 + 100, { steps: 5 })
  await page.mouse.up()
  assert((await scrollArea.evaluate((element) => element.scrollTop)) > 0, 'Dragging the custom scrollbar did not scroll')

  const first = page.getByRole('button', { name: 'MP4 (H.264)', exact: true }).last()
  const third = page.getByRole('button', { name: 'M4V', exact: true }).first()
  const [areaBox, firstBox, thirdBox] = await Promise.all([
    scrollArea.boundingBox(),
    first.boundingBox(),
    third.boundingBox(),
  ])
  assert(areaBox && firstBox && thirdBox, 'Could not measure format grid alignment')
  const leftGap = firstBox.x - areaBox.x
  const rightGap = areaBox.x + areaBox.width - (thirdBox.x + thirdBox.width)
  assert(Math.abs(leftGap - rightGap) <= 2, `Format columns are off-center: ${leftGap}px vs ${rightGap}px`)

  for (const label of ['H.265 (MP4)', 'MPEG-4 (AVI)']) {
    const fits = await page.getByRole('button', { name: label, exact: true }).evaluate(
      (button) => button.scrollWidth <= button.clientWidth
    )
    assert(fits, `${label} overflows its format button`)
  }
  if (process.env.MENU_SCREENSHOT) {
    await page.screenshot({ path: resolve(process.env.MENU_SCREENSHOT), fullPage: true })
  }
  await page.keyboard.press('Escape')

  await page.goto(baseURL)
  const svgSource = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32">
      <path fill="#7c3aed" d="M4 2h40a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Z"/>
      <circle cx="16" cy="16" r="8" fill="#facc15"/>
    </svg>`
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'vector-icon.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(svgSource),
  })
  await page.getByRole('button', { name: 'JPEG', exact: true }).first().click()
  await page.getByRole('button', { name: 'ICO', exact: true }).first().click()
  await page.getByRole('button', { name: 'Convert', exact: true }).first().click()
  const icoDownloadButton = page.getByRole('button', { name: 'Download', exact: true }).first()
  await icoDownloadButton.waitFor({ state: 'visible', timeout: 120_000 })
  const [icoDownload] = await Promise.all([page.waitForEvent('download'), icoDownloadButton.click()])
  assert(icoDownload.suggestedFilename().endsWith('.ico'), 'SVG conversion did not download an ICO file')
  const icoDownloadPath = await icoDownload.path()
  assert(icoDownloadPath, 'SVG-to-ICO download has no path')
  const icoBytes = readFileSync(icoDownloadPath)
  assert(icoBytes.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0])), 'SVG-to-ICO output has an invalid ICO header')
  const imageOffset = icoBytes.readUInt32LE(18)
  assert(
    icoBytes.subarray(imageOffset, imageOffset + 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    'SVG-to-ICO output does not preserve transparency with an embedded PNG image'
  )

  await page.goto(baseURL)
  await page.locator('input[type="file"]').first().setInputFiles(imagePath)
  await page.getByRole('button', { name: 'JPEG', exact: true }).first().click()
  await page.getByRole('button', { name: 'PNG', exact: true }).first().click()
  await page.getByRole('button', { name: 'Convert', exact: true }).first().click()
  const downloadButton = page.getByRole('button', { name: 'Download', exact: true }).first()
  await downloadButton.waitFor({ state: 'visible' })
  const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()])
  const downloadPath = await download.path()
  assert(downloadPath, 'PNG download has no path')
  assert(readFileSync(downloadPath).equals(readFileSync(imagePath)), '100% PNG output did not preserve original bytes')

  const footerLink = page.getByRole('link', { name: 'sethworks.xyz', exact: true })
  assert(await footerLink.getAttribute('href') === 'https://sethworks.xyz', 'Footer link is incorrect')
  assert(
    await page.locator('footer').evaluate((footer) => getComputedStyle(footer).borderTopWidth === '0px'),
    'Footer divider is still visible'
  )

  if (process.env.SCREENSHOT) {
    await page.screenshot({ path: resolve(process.env.SCREENSHOT), fullPage: true })
  }

  const aboutResponse = await page.goto(`${baseURL}/about/`)
  assert(aboutResponse?.ok(), `Direct About navigation failed: ${aboutResponse?.status()}`)
  assert(
    await page.title() === 'How local browser conversion works | convert.sethworks.xyz',
    `Unexpected About title: ${await page.title()}`
  )
  assert(
    (await page.locator('meta[name="description"]').getAttribute('content'))?.includes('entirely in your browser'),
    'About description metadata is missing'
  )
  await page.getByRole('heading', { name: 'How your files are converted without leaving your device', exact: true }).waitFor()
  assert(await page.locator('article section').count() >= 7, 'About article is missing expected sections')
  const aboutText = await page.locator('article').innerText()
  assert(!aboutText.includes('—'), 'About article still contains an em dash')
  assert(!aboutText.includes('About the converter'), 'Removed About eyebrow is still visible')
  assert(!aboutText.includes('The honest limitations of local conversion'), 'Removed limitations section is still visible')
  assert(!aboutText.includes('Ready to convert something?'), 'Removed conversion callout is still visible')
  assert(await page.getByRole('link', { name: 'Converter', exact: true }).getAttribute('href') === '/', 'About navigation does not return home')
  assert(await page.locator('script[type="application/ld+json"]').count() === 1, 'About structured article data is missing')

  if (process.env.ABOUT_SCREENSHOT) {
    await page.screenshot({ path: resolve(process.env.ABOUT_SCREENSHOT), fullPage: true })
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseURL}/about/`)
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  assert(mobileOverflow <= 1, `About page overflows mobile viewport by ${mobileOverflow}px`)
  if (process.env.ABOUT_MOBILE_SCREENSHOT) {
    await page.screenshot({ path: resolve(process.env.ABOUT_MOBILE_SCREENSHOT), fullPage: true })
  }

  await browser.close()
  console.log('UX regression test passed')
}

run().catch((error) => {
  console.error('UX regression test failed:', error)
  process.exit(1)
})
