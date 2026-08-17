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

function isGzip(buffer: ArrayBuffer) {
  const u8 = new Uint8Array(buffer)
  return u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b
}

async function gunzip(buffer: ArrayBuffer) {
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(new Uint8Array(buffer))
  writer.close()
  return await new Response(ds.readable).arrayBuffer()
}

async function toWasmURL(url: string) {
  const res = await fetch(url)
  let data = await res.arrayBuffer()
  if (isGzip(data)) {
    data = await gunzip(data)
  }
  return URL.createObjectURL(new Blob([data], { type: 'application/wasm' }))
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
    const wasmURL = await toWasmURL(`${base}${WASM_PATH}`)
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
