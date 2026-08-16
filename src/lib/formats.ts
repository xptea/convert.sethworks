export type ImageFormat = 'image/png' | 'image/jpeg' | 'image/webp'

export interface ImageOutputDef {
  value: ImageFormat
  label: string
  ext: string
}

export const IMAGE_OUTPUTS: ImageOutputDef[] = [
  { value: 'image/png', label: 'PNG', ext: 'png' },
  { value: 'image/jpeg', label: 'JPEG', ext: 'jpg' },
  { value: 'image/webp', label: 'WebP', ext: 'webp' },
]

export type VideoFormat = string

export interface VideoOutputDef {
  value: string
  label: string
  ext: string
  mime: string
  /** FFmpeg args placed between input and output name. */
  args: (quality: number) => string[]
}

function x264Aac(quality: number) {
  const crf = Math.max(18, 35 - (quality - 1) * 4)
  return [
    '-c:v', 'libx264',
    '-crf', String(crf),
    '-preset', 'fast',
    '-c:a', 'aac',
    '-movflags', '+faststart',
  ]
}

function x265Aac(quality: number) {
  const crf = Math.max(18, 35 - (quality - 1) * 4)
  return [
    '-c:v', 'libx265',
    '-crf', String(crf),
    '-preset', 'fast',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    '-tag:v', 'hvc1',
  ]
}

function vp9Opus(quality: number) {
  const crf = Math.max(18, 63 - (quality - 1) * 4)
  return [
    '-c:v', 'libvpx-vp9',
    '-crf', String(crf),
    '-b:v', '0',
    '-cpu-used', '4',
    '-row-mt', '1',
    '-c:a', 'libopus',
  ]
}

function vp8Vorbis(quality: number) {
  const crf = Math.max(18, 35 - (quality - 1) * 4)
  return ['-c:v', 'libvpx', '-crf', String(crf), '-b:v', '0', '-c:a', 'libvorbis']
}

function theoraVorbis(_quality: number) {
  return ['-c:v', 'libtheora', '-q:v', '6', '-c:a', 'libvorbis', '-q:a', '4']
}

export const VIDEO_OUTPUTS: VideoOutputDef[] = [
  { value: 'mp4', label: 'MP4 (H.264)', ext: 'mp4', mime: 'video/mp4', args: x264Aac },
  { value: 'mp4-h265', label: 'MP4 (H.265)', ext: 'mp4', mime: 'video/mp4', args: x265Aac },
  { value: 'mov', label: 'MOV', ext: 'mov', mime: 'video/quicktime', args: x264Aac },
  { value: 'm4v', label: 'M4V', ext: 'm4v', mime: 'video/x-m4v', args: x264Aac },
  { value: 'mkv', label: 'MKV', ext: 'mkv', mime: 'video/x-matroska', args: x264Aac },
  { value: 'avi', label: 'AVI', ext: 'avi', mime: 'video/x-msvideo', args: x264Aac },
  { value: 'webm', label: 'WebM (VP9)', ext: 'webm', mime: 'video/webm', args: vp9Opus },
  { value: 'webm-vp8', label: 'WebM (VP8)', ext: 'webm', mime: 'video/webm', args: vp8Vorbis },
  { value: 'flv', label: 'FLV', ext: 'flv', mime: 'video/x-flv', args: x264Aac },
  { value: 'ogv', label: 'OGV (Theora)', ext: 'ogv', mime: 'video/ogg', args: theoraVorbis },
  { value: '3gp', label: '3GP', ext: '3gp', mime: 'video/3gpp', args: x264Aac },
  { value: 'mpeg', label: 'MPEG-1', ext: 'mpeg', mime: 'video/mpeg', args: (q) => ['-c:v', 'mpeg1video', '-qscale:v', String(Math.max(2, 6 - q)), '-c:a', 'mp2'] },
  { value: 'mpeg2', label: 'MPEG-2', ext: 'mpg', mime: 'video/mpeg', args: (q) => ['-c:v', 'mpeg2video', '-qscale:v', String(Math.max(2, 6 - q)), '-c:a', 'mp2'] },
  { value: 'asf', label: 'ASF (WMV)', ext: 'asf', mime: 'video/x-ms-asf', args: () => ['-c:v', 'wmv2', '-c:a', 'wmav2'] },
  { value: 'gif', label: 'GIF', ext: 'gif', mime: 'image/gif', args: () => [
    '-vf', 'fps=10,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer',
    '-loop', '0',
  ]},
  { value: 'mp3', label: 'MP3 (audio)', ext: 'mp3', mime: 'audio/mpeg', args: () => ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'] },
  { value: 'wav', label: 'WAV (audio)', ext: 'wav', mime: 'audio/wav', args: () => ['-vn', '-c:a', 'pcm_s16le'] },
  { value: 'ogg', label: 'OGG Vorbis (audio)', ext: 'ogg', mime: 'audio/ogg', args: () => ['-vn', '-c:a', 'libvorbis', '-q:a', '4'] },
  { value: 'opus', label: 'Opus (audio)', ext: 'opus', mime: 'audio/opus', args: () => ['-vn', '-c:a', 'libopus', '-b:a', '128k'] },
  { value: 'flac', label: 'FLAC (audio)', ext: 'flac', mime: 'audio/flac', args: () => ['-vn', '-c:a', 'flac'] },
]

export function findImageDef(value: ImageFormat) {
  return IMAGE_OUTPUTS.find((o) => o.value === value)
}

export function findVideoDef(value: string) {
  return VIDEO_OUTPUTS.find((o) => o.value === value)
}

export function getImageFormatLabel(value: ImageFormat) {
  return findImageDef(value)?.label ?? value
}

export function getVideoFormatLabel(value: string) {
  return findVideoDef(value)?.label ?? value
}

export function getVideoFormatMime(value: string) {
  return findVideoDef(value)?.mime ?? 'application/octet-stream'
}

export function getVideoFormatExt(value: string) {
  return findVideoDef(value)?.ext ?? value
}
