import type { FFmpeg as FFmpegType } from '@ffmpeg/ffmpeg'
import { findVideoDef, getVideoFormatExt, getVideoFormatMime, type VideoFormat } from '@/lib/formats'

export type { VideoFormat }

export interface VideoOptions {
  format: VideoFormat
  quality: number // 1 = small file/high compression, 5 = large file/low compression
}

const CORE_PATH = '/ffmpeg/ffmpeg-core.js'
const WASM_PATH = '/ffmpeg/ffmpeg-core.wasm'

let ffmpeg: FFmpegType | null = null
let loading = false
let loaded = false

function reportProgress(
  onProgress: ((p: number) => void) | undefined,
  start: number,
  size: number
) {
  return ({ received, total }: { received: number; total: number }) => {
    const totalBytes = total > 0 ? total : received || 1
    const ratio = Math.min(1, received / totalBytes)
    onProgress?.(start + ratio * size)
  }
}

export async function initFFmpeg(
  onProgress?: (p: number) => void
): Promise<void> {
  if (loaded && ffmpeg) return
  if (loading) {
    while (loading) {
      await new Promise((r) => setTimeout(r, 50))
    }
    if (loaded && ffmpeg) return
  }

  loading = true
  try {
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/util'),
    ])

    ffmpeg = new FFmpeg()
    const base = location.origin

    const coreURL = await toBlobURL(
      `${base}${CORE_PATH}`,
      'text/javascript',
      true,
      reportProgress(onProgress, 0, 0.15)
    )
    const wasmURL = await toBlobURL(
      `${base}${WASM_PATH}`,
      'application/wasm',
      true,
      reportProgress(onProgress, 0.15, 0.7)
    )

    onProgress?.(0.85)
    await ffmpeg.load({ coreURL, wasmURL })
    loaded = true
    onProgress?.(1)
  } finally {
    loading = false
  }
}

export function isFFmpegLoaded(): boolean {
  return loaded
}

function getSafeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function convertVideo(
  file: File,
  options: VideoOptions,
  onProgress?: (p: number) => void
): Promise<Blob> {
  await initFFmpeg()
  if (!ffmpeg) throw new Error('FFmpeg failed to load')

  const profile = findVideoDef(options.format)
  if (!profile) throw new Error(`Unsupported video format: ${options.format}`)

  const { fetchFile } = await import('@ffmpeg/util')
  const inputName = `input.${getSafeName(file.name).split('.').pop() || 'mp4'}`
  const ext = getVideoFormatExt(options.format)
  const outputName = `output.${ext}`

  ffmpeg.off('progress', () => {})
  const progressHandler = ({ progress }: { progress: number; time: number }) => {
    onProgress?.(Math.max(0, Math.min(1, progress)))
  }
  ffmpeg.on('progress', progressHandler)

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file))

    const args = ['-i', inputName, '-y', ...profile.args(options.quality), outputName]

    const exitCode = await ffmpeg.exec(args)
    if (exitCode !== 0) {
      throw new Error(`FFmpeg exited with code ${exitCode}`)
    }

    const data = await ffmpeg.readFile(outputName)
    const mime = getVideoFormatMime(options.format)
    const buffer = (data as Uint8Array).buffer as ArrayBuffer
    const blob = new Blob([buffer], { type: mime })

    try {
      await ffmpeg.deleteFile(inputName)
      await ffmpeg.deleteFile(outputName)
    } catch {
      // ignore cleanup errors
    }

    return blob
  } finally {
    ffmpeg.off('progress', progressHandler)
  }
}

export function makeVideoFilename(file: File, format: VideoFormat): string {
  const base = file.name.replace(/\.[^.]+$/, '')
  const ext = getVideoFormatExt(format)
  return `${base}-converted.${ext}`
}
