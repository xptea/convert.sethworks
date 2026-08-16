import { useState, useCallback } from 'react'
import JSZip from 'jszip'
import { convertImage, makeImageFilename, type ImageFormat } from '@/converters/image'
import { convertVideo, makeVideoFilename, type VideoFormat } from '@/converters/video'
import { downloadBlob } from '@/lib/download'
import { FileDropzone } from './FileDropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Image, Video, X, Download, Play, RotateCcw, FileArchive } from 'lucide-react'
import { cn } from '@/lib/utils'

type FileType = 'image' | 'video'

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

const IMAGE_FORMATS: { value: ImageFormat; label: string }[] = [
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/webp', label: 'WebP' },
]

const VIDEO_FORMATS: { value: VideoFormat; label: string }[] = [
  { value: 'mp4', label: 'MP4' },
  { value: 'webm', label: 'WebM' },
]

function detectType(file: File): FileType {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext || '')) return 'image'
  if (['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v'].includes(ext || '')) return 'video'
  return 'image'
}

function defaultFormat(file: File): ImageFormat | VideoFormat {
  const type = detectType(file)
  if (type === 'video') {
    const ext = file.name.split('.').pop()?.toLowerCase()
    return ext === 'webm' ? 'mp4' : 'mp4'
  }
  return 'image/jpeg'
}

function itemFileName(item: QueueItem): string {
  if (item.status !== 'done' || !item.outputBlob) return ''
  if (item.type === 'image') {
    return makeImageFilename(item.file, item.format as ImageFormat)
  }
  return makeVideoFilename(item.file, item.format as VideoFormat)
}

export function ConverterQueue() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [convertingAll, setConvertingAll] = useState(false)

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
        prev.map((i) => (i.id === id ? { ...i, format, status: 'pending', outputBlob: undefined, error: undefined } : i))
      )
    },
    []
  )

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
            maxWidth: 1920,
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
    setConvertingAll(true)
    for (const item of pending) {
      await convertOne(item.id)
    }
    setConvertingAll(false)
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <FileDropzone onFiles={addFiles} />

      {items.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {items.map((item) => {
                const options = item.type === 'image' ? IMAGE_FORMATS : VIDEO_FORMATS
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex flex-col gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between',
                      item.status === 'converting' ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        {item.type === 'image' ? <Image className="size-5" /> : <Video className="size-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground" title={item.file.name}>
                          {item.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      <Select
                        value={item.format}
                        onValueChange={(v) => setFormat(item.id, v as ImageFormat | VideoFormat)}
                        disabled={item.status === 'converting'}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

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

                    {item.status === 'converting' && (
                      <div className="w-full sm:col-span-2">
                        <Progress value={Math.round(item.progress * 100)} />
                        <p className="mt-1 text-right text-xs text-muted-foreground">
                          {Math.round(item.progress * 100)}%
                        </p>
                      </div>
                    )}

                    {item.status === 'error' && item.error && (
                      <p className="w-full text-sm text-destructive sm:col-span-2">{item.error}</p>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                {items.length} file{items.length === 1 ? '' : 's'} added
              </p>
              <div className="flex items-center gap-2">
                <Button onClick={convertAll} disabled={!hasPending || hasConverting || convertingAll}>
                  <Play className="mr-1.5 size-4" />
                  Convert all
                </Button>
                <Button variant="secondary" onClick={downloadAll} disabled={!hasDone}>
                  <FileArchive className="mr-1.5 size-4" />
                  Download all
                </Button>
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
