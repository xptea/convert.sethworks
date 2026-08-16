import { useState, useCallback } from 'react'
import JSZip from 'jszip'
import { convertImage, makeImageFilename, type ImageFormat } from '@/converters/image'
import { convertVideo, makeVideoFilename, type VideoFormat } from '@/converters/video'
import { downloadBlob } from '@/lib/download'
import { IMAGE_OUTPUTS, VIDEO_OUTPUTS, AUDIO_OUTPUTS } from '@/lib/formats'
import { FileDropzone } from './FileDropzone'
import { FormatPicker } from './FormatPicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Image, Video, Music, X, Download, Play, RotateCcw, FileArchive, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type FileType = 'image' | 'video' | 'audio'

type Status = 'pending' | 'converting' | 'done' | 'error'

interface QueueItem {
  id: string
  file: File
  type: FileType
  format: ImageFormat | VideoFormat
  status: Status
  progress: number
  outputBlob?: Blob
  error?: string
}

const IMAGE_EXTS = new Set([
  '3fr','arw','avif','bmp','cr2','cr3','crw','dcr','dng','eps','erf','gif','heic','heif','icns','ico','jfif','jpeg','jpg','mos','mrw','nef','odd','odg','orf','pef','png','ppm','ps','psb','psd','pub','raf','raw','rw2','tga','tif','tiff','webp','x3f','xcf','xps'
])

const VIDEO_EXTS = new Set([
  '3g2','3gp','3gpp','avi','cavs','dv','dvr','flv','m2ts','m4v','mkv','mod','mov','mp4','mpeg','mpg','mts','mxf','ogg','ogv','rm','rmvb','swf','ts','vob','webm','wmv','wtv'
])

const AUDIO_EXTS = new Set([
  'aac','ac3','aif','aifc','aiff','amr','au','caf','dss','flac','m4a','m4b','mp3','oga','opus','sf2','sfark','voc','wav','weba','wma'
])

function detectType(file: File): FileType {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (VIDEO_EXTS.has(ext)) return 'video'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  return 'image'
}

function defaultFormat(file: File): ImageFormat | VideoFormat {
  const type = detectType(file)
  if (type === 'audio') return 'mp3'
  if (type === 'video') return 'mp4'
  return 'jpg'
}

function itemFileName(item: QueueItem): string {
  if (item.status !== 'done' || !item.outputBlob) return ''
  if (item.type === 'image') {
    return makeImageFilename(item.file, item.format as ImageFormat)
  }
  return makeVideoFilename(item.file, item.format as VideoFormat)
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`
}

function SizeComparison({ original, converted }: { original: number; converted: number }) {
  const diff = converted - original
  const percent = original === 0 ? 0 : Math.round((diff / original) * 100)
  const smaller = converted <= original

  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{formatBytes(original)}</span>
      <ArrowRight className="size-3 text-muted-foreground" />
      <span className={cn(smaller ? 'text-emerald-400' : 'text-red-400')}>
        {formatBytes(converted)}{' '}
        ({smaller ? '-' : '+'}{Math.abs(percent)}%)
      </span>
    </span>
  )
}

export function ConverterQueue() {
  const [items, setItems] = useState<QueueItem[]>([])

  const addFiles = useCallback((files: File[]) => {
    const newItems: QueueItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      type: detectType(file),
      format: defaultFormat(file),
      status: 'pending',
      progress: 0,
    }))
    setItems((prev) => [...prev, ...newItems])
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const setFormat = useCallback(
    (id: string, format: ImageFormat | VideoFormat) => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, format, status: 'pending', outputBlob: undefined, error: undefined } : i
        )
      )
    },
    []
  )

  const setAllFormats = useCallback((type: FileType, format: ImageFormat | VideoFormat) => {
    setItems((prev) =>
      prev.map((i) =>
        i.type === type ? { ...i, format, status: 'pending', outputBlob: undefined, error: undefined } : i
      )
    )
  }, [])

  const updateItem = useCallback(
    (id: string, updates: Partial<QueueItem>) => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)))
    },
    []
  )

  const convertOne = useCallback(
    async (id: string) => {
      const item = items.find((i) => i.id === id)
      if (!item) return

      updateItem(id, { status: 'converting', progress: 0, error: undefined })

      try {
        if (item.type === 'image') {
          const blob = await convertImage(item.file, {
            format: item.format as ImageFormat,
            quality: 0.85,
          })
          updateItem(id, { status: 'done', progress: 1, outputBlob: blob })
        } else {
          const blob = await convertVideo(
            item.file,
            { format: item.format as VideoFormat, quality: 3 },
            (p) => updateItem(id, { progress: p })
          )
          updateItem(id, { status: 'done', progress: 1, outputBlob: blob })
        }
      } catch (e) {
        updateItem(id, {
          status: 'error',
          progress: 0,
          error: e instanceof Error ? e.message : 'Conversion failed',
        })
      }
    },
    [items, updateItem]
  )

  const convertAll = useCallback(async () => {
    const pending = items.filter((i) => i.status === 'pending')
    if (pending.length === 0) return
    for (const item of pending) {
      await convertOne(item.id)
    }
  }, [items, convertOne])

  const downloadOne = useCallback((item: QueueItem) => {
    if (!item.outputBlob) return
    const name = itemFileName(item)
    downloadBlob(item.outputBlob, name)
  }, [])

  const downloadAll = useCallback(async () => {
    const done = items.filter((i) => i.status === 'done' && i.outputBlob)
    if (done.length === 0) return

    if (done.length === 1) {
      downloadOne(done[0])
      return
    }

    const zip = new JSZip()
    for (const item of done) {
      if (!item.outputBlob) continue
      zip.file(itemFileName(item), item.outputBlob)
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, 'converted.zip')
  }, [items, downloadOne])

  const hasConverting = items.some((i) => i.status === 'converting')
  const hasDone = items.some((i) => i.status === 'done' && i.outputBlob)
  const hasPending = items.some((i) => i.status === 'pending')
  const hasImages = items.some((i) => i.type === 'image')
  const hasVideos = items.some((i) => i.type === 'video')
  const hasAudios = items.some((i) => i.type === 'audio')

  const imageFormatOptions = IMAGE_OUTPUTS.map((o) => ({ value: o.value as string, label: o.label }))
  const videoFormatOptions = [...VIDEO_OUTPUTS, ...AUDIO_OUTPUTS].map((o) => ({ value: o.value, label: o.label }))
  const audioFormatOptions = AUDIO_OUTPUTS.map((o) => ({ value: o.value, label: o.label }))

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <FileDropzone onFiles={addFiles} />

      {items.length > 0 && (
        <Card>
          <CardContent className="space-y-4 p-4">
            {(hasImages || hasVideos || hasAudios) && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {hasImages && (
                  <FormatPicker
                    placeholder="Set all images"
                    options={imageFormatOptions}
                    onChange={(v) => setAllFormats('image', v as ImageFormat)}
                    triggerClassName="w-44"
                  />
                )}
                {hasVideos && (
                  <FormatPicker
                    placeholder="Set all videos"
                    options={videoFormatOptions}
                    onChange={(v) => setAllFormats('video', v as VideoFormat)}
                    triggerClassName="w-44"
                  />
                )}
                {hasAudios && (
                  <FormatPicker
                    placeholder="Set all audio"
                    options={audioFormatOptions}
                    onChange={(v) => setAllFormats('audio', v as VideoFormat)}
                    triggerClassName="w-44"
                  />
                )}
              </div>
            )}

            <div className="space-y-3">
              {items.map((item) => {
                let formatOptions = imageFormatOptions
                let icon = <Image className="size-5" />
                if (item.type === 'video') {
                  formatOptions = videoFormatOptions
                  icon = <Video className="size-5" />
                } else if (item.type === 'audio') {
                  formatOptions = audioFormatOptions
                  icon = <Music className="size-5" />
                }

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex flex-col gap-3 rounded-xl border p-4 transition-colors',
                      item.status === 'converting' ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          {icon}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground" title={item.file.name}>
                            {item.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.status === 'done' && item.outputBlob ? (
                              <SizeComparison original={item.file.size} converted={item.outputBlob.size} />
                            ) : (
                              <span>{formatBytes(item.file.size)}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:w-72">
                        <FormatPicker
                          value={item.format}
                          options={formatOptions}
                          onChange={(v) => setFormat(item.id, v as ImageFormat | VideoFormat)}
                          disabled={item.status === 'converting'}
                        />

                        <div className="flex items-center gap-2">
                          {item.status === 'done' ? (
                            <Button size="sm" variant="outline" onClick={() => downloadOne(item)}>
                              <Download className="mr-1.5 size-4" />
                              Download
                            </Button>
                          ) : item.status === 'converting' ? (
                            <Button size="sm" disabled>
                              <RotateCcw className="mr-1.5 size-4 animate-spin" />
                              Converting
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => convertOne(item.id)} disabled={hasConverting}>
                              <Play className="mr-1.5 size-4" />
                              Convert
                            </Button>
                          )}

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeItem(item.id)}
                            disabled={item.status === 'converting'}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {item.status === 'converting' && (
                      <div className="w-full">
                        <Progress value={Math.round(item.progress * 100)} />
                        <p className="mt-1 text-right text-xs text-muted-foreground">
                          {Math.round(item.progress * 100)}%
                        </p>
                      </div>
                    )}

                    {item.status === 'error' && item.error && (
                      <p className="w-full text-sm text-destructive">{item.error}</p>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                {items.length} file{items.length === 1 ? '' : 's'} added
              </p>
              <div className="flex items-center gap-2">
                <Button onClick={convertAll} disabled={!hasPending || hasConverting}>
                  <Play className="mr-1.5 size-4" />
                  Convert all
                </Button>
                {hasDone && (
                  <Button variant="secondary" onClick={downloadAll}>
                    <FileArchive className="mr-1.5 size-4" />
                    Download all
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Add files to get started. Everything runs on your device — nothing is uploaded.
        </p>
      )}
    </div>
  )
}
