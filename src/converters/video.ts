import { findVideoDef, getVideoFormatExt, getVideoFormatMime, type VideoFormat } from '@/lib/formats'
import { initFFmpeg, execFFmpeg } from './ffmpeg'

export type { VideoFormat }

export interface VideoOptions {
  format: VideoFormat
  quality: number // 0..1, where 0 = small file/high compression, 1 = large file/low compression
}

function qualityToLevel(quality: number): number {
  // 0..1 → 1..5
  return Math.max(1, Math.min(5, Math.round(quality * 4 + 1)))
}

function getSafeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function convertVideo(
  file: File,
  options: VideoOptions,
  onProgress?: (p: number) => void
): Promise<Blob> {
  const ffmpeg = await initFFmpeg()

  const profile = findVideoDef(options.format)
  if (!profile) throw new Error(`Unsupported video format: ${options.format}`)

  const { fetchFile } = await import('@ffmpeg/util')
  const jobId = Math.random().toString(36).slice(2, 10)
  const inputName = `input.${jobId}.${getSafeName(file.name).split('.').pop() || 'mp4'}`
  const ext = getVideoFormatExt(options.format)
  const outputName = `output.${jobId}.${ext}`

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file))

    // Fast path: same-codec remuxing for compatible containers (e.g. MP4 → MOV).
    if (profile.copyable) {
      const copyArgs = ['-i', inputName, '-c', 'copy', '-movflags', '+faststart', '-y', outputName]
      const copyCode = await execFFmpeg(copyArgs, onProgress)
      if (copyCode === 0) {
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

        onProgress?.(1)
        return blob
      }
      // Copy failed (incompatible codec), fall through to re-encode.
    }

    const args = ['-i', inputName, '-y', ...profile.args(qualityToLevel(options.quality)), outputName]

    const exitCode = await execFFmpeg(args, onProgress)
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
    onProgress?.(0)
  }
}

export function makeVideoFilename(file: File, format: VideoFormat): string {
  const base = file.name.replace(/\.[^.]+$/, '')
  const ext = getVideoFormatExt(format)
  return `${base}-converted.${ext}`
}
