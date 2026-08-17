import type { FFmpeg as FFmpegType } from '@ffmpeg/ffmpeg'

const CORE_PATH = '/ffmpeg/ffmpeg-core.js'
const WASM_PATH = '/ffmpeg/ffmpeg-core.wasm'
const WORKER_PATH = '/ffmpeg/ffmpeg-core.worker.js'

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
  if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
    throw new Error(
      'Multithreaded FFmpeg requires cross-origin isolation (COOP/COEP headers) and SharedArrayBuffer support.'
    )
  }
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

    const [coreURL, wasmURL, workerURL] = await Promise.all([
      toBlobURL(
        `${base}${CORE_PATH}`,
        'text/javascript',
        true,
        reportProgress(onProgress, 0, 0.15)
      ),
      toWasmURL(`${base}${WASM_PATH}`),
      toBlobURL(`${base}${WORKER_PATH}`, 'text/javascript'),
    ])
    onProgress?.(0.85)

    await ffmpeg.load({ coreURL, wasmURL, workerURL })
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

interface ExecJob {
  args: string[]
  onProgress?: (p: number) => void
  resolve: (code: number) => void
  reject: (err: unknown) => void
}

let execQueue: ExecJob[] = []
let execRunning = false
let lastExecLog: string[] = []

async function runNextExec() {
  if (execRunning || execQueue.length === 0 || !ffmpeg) return
  execRunning = true
  const job = execQueue.shift()!
  const logLines: string[] = []
  try {
    const logHandler = ({ message }: { message: string }) => {
      logLines.push(message)
      if (logLines.length > 30) logLines.shift()
    }
    const handler = job.onProgress
      ? ({ progress }: { progress: number; time: number }) => {
          job.onProgress?.(Math.max(0, Math.min(1, progress)))
        }
      : null
    ffmpeg.on('log', logHandler)
    if (handler) ffmpeg.on('progress', handler)
    try {
      const code = await ffmpeg.exec(job.args)
      lastExecLog = logLines
      job.resolve(code)
    } finally {
      ffmpeg.off('log', logHandler)
      if (handler) ffmpeg.off('progress', handler)
    }
  } catch (err) {
    lastExecLog = logLines
    job.reject(err)
  } finally {
    execRunning = false
    runNextExec()
  }
}

export async function execFFmpeg(args: string[], onProgress?: (p: number) => void): Promise<number> {
  await initFFmpeg()
  return new Promise((resolve, reject) => {
    execQueue.push({ args, onProgress, resolve, reject })
    runNextExec()
  })
}

export function isFFmpegLoaded(): boolean {
  return loaded
}

export function getLastFFmpegError(): string {
  return lastExecLog.slice(-8).join('\n')
}
