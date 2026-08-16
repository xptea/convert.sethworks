export type ImageFormat =
  | 'png'
  | 'jpg'
  | 'webp'
  | 'bmp'
  | 'gif'
  | 'tiff'
  | 'tga'
  | 'ico'
  | 'ppm'
  | 'pgm'
  | 'pbm'
  | 'xpm'
  | 'xbm'
  | 'pam'
  | 'pfm'
  | 'sgi'
  | 'sun'
  | 'ras'
  | 'iff'
  | 'dpx'

export interface ImageOutputDef {
  value: ImageFormat
  label: string
  ext: string
  mime: string
  /** 'canvas' for fast browser encode, 'ffmpeg' for everything else. */
  engine: 'canvas' | 'ffmpeg'
}

export const IMAGE_OUTPUTS: ImageOutputDef[] = [
  { value: 'png', label: 'PNG', ext: 'png', mime: 'image/png', engine: 'canvas' },
  { value: 'jpg', label: 'JPEG', ext: 'jpg', mime: 'image/jpeg', engine: 'canvas' },
  { value: 'webp', label: 'WebP', ext: 'webp', mime: 'image/webp', engine: 'canvas' },
  { value: 'bmp', label: 'BMP', ext: 'bmp', mime: 'image/bmp', engine: 'ffmpeg' },
  { value: 'gif', label: 'GIF', ext: 'gif', mime: 'image/gif', engine: 'ffmpeg' },
  { value: 'tiff', label: 'TIFF', ext: 'tiff', mime: 'image/tiff', engine: 'ffmpeg' },
  { value: 'tga', label: 'TGA', ext: 'tga', mime: 'image/x-targa', engine: 'ffmpeg' },
  { value: 'ico', label: 'ICO', ext: 'ico', mime: 'image/x-icon', engine: 'ffmpeg' },
  { value: 'ppm', label: 'PPM', ext: 'ppm', mime: 'image/x-portable-pixmap', engine: 'ffmpeg' },
  { value: 'pgm', label: 'PGM', ext: 'pgm', mime: 'image/x-portable-graymap', engine: 'ffmpeg' },
  { value: 'pbm', label: 'PBM', ext: 'pbm', mime: 'image/x-portable-bitmap', engine: 'ffmpeg' },
  { value: 'xpm', label: 'XPM', ext: 'xpm', mime: 'image/x-xpixmap', engine: 'ffmpeg' },
  { value: 'xbm', label: 'XBM', ext: 'xbm', mime: 'image/x-xbitmap', engine: 'ffmpeg' },
  { value: 'pam', label: 'PAM', ext: 'pam', mime: 'image/x-portable-arbitrarymap', engine: 'ffmpeg' },
  { value: 'pfm', label: 'PFM', ext: 'pfm', mime: 'image/x-portable-floatmap', engine: 'ffmpeg' },
  { value: 'sgi', label: 'SGI', ext: 'sgi', mime: 'image/sgi', engine: 'ffmpeg' },
  { value: 'sun', label: 'SUN', ext: 'sun', mime: 'image/x-sun-raster', engine: 'ffmpeg' },
  { value: 'ras', label: 'RAS', ext: 'ras', mime: 'image/x-sun-raster', engine: 'ffmpeg' },
  { value: 'iff', label: 'IFF', ext: 'iff', mime: 'image/x-iff', engine: 'ffmpeg' },
  { value: 'dpx', label: 'DPX', ext: 'dpx', mime: 'image/x-dpx', engine: 'ffmpeg' },
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
]

export const AUDIO_OUTPUTS: VideoOutputDef[] = [
  { value: 'mp3', label: 'MP3', ext: 'mp3', mime: 'audio/mpeg', args: () => ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'] },
  { value: 'wav', label: 'WAV', ext: 'wav', mime: 'audio/wav', args: () => ['-vn', '-c:a', 'pcm_s16le'] },
  { value: 'flac', label: 'FLAC', ext: 'flac', mime: 'audio/flac', args: () => ['-vn', '-c:a', 'flac'] },
  { value: 'ogg', label: 'OGG Vorbis', ext: 'ogg', mime: 'audio/ogg', args: () => ['-vn', '-c:a', 'libvorbis', '-q:a', '4'] },
  { value: 'opus', label: 'Opus', ext: 'opus', mime: 'audio/opus', args: () => ['-vn', '-c:a', 'libopus', '-b:a', '128k'] },
  { value: 'aac', label: 'AAC', ext: 'aac', mime: 'audio/aac', args: () => ['-vn', '-c:a', 'aac'] },
  { value: 'ac3', label: 'AC3', ext: 'ac3', mime: 'audio/ac3', args: () => ['-vn', '-c:a', 'ac3'] },
  { value: 'aiff', label: 'AIFF', ext: 'aiff', mime: 'audio/aiff', args: () => ['-vn', '-c:a', 'pcm_s16be'] },
  { value: 'aifc', label: 'AIFC', ext: 'aifc', mime: 'audio/aiff', args: () => ['-vn', '-c:a', 'pcm_s16be'] },
  { value: 'au', label: 'AU', ext: 'au', mime: 'audio/basic', args: () => ['-vn', '-c:a', 'pcm_s16be'] },
  { value: 'caf', label: 'CAF', ext: 'caf', mime: 'audio/x-caf', args: () => ['-vn', '-c:a', 'flac'] },
  { value: 'm4a', label: 'M4A', ext: 'm4a', mime: 'audio/mp4', args: () => ['-vn', '-c:a', 'aac'] },
  { value: 'm4b', label: 'M4B', ext: 'm4b', mime: 'audio/mp4', args: () => ['-vn', '-c:a', 'aac'] },
  { value: 'weba', label: 'WebM Audio', ext: 'weba', mime: 'audio/webm', args: () => ['-vn', '-c:a', 'libopus'] },
  { value: 'wma', label: 'WMA', ext: 'wma', mime: 'audio/x-ms-wma', args: () => ['-vn', '-c:a', 'wmav2'] },
  { value: 'voc', label: 'VOC', ext: 'voc', mime: 'audio/x-voc', args: () => ['-vn', '-c:a', 'pcm_s16le'] },
  { value: 'oga', label: 'OGA', ext: 'oga', mime: 'audio/ogg', args: () => ['-vn', '-c:a', 'libvorbis'] },
]

const ALL_MEDIA_OUTPUTS = [...VIDEO_OUTPUTS, ...AUDIO_OUTPUTS]

export function findImageDef(value: ImageFormat) {
  return IMAGE_OUTPUTS.find((o) => o.value === value)
}

export function findVideoDef(value: string) {
  return ALL_MEDIA_OUTPUTS.find((o) => o.value === value)
}

export function getImageFormatLabel(value: ImageFormat) {
  return findImageDef(value)?.label ?? value
}

export function getVideoFormatLabel(value: string) {
  return findVideoDef(value)?.label ?? value
}

export function getImageFormatMime(value: ImageFormat) {
  return findImageDef(value)?.mime ?? 'application/octet-stream'
}

export function getVideoFormatMime(value: string) {
  return findVideoDef(value)?.mime ?? 'application/octet-stream'
}

export function getImageFormatExt(value: ImageFormat) {
  return findImageDef(value)?.ext ?? value
}

export function getVideoFormatExt(value: string) {
  return findVideoDef(value)?.ext ?? value
}
