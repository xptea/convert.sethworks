import type { FFmpeg as FFmpegType } from '@ffmpeg/ffmpeg'

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
): Promise<FFmpegType> {
  if (loaded && ffmpeg) return ffmpeg
  if (loading) {
    while (loading) {
      await new Promise((r) => setTimeout(r, 50))
    }
    if (loaded && ffmpeg) return ffmpeg
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
    return ffmpeg
  } finally {
    loading = false
  }
}

export function getFFmpeg(): FFmpegType | null {
  return ffmpeg
}

export function isFFmpegLoaded(): boolean {
  return loaded
}
