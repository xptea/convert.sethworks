export type ImageFormat = 'image/png' | 'image/jpeg' | 'image/webp'

export interface ImageOptions {
  format: ImageFormat
  quality: number
}

function getExtension(format: ImageFormat): string {
  switch (format) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
  }
}

export { downloadBlob } from '@/lib/download'

export async function convertImage(
  file: File,
  options: ImageOptions
): Promise<Blob> {
  const bitmap = await createImageBitmap(file)

  const { width, height } = bitmap

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context')

  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const mime = options.format
  const quality =
    mime === 'image/png' ? undefined : Math.max(0.01, Math.min(1, options.quality))

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

export function makeImageFilename(file: File, format: ImageFormat): string {
  const base = file.name.replace(/\.[^.]+$/, '')
  return `${base}-converted.${getExtension(format)}`
}
