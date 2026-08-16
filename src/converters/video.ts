import type { FFmpeg as FFmpegType } from '@ffmpeg/ffmpeg'

export type VideoFormat = 'mp4' | 'webm'

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
    // Wait until another caller finishes loading.
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
  // Keep ASCII to avoid FS issues.
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function convertVideo(
  file: File,
  options: VideoOptions,
  onProgress?: (p: number) => void
): Promise<Blob> {
  await initFFmpeg()
  if (!ffmpeg) throw new Error('FFmpeg failed to load')

  const { fetchFile } = await import('@ffmpeg/util')
  const inputName = `input.${getSafeName(file.name).split('.').pop() || 'mp4'}`
  const outputName = `output.${options.format}`

  ffmpeg.off('progress', () => {})
  const progressHandler = ({ progress }: { progress: number; time: number }) => {
    onProgress?.(Math.max(0, Math.min(1, progress)))
  }
  ffmpeg.on('progress', progressHandler)

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file))

    const crf = Math.max(18, 35 - (options.quality - 1) * 4)
    const args = ['-i', inputName, '-y']

    if (options.format === 'mp4') {
      args.push(
        '-c:v',
        'libx264',
        '-crf',
        String(crf),
        '-preset',
        'fast',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        outputName
      )
    } else {
      // webm — use VP9 for quality but with reasonable single-thread settings.
      args.push(
        '-c:v',
        'libvpx-vp9',
        '-crf',
        String(Math.min(63, crf + 10)),
        '-b:v',
        '0',
        '-cpu-used',
        '4',
        '-row-mt',
        '1',
        '-c:a',
        'libopus',
        outputName
      )
    }

    const exitCode = await ffmpeg.exec(args)
    if (exitCode !== 0) {
      throw new Error(`FFmpeg exited with code ${exitCode}`)
    }

    const data = await ffmpeg.readFile(outputName)
    const mime = options.format === 'mp4' ? 'video/mp4' : 'video/webm'
    const buffer = (data as Uint8Array).buffer as ArrayBuffer
    const blob = new Blob([buffer], { type: mime })

    // Clean up virtual FS.
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
  return `${base}-converted.${format}`
}
