import { chromium } from 'playwright'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const baseURL = process.env.BASE_URL || 'http://localhost:4173'

function makeWav(path) {
  if (existsSync(path)) return
  const sampleRate = 44100
  const seconds = 1
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * bitsPerSample / 8
  const blockAlign = numChannels * bitsPerSample / 8
  const dataSize = sampleRate * seconds * numChannels * bitsPerSample / 8

  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  // leave PCM data as zeros (silence)
  writeFileSync(path, buffer)
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()

  page.on('console', (msg) => console.log('PAGE CONSOLE:', msg.type(), msg.text()))
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message))

  console.log('Opening', baseURL)
  await page.goto(baseURL)

  const wav = resolve('public/silence.wav')
  makeWav(wav)

  await page.locator('input[type="file"]').first().setInputFiles([wav])
  await page.waitForSelector('text=Convert all')
  console.log('Audio file added')

  // Open format picker (currently MP3) and select FLAC.
  await page.getByRole('button', { name: 'MP3' }).first().click()
  await page.getByRole('button', { name: 'FLAC' }).click()
  console.log('Selected FLAC')

  await page.getByRole('button', { name: 'Convert' }).first().click()

  for (let i = 0; i < 300; i++) {
    const c = await page.getByRole('button', { name: 'Download' }).count()
    if (c >= 1) break
    await page.waitForTimeout(500)
  }
  console.log('Audio conversion finished')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).first().click(),
  ])

  const path = await download.path()
  const buffer = readFileSync(path)
  console.log('Downloaded audio:', buffer.length, 'bytes')
  if (buffer.length < 100) throw new Error('Audio output too small')

  await browser.close()
}

;(async () => {
  try {
    await run()
    console.log('Audio test passed')
    process.exit(0)
  } catch (e) {
    console.error('Audio test failed:', e)
    process.exit(1)
  }
})()
