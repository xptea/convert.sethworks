import type { ImageFormat } from '@/converters/image'
import type { GifOptions, VideoFormat } from '@/converters/video'
import type { SupportedFileType } from '@/lib/file-support'

export type FileType = SupportedFileType

export type Status = 'pending' | 'converting' | 'done' | 'error'

export interface QueueItem {
  id: string
  file: File
  type: FileType
  format: ImageFormat | VideoFormat
  quality: number
  stripMetadata: boolean
  status: Status
  progress: number | null
  progressStage?: string
  gifOptions: GifOptions
  mediaInfo?: MediaInfo
  outputBlob?: Blob
  error?: string
}

export interface MediaInfo {
  width?: number
  height?: number
  duration?: number
}

export type FormatOption = { value: string; label: string; popular?: boolean }

export type ContextMenuState = { id: string; x: number; y: number }
