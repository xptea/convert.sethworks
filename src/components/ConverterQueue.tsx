import { useState, useCallback } from 'react'
import JSZip from 'jszip'
import { Popover } from '@base-ui/react/popover'
import { convertImage, makeImageFilename, type ImageFormat } from '@/converters/image'
import { convertVideo, makeVideoFilename, type VideoFormat } from '@/converters/video'
import { downloadBlob } from '@/lib/download'
import { IMAGE_OUTPUTS, VIDEO_OUTPUTS, AUDIO_OUTPUTS } from '@/lib/formats'
import { FileDropzone } from './FileDropzone'
import { FormatPicker } from './FormatPicker'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent } from '@/components/ui/card'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import {
  Image,
  Video,
  Music,
  Download,
  Play,
  Loader2,
  FileArchive,
  Settings2,
  Trash2,
  ChevronDown,
  Files,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type FileType = 'image' | 'video' | 'audio'

type Status = 'pending' | 'converting' | 'done' | 'error'

interface QueueItem {
  id: string
  file: File
  type: FileType
  format: ImageFormat | VideoFormat
  quality: number
  status: Status
  progress: number
  outputBlob?: Blob
  error?: string
}

const IMAGE_EXTS = new Set([
  '3fr','apng','arw','avif','bmp','cr2','cr3','crw','dcr','dng','dpx','eps','erf','exr','fit','fits','fts','gif','heic','heif','icns','ico','jfif','jls','jp2','jpeg','jpg','mos','mrw','nef','odd','odg','orf','pam','pbm','pcx','pef','pfm','pgm','png','ppm','ps','psb','psd','pub','qoi','raf','ras','raw','rw2','sgi','svg','tga','tif','tiff','webp','x3f','xbm','xcf','xps'
])

const VIDEO_EXTS = new Set([
  '3g2','3gp','3gpp','amv','avi','cavs','dv','dvr','flv','h261','h263','m2ts','m4v','mkv','mod','mov','mp4','mpeg','mpg','mts','mxf','nut','ogg','ogv','rm','rmvb','swf','ts','vob','webm','wmv','wtv','y4m'
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

function defaultQuality(_type: FileType): number {
  return 1
}

function sharedFormat(items: QueueItem[], type: FileType): string | undefined {
  const matching = items.filter((item) => item.type === type)
  if (matching.length === 0) return undefined
  const first = matching[0].format
  return matching.every((item) => item.format === first) ? first : undefined
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
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap text-xs"
      title={`Original: ${formatBytes(original)}`}
    >
      <span className="text-muted-foreground">{formatBytes(converted)}</span>
      <span className={cn(smaller ? 'text-emerald-400' : 'text-red-400')}>
        ({smaller ? '-' : '+'}{Math.abs(percent)}%)
      </span>
    </span>
  )
}

function QualitySlider({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  const pct = Math.round(value * 100)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Output quality</span>
        <span>{pct}%</span>
      </div>
      <Slider
        aria-label="Output quality"
        min={1}
        max={100}
        value={pct}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <p className="text-[10px] text-muted-foreground leading-tight">
        Higher preserves more detail. Lossless formats may ignore this setting.
      </p>
    </div>
  )
}

export function ConverterQueue() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const [bulkQualityOpen, setBulkQualityOpen] = useState(false)
  const [bulkQuality, setBulkQuality] = useState(1)

  const addFiles = useCallback((files: File[]) => {
    const newItems: QueueItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      type: detectType(file),
      format: defaultFormat(file),
      quality: defaultQuality(detectType(file)),
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

  const setQuality = useCallback((id: string, quality: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quality, status: 'pending', outputBlob: undefined, error: undefined } : i))
    )
  }, [])

  const setAllQuality = useCallback((quality: number) => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        quality,
        status: 'pending',
        progress: 0,
        outputBlob: undefined,
        error: undefined,
      }))
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
            quality: item.quality,
          })
          updateItem(id, { status: 'done', progress: 1, outputBlob: blob })
        } else {
          const blob = await convertVideo(
            item.file,
            { format: item.format as VideoFormat, quality: item.quality },
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
    await Promise.all(pending.map((item) => convertOne(item.id)))
  }, [items, convertOne])

  const downloadOne = useCallback((item: QueueItem) => {
    if (!item.outputBlob) return
    const name = itemFileName(item)
    downloadBlob(item.outputBlob, name)
  }, [])

  const downloadAsZip = useCallback(async () => {
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

  const downloadSeparately = useCallback(() => {
    const done = items.filter((i) => i.status === 'done' && i.outputBlob)
    for (const item of done) {
      downloadOne(item)
    }
  }, [items, downloadOne])

  const hasConverting = items.some((i) => i.status === 'converting')
  const doneItems = items.filter((i) => i.status === 'done' && i.outputBlob)
  const hasPending = items.some((i) => i.status === 'pending')
  const hasImages = items.some((i) => i.type === 'image')
  const hasVideos = items.some((i) => i.type === 'video')
  const hasAudios = items.some((i) => i.type === 'audio')
  const sharedImageFormat = sharedFormat(items, 'image')
  const sharedVideoFormat = sharedFormat(items, 'video')
  const sharedAudioFormat = sharedFormat(items, 'audio')

  const imageFormatOptions = IMAGE_OUTPUTS.map((o) => ({ value: o.value as string, label: o.label }))
  const videoFormatOptions = [...VIDEO_OUTPUTS, ...AUDIO_OUTPUTS].map((o) => ({ value: o.value, label: o.label }))
  const audioFormatOptions = AUDIO_OUTPUTS.map((o) => ({ value: o.value, label: o.label }))

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <FileDropzone onFiles={addFiles} />

      {items.length > 0 && (
        <Card size="sm" className="py-0">
          <CardContent className="space-y-2 p-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2">
              <p className="text-sm text-muted-foreground">
                {items.length} file{items.length === 1 ? '' : 's'} added
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {hasImages && (
                  <FormatPicker
                    testId="set-all-images"
                    value={sharedImageFormat}
                    placeholder="Set all images"
                    options={imageFormatOptions}
                    onChange={(v) => setAllFormats('image', v as ImageFormat)}
                    triggerClassName="w-36"
                  />
                )}
                {hasVideos && (
                  <FormatPicker
                    testId="set-all-videos"
                    value={sharedVideoFormat}
                    placeholder="Set all videos"
                    options={videoFormatOptions}
                    onChange={(v) => setAllFormats('video', v as VideoFormat)}
                    triggerClassName="w-36"
                  />
                )}
                {hasAudios && (
                  <FormatPicker
                    testId="set-all-audio"
                    value={sharedAudioFormat}
                    placeholder="Set all audio"
                    options={audioFormatOptions}
                    onChange={(v) => setAllFormats('audio', v as VideoFormat)}
                    triggerClassName="w-36"
                  />
                )}

                <Popover.Root open={bulkQualityOpen} onOpenChange={setBulkQualityOpen}>
                  <Popover.Trigger
                    disabled={hasConverting}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Settings2 className="size-4" />
                    Set all quality
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Positioner
                      side="bottom"
                      align="end"
                      sideOffset={6}
                      collisionPadding={8}
                      collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'none' }}
                    >
                      <Popover.Popup className="z-50 w-64 space-y-3 rounded-xl border border-border bg-popover p-3 shadow-lg outline-none">
                        <QualitySlider value={bulkQuality} onChange={setBulkQuality} disabled={hasConverting} />
                        <Button
                          className="w-full"
                          onClick={() => {
                            setAllQuality(bulkQuality)
                            setBulkQualityOpen(false)
                          }}
                        >
                          Apply to all files
                        </Button>
                      </Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>

                <Button onClick={convertAll} disabled={!hasPending || hasConverting}>
                  <Play className="mr-1.5 size-4" />
                  Convert all
                </Button>
                {doneItems.length === 1 && (
                  <Button variant="secondary" onClick={() => downloadOne(doneItems[0])}>
                    <Download className="mr-1.5 size-4" />
                    Download
                  </Button>
                )}
                {doneItems.length > 1 && (
                  <div className="flex items-center">
                    <Button
                      variant="secondary"
                      onClick={downloadAsZip}
                      className="rounded-r-none border-r border-border pr-3"
                      title="Download all files as a ZIP"
                    >
                      <FileArchive className="mr-1.5 size-4" />
                      Download all
                    </Button>
                    <Popover.Root open={downloadMenuOpen} onOpenChange={setDownloadMenuOpen}>
                      <Popover.Trigger
                        aria-label="Choose how to download all files"
                        title="Download options"
                        className="inline-flex h-8 items-center justify-center rounded-r-lg bg-secondary px-2 text-secondary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <ChevronDown
                          className={cn('size-4 transition-transform', downloadMenuOpen && 'rotate-180')}
                        />
                      </Popover.Trigger>

                      <Popover.Portal>
                        <Popover.Positioner
                          side="bottom"
                          align="end"
                          sideOffset={6}
                          collisionPadding={8}
                          collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'none' }}
                        >
                          <Popover.Popup className="z-50 w-60 rounded-xl border border-border bg-popover p-1.5 shadow-lg outline-none">
                            <button
                              type="button"
                              onClick={() => {
                                setDownloadMenuOpen(false)
                                void downloadAsZip()
                              }}
                              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
                            >
                              <FileArchive className="mt-0.5 size-4 shrink-0" />
                              <span>
                                <span className="block text-sm font-medium text-foreground">Download as ZIP</span>
                                <span className="block text-xs text-muted-foreground">Default · one compressed download</span>
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDownloadMenuOpen(false)
                                downloadSeparately()
                              }}
                              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
                            >
                              <Files className="mt-0.5 size-4 shrink-0" />
                              <span>
                                <span className="block text-sm font-medium text-foreground">Download separately</span>
                                <span className="block text-xs text-muted-foreground">Queue each converted file</span>
                              </span>
                            </button>
                          </Popover.Popup>
                        </Popover.Positioner>
                      </Popover.Portal>
                    </Popover.Root>
                  </div>
                )}
              </div>
            </div>

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
                      'relative flex flex-col gap-2 overflow-hidden rounded-xl border p-3 transition-colors',
                      item.status === 'converting' ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                    )}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setContextMenu({ id: item.id, x: e.clientX, y: e.clientY })
                    }}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          {icon}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground" title={item.file.name}>
                            {item.file.name}
                          </p>
                          <p className="truncate leading-5 text-xs text-muted-foreground">
                            {item.status === 'done' && item.outputBlob ? (
                              <SizeComparison original={item.file.size} converted={item.outputBlob.size} />
                            ) : (
                              <span className="whitespace-nowrap">{formatBytes(item.file.size)}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-row flex-wrap items-center gap-2">
                        <FormatPicker
                          value={item.format}
                          options={formatOptions}
                          onChange={(v) => setFormat(item.id, v as ImageFormat | VideoFormat)}
                          disabled={item.status === 'converting'}
                          triggerClassName="w-40"
                        />

                        <Popover.Root
                          open={settingsId === item.id}
                          onOpenChange={(open) => setSettingsId(open ? item.id : null)}
                        >
                          <Popover.Trigger
                            aria-label={`Output settings for ${item.file.name}`}
                            disabled={item.status === 'converting'}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Settings2 className="size-4" />
                          </Popover.Trigger>

                          <Popover.Portal>
                            <Popover.Positioner
                              side="bottom"
                              align="end"
                              sideOffset={4}
                              collisionPadding={8}
                              collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'none' }}
                            >
                              <Popover.Popup className="z-50 w-56 rounded-xl border border-border bg-popover p-3 shadow-lg outline-none">
                                <QualitySlider
                                  value={item.quality}
                                  onChange={(q) => setQuality(item.id, q)}
                                  disabled={item.status === 'converting'}
                                />
                              </Popover.Popup>
                            </Popover.Positioner>
                          </Popover.Portal>
                        </Popover.Root>

                        <div className="flex items-center gap-2">
                          {item.status === 'done' ? (
                            <Button className="w-36" variant="outline" onClick={() => downloadOne(item)}>
                              <Download className="mr-1.5 size-4" />
                              Download
                            </Button>
                          ) : item.status === 'converting' ? (
                            <Button className="w-36" disabled>
                              <Loader2 className="mr-1.5 size-4 animate-spin" />
                              Converting
                            </Button>
                          ) : (
                            <Button className="w-36" onClick={() => convertOne(item.id)} disabled={hasConverting}>
                              <Play className="mr-1.5 size-4" />
                              Convert
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'absolute bottom-0 left-0 right-0 h-1 overflow-hidden bg-muted transition-opacity',
                        item.status === 'converting' ? 'opacity-100' : 'opacity-0'
                      )}
                    >
                      <div
                        className="h-full bg-primary transition-all duration-200"
                        style={{ width: `${Math.round(item.progress * 100)}%` }}
                      />
                    </div>

                    {item.status === 'error' && item.error && (
                      <p className="w-full text-sm text-destructive">{item.error}</p>
                    )}

                    <ContextMenu
                      open={contextMenu?.id === item.id}
                      x={contextMenu?.x ?? 0}
                      y={contextMenu?.y ?? 0}
                      onClose={() => setContextMenu(null)}
                    >
                      {item.status === 'done' ? (
                        <ContextMenuItem onClick={() => { downloadOne(item); setContextMenu(null) }}>
                          <Download className="size-4" />
                          Download
                        </ContextMenuItem>
                      ) : item.status === 'converting' ? (
                        <ContextMenuItem onClick={() => {}} disabled>
                          <Loader2 className="size-4" />
                          Converting
                        </ContextMenuItem>
                      ) : (
                        <ContextMenuItem onClick={() => { convertOne(item.id); setContextMenu(null) }}>
                          <Play className="size-4" />
                          Convert
                        </ContextMenuItem>
                      )}
                      <ContextMenuItem onClick={() => { setSettingsId(item.id); setContextMenu(null) }}>
                        <Settings2 className="size-4" />
                        Output settings
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => { removeItem(item.id); setContextMenu(null) }}
                        destructive
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </ContextMenuItem>
                    </ContextMenu>
                  </div>
                )
              })}
            </div>

          </CardContent>
        </Card>
      )}

      {items.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Your conversion queue will appear here after you add a file.
        </p>
      )}
    </div>
  )
}
