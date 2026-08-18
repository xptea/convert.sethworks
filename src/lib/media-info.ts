import type { MediaInfo } from '@/components/converter-queue-types'
import type { SupportedFileType } from './file-support'

export async function inspectMediaFile(file: File, type: SupportedFileType): Promise<MediaInfo> {
  const url = URL.createObjectURL(file)

  try {
    if (type === 'image') {
      const image = new Image()
      image.decoding = 'async'
      return await new Promise<MediaInfo>((resolve) => {
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
        image.onerror = () => resolve({})
        image.src = url
      })
    }

    const media = document.createElement(type === 'audio' ? 'audio' : 'video')
    media.preload = 'metadata'
    return await new Promise<MediaInfo>((resolve) => {
      const finish = (info: MediaInfo = {}) => {
        window.clearTimeout(timeout)
        resolve(info)
      }
      const timeout = window.setTimeout(() => finish(), 5000)
      media.onloadedmetadata = () => finish({
        duration: Number.isFinite(media.duration) ? media.duration : undefined,
        width: media instanceof HTMLVideoElement ? media.videoWidth : undefined,
        height: media instanceof HTMLVideoElement ? media.videoHeight : undefined,
      })
      media.onerror = () => finish()
      media.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
