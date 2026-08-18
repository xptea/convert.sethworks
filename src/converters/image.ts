import { findImageDef, getImageFormatExt, type ImageFormat } from '@/lib/formats'
import { initFFmpeg, execFFmpeg, getLastFFmpegError, resetFFmpeg } from './ffmpeg'
import { createProgressReporter, type ConversionProgressCallback } from './progress'

export type { ImageFormat }

export interface ImageOptions {
  format: ImageFormat
  quality: number
}

export { downloadBlob } from '@/lib/download'

// Keep one browser-decodable, lossless raster per source File. This lets a
// specialist input such as TIFF/RAW be decoded once, then reused when the user
// switches between common outputs such as JPEG, WebP, and PNG.
const browserRasterCache = new WeakMap<File, Promise<Blob>>()

class BrowserImageDecodeError extends Error {
  constructor() {
    super('The browser cannot decode this source image directly.')
    this.name = 'BrowserImageDecodeError'
  }
}

async function convertImageCanvas(
  file: Blob,
  options: ImageOptions,
  onProgress?: ConversionProgressCallback
): Promise<Blob> {
  onProgress?.(null, 'Decoding image')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new BrowserImageDecodeError()
  }

  const { width, height } = bitmap
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context')

  onProgress?.(null, 'Rendering image')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const def = findImageDef(options.format)
  const mime = def?.mime ?? `image/${options.format}`
  const quality = mime === 'image/png' ? undefined : Math.max(0.01, Math.min(1, options.quality))

  onProgress?.(null, 'Encoding image')
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`Canvas toBlob returned null for ${mime}`))
          return
        }
        onProgress?.(null, 'Preparing download')
        resolve(blob)
      },
      mime,
      quality
    )
  })
}

function getSafeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function isSvgFile(file: File): boolean {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
}

function isOutOfMemoryError(value: unknown): boolean {
  const message = value instanceof Error ? value.message : String(value)
  return /\bOOM\b|out of memory|memory access out of bounds/i.test(message)
}

function parseSvgLength(value: string | null): number | undefined {
  if (!value || value.trim().endsWith('%')) return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

async function rasterizeSvg(file: File, maxDimension: number, fillMaxDimension = false): Promise<Blob> {
  const source = await file.text()
  const parsedDocument = new DOMParser().parseFromString(source, 'image/svg+xml')
  if (parsedDocument.querySelector('parsererror') || parsedDocument.documentElement.localName !== 'svg') {
    throw new Error('The SVG could not be parsed as a valid image.')
  }

  const svg = parsedDocument.documentElement
  const viewBox = (svg.getAttribute('viewBox') || '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  const viewBoxWidth = viewBox.length === 4 && Number.isFinite(viewBox[2]) && viewBox[2] > 0
    ? viewBox[2]
    : undefined
  const viewBoxHeight = viewBox.length === 4 && Number.isFinite(viewBox[3]) && viewBox[3] > 0
    ? viewBox[3]
    : undefined

  let width = parseSvgLength(svg.getAttribute('width'))
  let height = parseSvgLength(svg.getAttribute('height'))
  const viewBoxRatio = viewBoxWidth && viewBoxHeight ? viewBoxWidth / viewBoxHeight : undefined

  if (!width && height && viewBoxRatio) width = height * viewBoxRatio
  if (!height && width && viewBoxRatio) height = width / viewBoxRatio

  const objectUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('The browser could not render this SVG.'))
      image.src = objectUrl
    })

    width = width || viewBoxWidth || image.naturalWidth || 512
    height = height || viewBoxHeight || image.naturalHeight || 512

    if ((!width || !height) && viewBoxRatio) {
      width = width || height * viewBoxRatio
      height = height || width / viewBoxRatio
    }
    if (!width || !height) {
      width = 512
      height = 512
    }

    const scale = fillMaxDimension
      ? maxDimension / Math.max(width, height)
      : Math.min(1, maxDimension / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create a canvas context for the SVG.')

    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('The browser could not rasterize this SVG.'))
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function convertImageFfmpeg(
  file: File,
  options: ImageOptions,
  onProgress?: ConversionProgressCallback
): Promise<Blob> {
  const def = findImageDef(options.format)
  if (!def) throw new Error(`Unsupported image format: ${options.format}`)

  // This FFmpeg WASM build can identify SVG streams but does not include an SVG
  // decoder. Let the browser render the vector first, then encode those PNG pixels.
  const svgInput = isSvgFile(file)
  onProgress?.(null, svgInput ? 'Rendering SVG' : 'Preparing image')
  const input = svgInput
    ? await rasterizeSvg(file, def.value === 'ico' ? 256 : 4096, def.value === 'ico')
    : file
  const inputExtension = svgInput
    ? 'png'
    : getSafeName(file.name).split('.').pop() || 'png'

  onProgress?.(null, 'Loading converter')
  const ffmpeg = await initFFmpeg()
  onProgress?.(null, 'Copying image into memory')
  const { fetchFile } = await import('@ffmpeg/util')

  const jobId = Math.random().toString(36).slice(2, 10)
  const inputName = `input.${jobId}.${inputExtension}`
  const outputName = `output.${jobId}.${def.ext}`
  let fatalMemoryError = false

  const cleanup = async () => {
    await Promise.allSettled([
      ffmpeg.deleteFile(inputName),
      ffmpeg.deleteFile(outputName),
    ])
  }

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(input))
    onProgress?.(null, 'Encoding image')

    const quality = Math.max(0.01, Math.min(1, options.quality))
    const qscale = Math.round(2 + (1 - quality) * 30) // 2-32 scale for still image codecs

    // A still image has only one frame. Multiple decoder, scaler, and encoder
    // threads create duplicate full-resolution buffers without improving this
    // one-frame job, which can exhaust the core's fixed WASM memory on large
    // TIFF/RAW sources.
    const args = [
      '-threads', '1',
      '-filter_threads', '1',
      '-filter_complex_threads', '1',
      '-i', inputName,
      '-frames:v', '1',
      '-y',
      '-threads', '1',
    ]

    if (def.value === 'jpg') {
      args.push('-qscale:v', String(qscale))
    } else if (def.value === 'webp') {
      args.push('-c:v', 'libwebp', '-q:v', String(Math.round(quality * 100)))
    } else if (def.value === 'png') {
      args.push('-c:v', 'png')
    } else if (def.value === 'bmp') {
      args.push('-c:v', 'bmp')
    } else {
      const codecMap: Record<string, string> = {
        tiff: 'tiff',
        gif: 'gif',
        tga: 'targa',
        ppm: 'ppm',
        pgm: 'pgm',
        pbm: 'pbm',
        xbm: 'xbm',
        pam: 'pam',
        pfm: 'pfm',
        sgi: 'sgi',
        dpx: 'dpx',
        ico: 'png',
        apng: 'apng',
        jp2: 'jpeg2000',
        jls: 'jpegls',
        exr: 'exr',
        qoi: 'qoi',
        pcx: 'pcx',
        fits: 'fits',
        sunras: 'sunrast',
      }
      const codec = codecMap[def.value]
      if (codec) args.push('-c:v', codec)
    }

    if (def.value === 'ico') {
      args.push('-vf', "scale='min(256,iw)':'min(256,ih)':force_original_aspect_ratio=decrease")
    } else if (def.value === 'jp2') {
      args.push('-q:v', String(qscale))
    }

    args.push(outputName)

    const exitCode = await execFFmpeg(args)
    if (exitCode !== 0) {
      const detail = getLastFFmpegError()
      if (isOutOfMemoryError(detail)) fatalMemoryError = true
      throw new Error(`FFmpeg exited with code ${exitCode}: ${detail}`)
    }

    onProgress?.(null, 'Finalizing output')
    const data = await ffmpeg.readFile(outputName)
    onProgress?.(null, 'Preparing download')
    const buffer = (data as Uint8Array).buffer as ArrayBuffer
    return new Blob([buffer], { type: def.mime })
  } catch (error) {
    const detail = getLastFFmpegError()
    if (isOutOfMemoryError(error) || isOutOfMemoryError(detail)) {
      fatalMemoryError = true
      throw new Error(
        'This image exceeded the browser converter memory limit. Close other large conversions and try again, or resize the source image first.'
      )
    }
    throw error
  } finally {
    await cleanup()
    if (fatalMemoryError) resetFFmpeg()
  }
}

function getBrowserRaster(
  file: File,
  onProgress?: ConversionProgressCallback
): Promise<Blob> {
  const cached = browserRasterCache.get(file)
  if (cached) {
    onProgress?.(null, 'Reusing decoded image')
    return cached
  }

  onProgress?.(null, 'Decoding source image')
  const raster = convertImageFfmpeg(file, { format: 'png', quality: 1 }, onProgress)
  browserRasterCache.set(file, raster)
  void raster.catch(() => {
    if (browserRasterCache.get(file) === raster) browserRasterCache.delete(file)
  })
  return raster
}

export async function convertImage(
  file: File,
  options: ImageOptions,
  onProgress?: ConversionProgressCallback
): Promise<Blob> {
  const report = createProgressReporter(onProgress)
  report(null, 'Preparing image')
  const def = findImageDef(options.format)
  if (!def) throw new Error(`Unsupported image format: ${options.format}`)

  const inputExt = file.name.split('.').pop()?.toLowerCase()
  if (options.format === 'png' && inputExt === 'png' && options.quality >= 0.999) {
    // PNG is lossless, so decoding and encoding it again cannot improve quality.
    // Preserve the original compressed bytes at 100% to avoid needless file growth.
    report(null, 'Preparing download')
    return file
  }

  if (def.engine === 'canvas') {
    try {
      return await convertImageCanvas(file, options, report)
    } catch (error) {
      if (!(error instanceof BrowserImageDecodeError)) {
        return convertImageFfmpeg(file, options, report)
      }
      // Canvas cannot directly decode TIFF/RAW/ICO and similar inputs. Decode
      // that source once with FFmpeg, cache a lossless PNG raster, and let the
      // browser's native encoder handle common output formats and later retries.
      const raster = await getBrowserRaster(file, report)
      if (options.format === 'png') {
        report(null, 'Preparing download')
        return raster
      }
      try {
        return await convertImageCanvas(raster, options, report)
      } catch {
        return convertImageFfmpeg(file, options, report)
      }
    }
  }
  return convertImageFfmpeg(file, options, report)
}

export function makeImageFilename(file: File, format: ImageFormat): string {
  const base = file.name.replace(/\.[^.]+$/, '')
  const ext = getImageFormatExt(format)
  return `${base}-converted.${ext}`
}
