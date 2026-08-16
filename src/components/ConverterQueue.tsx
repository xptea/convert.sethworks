import { useState, useCallback } from 'react'
import JSZip from 'jszip'
import { convertImage, makeImageFilename, type ImageFormat } from '@/converters/image'
import { convertVideo, makeVideoFilename, type VideoFormat } from '@/converters/video'
import { downloadBlob } from '@/lib/download'
import { IMAGE_OUTPUTS, VIDEO_OUTPUTS } from '@/lib/formats'
import { FileDropzone } from './FileDropzone'
import { FormatPicker } from './FormatPicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Image, Video, X, Download, Play, RotateCcw, FileArchive, Settings2 } from 'lucide-react'
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

function detectType(file: File): FileType {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'tiff', 'tif', 'ico'].includes(ext || '')) return 'image'
  if (['mp4', 'mov', 'webm', 'avi', 'mkv', 'flv', 'ogv', '3gp', 'm4v', 'mpeg', 'mpg', 'asf', 'wmv', 'ts'].includes(ext || '')) return 'video'
  return 'image'
}

function defaultFormat(file: File): ImageFormat | VideoFormat {
  const type = detectType(file)
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

const videoGroups = {
  'Video containers': VIDEO_OUTPUTS.filter((o) => o.mime.startsWith('video/')),
  'Audio only': VIDEO_OUTPUTS.filter((o) => o.mime.startsWith('audio/')),
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <FileDropzone onFiles={addFiles} />

      {items.length > 0 && (
        <Card>
          <CardContent className="space-y-4 p-4">
            {(hasImages || hasVideos) && (
              <div className="flex flex-wrap items-center gap-3 border-b pb-4">
                <Settings2 className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Set all:</span>
                {hasImages && (
                  <Select onValueChange={(v) => setAllFormats('image', v as ImageFormat)}>
                    <SelectTrigger size="sm" className="w-36">
                      <SelectValue placeholder="Image format" />
                    </SelectTrigger>
                    <SelectContent>
                      {IMAGE_OUTPUTS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {hasVideos && (
                  <Select onValueChange={(v) => setAllFormats('video', v as VideoFormat)}>
                    <SelectTrigger size="sm" className="w-44">
                      <SelectValue placeholder="Video format" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(videoGroups).map(([group, options]) => (
                        <SelectGroup key={group}>
                          <SelectLabel>{group}</SelectLabel>
                          {options.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="space-y-3">
              {items.map((item) => {
                const isImage = item.type === 'image'
                const formatOptions = isImage
                  ? IMAGE_OUTPUTS.map((o) => ({ value: o.value, label: o.label }))
                  : VIDEO_OUTPUTS.map((o) => ({ value: o.value, label: o.label }))

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
                          {isImage ? <Image className="size-5" /> : <Video className="size-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground" title={item.file.name}>
                            {item.file.name}{' '}
                            <span className="text-xs text-muted-foreground">({formatBytes(item.file.size)})</span>
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
