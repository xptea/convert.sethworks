import { findVideoDef, getVideoFormatExt, getVideoFormatMime, type VideoFormat } from '@/lib/formats'
import {
  initFFmpeg,
  execFFmpeg,
  getLastFFmpegError,
  getMediaDuration,
  resetFFmpeg,
  type FFmpegProgress,
} from './ffmpeg'
import { createProgressReporter, type ConversionProgressCallback } from './progress'

export type { VideoFormat }

export interface VideoOptions {
  format: VideoFormat
  quality: number // 0..1, where 0 = small file/high compression, 1 = large file/low compression
  gif?: GifOptions
}

export type GifDither = 'sierra2_4a' | 'bayer' | 'none'

export interface GifOptions {
  width: number | 'original'
  fps: number
  colors: number
  dither: GifDither
  loop: boolean
}

export const DEFAULT_GIF_OPTIONS: GifOptions = {
  width: 640,
  fps: 15,
  colors: 256,
  dither: 'sierra2_4a',
  loop: true,
}

function qualityToLevel(quality: number): number {
  // 0..1 → 1..5
  return Math.max(1, Math.min(5, Math.round(quality * 4 + 1)))
}

function getSafeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function getBrowserMediaDuration(file: File): Promise<number | undefined> {
  const media = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video')
  const objectUrl = URL.createObjectURL(file)
  media.preload = 'metadata'

  try {
    return await new Promise<number | undefined>((resolve) => {
      const finish = (duration?: number) => {
        window.clearTimeout(timeout)
        resolve(duration)
      }
      const timeout = window.setTimeout(() => finish(), 5000)
      media.onloadedmetadata = () => {
        const duration = media.duration
        finish(Number.isFinite(duration) && duration > 0 ? duration : undefined)
      }
      media.onerror = () => finish()
      media.src = objectUrl
    })
  } finally {
    media.removeAttribute('src')
    media.load()
    URL.revokeObjectURL(objectUrl)
  }
}

function normalizedGifSettings(options?: GifOptions) {
  const settings = { ...DEFAULT_GIF_OPTIONS, ...options }
  const fps = Math.max(1, Math.min(50, Math.round(settings.fps)))
  const colors = Math.max(2, Math.min(256, Math.round(settings.colors)))
  const dither: GifDither = ['sierra2_4a', 'bayer', 'none'].includes(settings.dither)
    ? settings.dither
    : DEFAULT_GIF_OPTIONS.dither
  const filters = [`fps=${fps}`]

  if (settings.width !== 'original') {
    const width = Math.max(64, Math.min(1920, Math.round(settings.width)))
    filters.push(`scale='min(${width},iw)':-1:flags=lanczos`)
  }

  return {
    frameFilter: filters.join(','),
    colors,
    dither,
    loop: settings.loop,
  }
}

export async function convertVideo(
  file: File,
  options: VideoOptions,
  onProgress?: ConversionProgressCallback
): Promise<Blob> {
  const report = createProgressReporter(onProgress)
  const browserDuration = getBrowserMediaDuration(file)
  report(null, 'Loading converter')
  const ffmpeg = await initFFmpeg()
  report(null, 'Preparing file')
  const threadCount = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2))

  const profile = findVideoDef(options.format)
  if (!profile) throw new Error(`Unsupported video format: ${options.format}`)

  const { fetchFile } = await import('@ffmpeg/util')
  const jobId = Math.random().toString(36).slice(2, 10)
  const inputName = `input.${jobId}.${getSafeName(file.name).split('.').pop() || 'mp4'}`
  const ext = getVideoFormatExt(options.format)
  const outputName = `output.${jobId}.${ext}`
  const cleanup = async () => {
    await Promise.allSettled([
      ffmpeg.deleteFile(inputName),
      ffmpeg.deleteFile(outputName),
    ])
  }

  try {
    report(null, 'Copying file into memory')
    await ffmpeg.writeFile(inputName, await fetchFile(file))
    report(null, 'Analyzing media')
    const duration = await browserDuration ?? await getMediaDuration(inputName)
    let encodingStarted = false

    const trackEncoding = (event: FFmpegProgress, stage: string) => {
      const processedSeconds = event.time / 1_000_000
      if (duration && processedSeconds > 0) {
        const ratio = processedSeconds / duration
        // A reused ffmpeg.wasm worker can emit the previous job's final event
        // before the next job's timestamps begin. Do not let that stale 100%
        // pin the new job's monotonic progress reporter at completion.
        if (!encodingStarted && ratio >= 0.999) {
          report(null, 'Starting encoder')
          return
        }
        encodingStarted = true
        report(ratio, stage, {
          processedSeconds: Math.min(processedSeconds, duration),
          totalSeconds: duration,
        })
      } else {
        report(null, stage)
      }
    }

    // Fast path: same-codec remuxing for compatible containers (e.g. MP4 → MOV).
    if (profile.copyable) {
      report(null, 'Trying fast conversion')
      const copyArgs = ['-i', inputName, '-c', 'copy', '-movflags', '+faststart', '-y', outputName]
      const copyCode = await execFFmpeg(copyArgs)
      if (copyCode === 0) {
        report(null, 'Finalizing output')
        const data = await ffmpeg.readFile(outputName)
        report(null, 'Preparing download')
        const mime = getVideoFormatMime(options.format)
        const buffer = (data as Uint8Array).buffer as ArrayBuffer
        const blob = new Blob([buffer], { type: mime })

        await cleanup()

        return blob
      }
      // Copy failed (incompatible codec), fall through to re-encode.
    }

    let exitCode: number
    try {
      if (options.format === 'gif') {
        const gif = normalizedGifSettings(options.gif)
        const filter = [
          `${gif.frameFilter},split[palette_source][frames]`,
          `[palette_source]palettegen=max_colors=${gif.colors}:stats_mode=single[palette]`,
          `[frames][palette]paletteuse=dither=${gif.dither}:diff_mode=rectangle:new=1`,
        ].join(';')
        exitCode = await execFFmpeg([
          '-threads', String(threadCount),
          '-i', inputName,
          '-an',
          '-vf', filter,
          '-loop', gif.loop ? '0' : '-1',
          '-threads', String(threadCount),
          '-y',
          outputName,
        ], (event) => trackEncoding(event, 'Encoding GIF'))
      } else {
        exitCode = await execFFmpeg([
          '-threads', String(threadCount),
          '-i', inputName,
          '-y',
          '-threads', String(threadCount),
          ...profile.args(qualityToLevel(options.quality)),
          outputName,
        ], (event) => trackEncoding(event, 'Encoding media'))
      }
    } catch (error) {
      const detail = getLastFFmpegError()
      const message = error instanceof Error ? error.message : String(error)
      if (/\bOOM\b|out of memory/i.test(`${message}\n${detail}`)) {
        resetFFmpeg()
        throw new Error(
          'GIF conversion exceeded the browser memory limit. Try a lower GIF resolution or FPS, or use a shorter source file.'
        )
      }
      throw new Error(detail && !message.includes(detail) ? `${message}: ${detail}` : message)
    }
    if (exitCode !== 0) {
      const detail = getLastFFmpegError()
      if (/\bOOM\b|out of memory/i.test(detail)) {
        resetFFmpeg()
        throw new Error(
          'GIF conversion exceeded the browser memory limit. Try a lower GIF resolution or FPS, or use a shorter source file.'
        )
      }
      throw new Error(`FFmpeg exited with code ${exitCode}: ${detail}`)
    }

    report(null, 'Finalizing output')
    const data = await ffmpeg.readFile(outputName)
    report(null, 'Preparing download')
    const mime = getVideoFormatMime(options.format)
    const buffer = (data as Uint8Array).buffer as ArrayBuffer
    const blob = new Blob([buffer], { type: mime })

    await cleanup()

    return blob
  } finally {
    await cleanup()
  }
}

export function makeVideoFilename(file: File, format: VideoFormat): string {
  const base = file.name.replace(/\.[^.]+$/, '')
  const ext = getVideoFormatExt(format)
  return `${base}-converted.${ext}`
}
