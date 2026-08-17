export type ImageFormat =
  | 'png'
  | 'jpg'
  | 'webp'
  | 'bmp'
  | 'gif'
  | 'tiff'
  | 'tga'
  | 'ppm'
  | 'pgm'
  | 'pbm'
  | 'xbm'
  | 'pam'
  | 'pfm'
  | 'sgi'
  | 'dpx'
  | 'ico'
  | 'apng'
  | 'jp2'
  | 'jls'
  | 'exr'
  | 'qoi'
  | 'pcx'
  | 'fits'
  | 'sunras'

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
  { value: 'ppm', label: 'PPM', ext: 'ppm', mime: 'image/x-portable-pixmap', engine: 'ffmpeg' },
  { value: 'pgm', label: 'PGM', ext: 'pgm', mime: 'image/x-portable-graymap', engine: 'ffmpeg' },
  { value: 'pbm', label: 'PBM', ext: 'pbm', mime: 'image/x-portable-bitmap', engine: 'ffmpeg' },
  { value: 'xbm', label: 'XBM', ext: 'xbm', mime: 'image/x-xbitmap', engine: 'ffmpeg' },
  { value: 'pam', label: 'PAM', ext: 'pam', mime: 'image/x-portable-arbitrarymap', engine: 'ffmpeg' },
  { value: 'pfm', label: 'PFM', ext: 'pfm', mime: 'image/x-portable-floatmap', engine: 'ffmpeg' },
  { value: 'sgi', label: 'SGI', ext: 'sgi', mime: 'image/sgi', engine: 'ffmpeg' },
  { value: 'dpx', label: 'DPX', ext: 'dpx', mime: 'image/x-dpx', engine: 'ffmpeg' },
  { value: 'ico', label: 'ICO', ext: 'ico', mime: 'image/x-icon', engine: 'ffmpeg' },
  { value: 'apng', label: 'APNG', ext: 'apng', mime: 'image/apng', engine: 'ffmpeg' },
  { value: 'jp2', label: 'JPEG 2000', ext: 'jp2', mime: 'image/jp2', engine: 'ffmpeg' },
  { value: 'jls', label: 'JPEG-LS', ext: 'jls', mime: 'image/jls', engine: 'ffmpeg' },
  { value: 'exr', label: 'OpenEXR', ext: 'exr', mime: 'image/x-exr', engine: 'ffmpeg' },
  { value: 'qoi', label: 'QOI', ext: 'qoi', mime: 'image/qoi', engine: 'ffmpeg' },
  { value: 'pcx', label: 'PCX', ext: 'pcx', mime: 'image/x-pcx', engine: 'ffmpeg' },
  { value: 'fits', label: 'FITS', ext: 'fits', mime: 'image/fits', engine: 'ffmpeg' },
  { value: 'sunras', label: 'Sun Raster', ext: 'ras', mime: 'image/x-cmu-raster', engine: 'ffmpeg' },
]

export type VideoFormat = string

export interface VideoOutputDef {
  value: string
  label: string
  ext: string
  mime: string
  /** FFmpeg args placed between input and output name. */
  args: (quality: number) => string[]
  /** Whether this output can be produced by copying input streams (same-codec remux). */
  copyable?: boolean
}

function x264Aac(quality: number) {
  const crf = Math.max(18, 35 - (quality - 1) * 4)
  return [
    '-c:v', 'libx264',
    '-crf', String(crf),
    '-preset', 'veryfast',
    '-c:a', 'aac',
    '-movflags', '+faststart',
  ]
}

function vp8Vorbis(quality: number) {
  const crf = Math.max(18, 35 - (quality - 1) * 4)
  return ['-c:v', 'libvpx', '-crf', String(crf), '-b:v', '0', '-speed', '5', '-c:a', 'libvorbis']
}

function hevcAac(quality: number) {
  const crf = Math.max(20, 36 - (quality - 1) * 4)
  return [
    '-c:v', 'libx265',
    '-crf', String(crf),
    '-preset', 'ultrafast',
    '-tag:v', 'hvc1',
    '-c:a', 'aac',
    '-movflags', '+faststart',
  ]
}

function losslessFfv1() {
  return ['-c:v', 'ffv1', '-level', '3', '-c:a', 'flac']
}

function theoraVorbis(_quality: number) {
  return ['-c:v', 'libtheora', '-q:v', '4', '-c:a', 'libvorbis', '-q:a', '4']
}

export const VIDEO_OUTPUTS: VideoOutputDef[] = [
  { value: 'mp4', label: 'MP4 (H.264)', ext: 'mp4', mime: 'video/mp4', args: x264Aac, copyable: true },
  { value: 'mov', label: 'MOV', ext: 'mov', mime: 'video/quicktime', args: x264Aac, copyable: true },
  { value: 'm4v', label: 'M4V', ext: 'm4v', mime: 'video/x-m4v', args: x264Aac, copyable: true },
  { value: 'mkv', label: 'MKV', ext: 'mkv', mime: 'video/x-matroska', args: x264Aac, copyable: true },
  { value: 'avi', label: 'AVI', ext: 'avi', mime: 'video/x-msvideo', args: x264Aac, copyable: true },
  { value: 'webm-vp8', label: 'WebM (VP8)', ext: 'webm', mime: 'video/webm', args: vp8Vorbis },
  { value: 'mp4-hevc', label: 'H.265 (MP4)', ext: 'mp4', mime: 'video/mp4', args: hevcAac },
  { value: 'flv', label: 'FLV', ext: 'flv', mime: 'video/x-flv', args: x264Aac, copyable: true },
  { value: 'ogv', label: 'OGV (Theora)', ext: 'ogv', mime: 'video/ogg', args: theoraVorbis },
  { value: '3gp', label: '3GP', ext: '3gp', mime: 'video/3gpp', args: x264Aac, copyable: true },
  { value: 'mpeg', label: 'MPEG-1', ext: 'mpeg', mime: 'video/mpeg', args: (q) => ['-c:v', 'mpeg1video', '-qscale:v', String(Math.max(2, 14 - q)), '-c:a', 'mp2'] },
  { value: 'mpeg2', label: 'MPEG-2', ext: 'mpg', mime: 'video/mpeg', args: (q) => ['-c:v', 'mpeg2video', '-qscale:v', String(Math.max(2, 14 - q)), '-c:a', 'mp2'] },
  { value: 'asf', label: 'ASF (WMV)', ext: 'asf', mime: 'video/x-ms-asf', args: () => ['-c:v', 'wmv2', '-c:a', 'wmav2'] },
  { value: 'mpeg4-avi', label: 'MPEG-4 (AVI)', ext: 'avi', mime: 'video/x-msvideo', args: (q) => [
    '-c:v', 'mpeg4', '-qscale:v', String(Math.max(2, 14 - q)), '-c:a', 'libmp3lame', '-q:a', '4',
  ]},
  { value: 'mpegts', label: 'MPEG-TS', ext: 'ts', mime: 'video/mp2t', args: (q) => [
    '-c:v', 'libx264', '-crf', String(Math.max(18, 35 - (q - 1) * 4)), '-preset', 'veryfast',
    '-c:a', 'aac', '-f', 'mpegts',
  ]},
  { value: 'prores', label: 'ProRes (MOV)', ext: 'mov', mime: 'video/quicktime', args: () => [
    '-c:v', 'prores_ks', '-profile:v', '2', '-pix_fmt', 'yuv422p10le', '-c:a', 'pcm_s16le',
  ]},
  { value: 'dnxhr', label: 'DNxHR (MOV)', ext: 'mov', mime: 'video/quicktime', args: () => [
    '-c:v', 'dnxhd', '-profile:v', 'dnxhr_lb', '-pix_fmt', 'yuv422p', '-c:a', 'pcm_s16le',
  ]},
  { value: 'ffv1', label: 'FFV1 (MKV)', ext: 'mkv', mime: 'video/x-matroska', args: losslessFfv1 },
  { value: 'huffyuv', label: 'HuffYUV (AVI)', ext: 'avi', mime: 'video/x-msvideo', args: () => [
    '-c:v', 'huffyuv', '-pix_fmt', 'yuv422p', '-c:a', 'pcm_s16le',
  ]},
  { value: 'utvideo', label: 'UTVideo (AVI)', ext: 'avi', mime: 'video/x-msvideo', args: () => [
    '-c:v', 'utvideo', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le',
  ]},
  { value: 'dv', label: 'DV', ext: 'dv', mime: 'video/dv', args: () => [
    '-vf', 'scale=720:480:force_original_aspect_ratio=decrease,pad=720:480:(ow-iw)/2:(oh-ih)/2,fps=30000/1001',
    '-c:v', 'dvvideo', '-pix_fmt', 'yuv411p', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2',
  ]},
  { value: 'vob', label: 'VOB (DVD Video)', ext: 'vob', mime: 'video/dvd', args: (q) => [
    '-c:v', 'mpeg2video', '-qscale:v', String(Math.max(2, 14 - q)), '-c:a', 'ac3', '-f', 'vob',
  ]},
  { value: 'nut', label: 'NUT (Lossless)', ext: 'nut', mime: 'video/x-nut', args: losslessFfv1 },
  { value: 'y4m', label: 'YUV4MPEG', ext: 'y4m', mime: 'video/x-yuv4mpeg', args: () => [
    '-an', '-pix_fmt', 'yuv420p', '-f', 'yuv4mpegpipe',
  ]},
  { value: 'rm', label: 'RealMedia', ext: 'rm', mime: 'application/vnd.rn-realmedia', args: () => [
    '-vf', 'scale=320:-2', '-c:v', 'rv20', '-b:v', '400k', '-c:a', 'ac3', '-b:a', '96k', '-f', 'rm',
  ]},
  { value: 'h261', label: 'H.261', ext: 'h261', mime: 'video/h261', args: () => [
    '-vf', 'scale=176:144', '-an', '-c:v', 'h261', '-f', 'h261',
  ]},
  { value: 'h263', label: 'H.263', ext: 'h263', mime: 'video/h263', args: () => [
    '-vf', 'scale=176:144', '-an', '-c:v', 'h263', '-f', 'h263',
  ]},
  { value: 'amv', label: 'AMV', ext: 'amv', mime: 'video/x-amv', args: () => [
    '-vf', 'scale=160:120,pad=160:128:0:4,fps=25', '-c:v', 'amv', '-c:a', 'adpcm_ima_amv', '-ar', '22050', '-ac', '1',
    '-block_size', '882',
  ]},
  { value: 'swf', label: 'SWF Video', ext: 'swf', mime: 'application/x-shockwave-flash', args: () => [
    '-c:v', 'flv', '-c:a', 'libmp3lame', '-f', 'swf',
  ]},
  { value: 'gif', label: 'GIF', ext: 'gif', mime: 'image/gif', args: () => [
    '-vf', "fps=15,scale='min(640,iw)':-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle",
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
  { value: 'weba', label: 'WebM Audio', ext: 'weba', mime: 'audio/webm', args: () => ['-vn', '-c:a', 'libopus', '-f', 'webm'] },
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
