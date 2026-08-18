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

async function toWasmBlob(url: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`)
  }
  let data = await res.arrayBuffer()
  if (isGzip(data)) {
    data = await gunzip(data)
  }
  return new Blob([data], { type: 'application/wasm' })
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

    const [coreURL, wasmBlob, workerURL] = await Promise.all([
      toBlobURL(
        `${base}${CORE_PATH}`,
        'text/javascript',
        true,
        reportProgress(onProgress, 0, 0.15)
      ),
      toWasmBlob(`${base}${WASM_PATH}`),
      toBlobURL(`${base}${WORKER_PATH}`, 'text/javascript'),
    ])
    const wasmURL = URL.createObjectURL(wasmBlob)
    onProgress?.(0.85)

    try {
      await ffmpeg.load({ coreURL, wasmURL, workerURL })
    } finally {
      setTimeout(() => URL.revokeObjectURL(wasmURL), 0)
    }
    loaded = true
    onProgress?.(1)
    return ffmpeg
  } finally {
    loading = false
  }
}

function getFFmpeg(): FFmpegType | null {
  return ffmpeg
}

export function resetFFmpeg() {
  try {
    ffmpeg?.terminate()
  } catch {
    // The worker may already be terminated after a fatal WASM error.
  }
  ffmpeg = null
  loaded = false
  loading = false
  execRunning = false
  lastExecLog = []
  const error = new Error('FFmpeg was restarted after a fatal conversion error.')
  for (const job of execQueue.splice(0)) job.reject(error)
}

interface ExecJob {
  kind: 'exec' | 'ffprobe'
  args: string[]
  onProgress?: (event: FFmpegProgress) => void
  resolve: (result: ExecResult) => void
  reject: (err: unknown) => void
}

interface ExecResult {
  code: number
  logLines: string[]
}

export interface FFmpegProgress {
  progress: number
  time: number
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
    const handler = job.kind === 'exec' && job.onProgress
      ? ({ progress, time }: FFmpegProgress) => {
          job.onProgress?.({
            progress: Math.max(0, Math.min(1, progress)),
            time: Math.max(0, time),
          })
        }
      : null
    ffmpeg.on('log', logHandler)
    if (handler) ffmpeg.on('progress', handler)
    try {
      const code = job.kind === 'exec'
        ? await ffmpeg.exec(job.args)
        : await ffmpeg.ffprobe(job.args)
      lastExecLog = logLines
      job.resolve({ code, logLines })
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

async function queueFFmpeg(
  kind: 'exec' | 'ffprobe',
  args: string[],
  onProgress?: (event: FFmpegProgress) => void
): Promise<ExecResult> {
  await initFFmpeg()
  return new Promise((resolve, reject) => {
    execQueue.push({ kind, args, onProgress, resolve, reject })
    runNextExec()
  })
}

export async function execFFmpeg(
  args: string[],
  onProgress?: (event: FFmpegProgress) => void
): Promise<number> {
  return (await queueFFmpeg('exec', args, onProgress)).code
}

export async function getMediaDuration(inputName: string): Promise<number | undefined> {
  const instance = await initFFmpeg()
  const outputName = `duration.${Math.random().toString(36).slice(2, 10)}.txt`

  try {
    const { code, logLines } = await queueFFmpeg('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputName,
      '-o', outputName,
    ])
    if (code !== 0) return undefined

    const data = await instance.readFile(outputName)
    const text = typeof data === 'string' ? data : new TextDecoder().decode(data as Uint8Array)
    const durationFromFile = Number.parseFloat(text.trim())
    const durationFromLog = Number.parseFloat(logLines
      .map((line) => line.trim())
      .find((line) => /^\d+(?:\.\d+)?$/.test(line)) ?? '')
    const duration = Number.isFinite(durationFromFile) ? durationFromFile : durationFromLog
    return Number.isFinite(duration) && duration > 0 ? duration : undefined
  } catch {
    return undefined
  } finally {
    try {
      await instance.deleteFile(outputName)
    } catch {
      // Ignore a missing ffprobe output file.
    }
  }
}

function isFFmpegLoaded(): boolean {
  return loaded
}

export function getLastFFmpegError(): string {
  return lastExecLog.slice(-8).join('\n')
}
