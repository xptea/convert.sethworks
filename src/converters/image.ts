import { findImageDef, getImageFormatExt, type ImageFormat } from '@/lib/formats'
import { initFFmpeg } from './ffmpeg'

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

async function convertImageFfmpeg(file: File, options: ImageOptions): Promise<Blob> {
  const ffmpeg = await initFFmpeg()
  const { fetchFile } = await import('@ffmpeg/util')

  const def = findImageDef(options.format)
  if (!def) throw new Error(`Unsupported image format: ${options.format}`)

  const inputName = `input.${getSafeName(file.name).split('.').pop() || 'png'}`
  const outputName = `output.${def.ext}`

  await ffmpeg.writeFile(inputName, await fetchFile(file))

  const quality = Math.max(0.01, Math.min(1, options.quality))
  const qscale = Math.round(2 + (1 - quality) * 30) // 2-32 scale for still image codecs

  const args = ['-i', inputName, '-y']

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
      ico: 'ico',
      ppm: 'ppm',
      pgm: 'pgm',
      pbm: 'pbm',
      xpm: 'xpm',
      xbm: 'xbm',
      pam: 'pam',
      pfm: 'pfm',
      sgi: 'sgi',
      dpx: 'dpx',
    }
    const codec = codecMap[def.value]
    if (codec) args.push('-c:v', codec)
  }

  args.push(outputName)

  const exitCode = await ffmpeg.exec(args)
  if (exitCode !== 0) {
    throw new Error(`FFmpeg exited with code ${exitCode}`)
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
