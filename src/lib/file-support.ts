export type SupportedFileType = 'image' | 'video' | 'audio'

const IMAGE_EXTENSIONS = [
  '3fr','apng','arw','avif','bmp','cr2','cr3','crw','dcr','dng','dpx','eps','erf','exr','fit','fits','fts','gif','heic','heif','icns','ico','jfif','jls','jp2','jpeg','jpg','mos','mrw','nef','odd','odg','orf','pam','pbm','pcx','pef','pfm','pgm','png','ppm','ps','psb','psd','pub','qoi','raf','ras','raw','rw2','sgi','svg','tga','tif','tiff','webp','x3f','xbm','xcf','xps',
] as const

const VIDEO_EXTENSIONS = [
  '3g2','3gp','3gpp','amv','avi','cavs','dv','dvr','flv','h261','h263','m2ts','m4v','mkv','mod','mov','mp4','mpeg','mpg','mts','mxf','nut','ogg','ogv','rm','rmvb','swf','ts','vob','webm','wmv','wtv','y4m',
] as const

const AUDIO_EXTENSIONS = [
  'aac','ac3','aif','aifc','aiff','amr','au','caf','dss','flac','m4a','m4b','mp3','oga','opus','sf2','sfark','voc','wav','weba','wma',
] as const

const IMAGE_SET = new Set<string>(IMAGE_EXTENSIONS)
const VIDEO_SET = new Set<string>(VIDEO_EXTENSIONS)
const AUDIO_SET = new Set<string>(AUDIO_EXTENSIONS)

export const SUPPORTED_FILE_ACCEPT = [
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
].map((extension) => `.${extension}`).join(',')

export function getSupportedFileType(file: Pick<File, 'name'>): SupportedFileType | undefined {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_SET.has(extension)) return 'image'
  if (VIDEO_SET.has(extension)) return 'video'
  if (AUDIO_SET.has(extension)) return 'audio'
  return undefined
}
