import { findImageDef, getImageFormatExt, type ImageFormat } from '@/lib/formats'
import { initFFmpeg, execFFmpeg, getLastFFmpegError } from './ffmpeg'

export type { ImageFormat }

export interface ImageOptions {
  format: ImageFormat
  quality: number
}

export { downloadBlob } from '@/lib/download'

async function convertImageCanvas(file: File, options: ImageOptions): Promise<Blob> {
  const bitmap = await createImageBitmap(file)

  const { width, height } = bitmap
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context')

  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const def = findImageDef(options.format)
  const mime = def?.mime ?? `image/${options.format}`
  const quality = mime === 'image/png' ? undefined : Math.max(0.01, Math.min(1, options.quality))

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`Canvas toBlob returned null for ${mime}`))
          return
        }
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

async function convertImageFfmpeg(file: File, options: ImageOptions): Promise<Blob> {
  const def = findImageDef(options.format)
  if (!def) throw new Error(`Unsupported image format: ${options.format}`)

  // This FFmpeg WASM build can identify SVG streams but does not include an SVG
  // decoder. Let the browser render the vector first, then encode those PNG pixels.
  const svgInput = isSvgFile(file)
  const input = svgInput
    ? await rasterizeSvg(file, def.value === 'ico' ? 256 : 4096, def.value === 'ico')
    : file
  const inputExtension = svgInput
    ? 'png'
    : getSafeName(file.name).split('.').pop() || 'png'

  const ffmpeg = await initFFmpeg()
  const threadCount = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2))
  const { fetchFile } = await import('@ffmpeg/util')

  const jobId = Math.random().toString(36).slice(2, 10)
  const inputName = `input.${jobId}.${inputExtension}`
  const outputName = `output.${jobId}.${def.ext}`

  await ffmpeg.writeFile(inputName, await fetchFile(input))

  const quality = Math.max(0.01, Math.min(1, options.quality))
  const qscale = Math.round(2 + (1 - quality) * 30) // 2-32 scale for still image codecs

  const args = [
    '-threads', String(threadCount),
    '-i', inputName,
    '-y',
    '-threads', String(threadCount),
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
    throw new Error(`FFmpeg exited with code ${exitCode}: ${getLastFFmpegError()}`)
  }

  const data = await ffmpeg.readFile(outputName)
  const buffer = (data as Uint8Array).buffer as ArrayBuffer
  const blob = new Blob([buffer], { type: def.mime })

  try {
    await ffmpeg.deleteFile(inputName)
    await ffmpeg.deleteFile(outputName)
  } catch {
    // ignore cleanup errors
  }

  return blob
}

export async function convertImage(file: File, options: ImageOptions): Promise<Blob> {
  const def = findImageDef(options.format)
  if (!def) throw new Error(`Unsupported image format: ${options.format}`)

  const inputExt = file.name.split('.').pop()?.toLowerCase()
  if (options.format === 'png' && inputExt === 'png' && options.quality >= 0.999) {
    // PNG is lossless, so decoding and encoding it again cannot improve quality.
    // Preserve the original compressed bytes at 100% to avoid needless file growth.
    return file
  }

  if (def.engine === 'canvas') {
    try {
      return await convertImageCanvas(file, options)
    } catch {
      // Canvas can only decode PNG/JPEG/WebP/etc. Fallback to ffmpeg for TIFF/ICO/etc.
      return convertImageFfmpeg(file, options)
    }
  }
  return convertImageFfmpeg(file, options)
}

export function makeImageFilename(file: File, format: ImageFormat): string {
  const base = file.name.replace(/\.[^.]+$/, '')
  const ext = getImageFormatExt(format)
  return `${base}-converted.${ext}`
}
