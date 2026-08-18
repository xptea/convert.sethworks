import { useState, useCallback, useRef } from 'react'
import JSZip from 'jszip'
import { convertImage, makeImageFilename, type ImageFormat } from '@/converters/image'
import {
  convertVideo,
  makeVideoFilename,
  DEFAULT_GIF_OPTIONS,
  type GifOptions,
  type VideoFormat,
} from '@/converters/video'
import { downloadBlob } from '@/lib/download'
import { IMAGE_OUTPUTS, VIDEO_OUTPUTS, AUDIO_OUTPUTS } from '@/lib/formats'
import { FileDropzone } from './FileDropzone'
import { Card, CardContent } from '@/components/ui/card'
import { ConverterQueueItem } from './ConverterQueueItem'
import { ConverterQueueToolbar } from './ConverterQueueToolbar'
import type { ContextMenuState, FileType, QueueItem } from './converter-queue-types'
import { getSupportedFileType } from '@/lib/file-support'
import { inspectMediaFile } from '@/lib/media-info'
import { resetFFmpeg } from '@/converters/ffmpeg'

function detectType(file: File): FileType {
  const type = getSupportedFileType(file)
  if (!type) throw new Error(`Unsupported file: ${file.name}`)
  return type
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

export function ConverterQueue() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const [bulkQualityOpen, setBulkQualityOpen] = useState(false)
  const [bulkQuality, setBulkQuality] = useState(1)
  const [bulkStripMetadata, setBulkStripMetadata] = useState(true)
  const conversionControllers = useRef(new Map<string, AbortController>())

  const addFiles = useCallback((files: File[]) => {
    const newItems = files.reduce<QueueItem[]>((items, file) => {
      if (!getSupportedFileType(file)) return items

      const type = detectType(file)
      items.push({
        id: crypto.randomUUID(),
        file,
        type,
        format: defaultFormat(file),
        quality: defaultQuality(type),
        stripMetadata: true,
        status: 'pending',
        progress: null,
        progressStage: undefined,
        gifOptions: { ...DEFAULT_GIF_OPTIONS },
      })
      return items
    }, [])
    setItems((prev) => [...prev, ...newItems])

    newItems.forEach((item) => {
      void inspectMediaFile(item.file, item.type).then((mediaInfo) => {
        setItems((prev) => prev.map((current) => current.id === item.id ? { ...current, mediaInfo } : current))
      })
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setItems([])
    setContextMenu(null)
    setSettingsId(null)
    setDownloadMenuOpen(false)
    setBulkQualityOpen(false)
  }, [])

  const setFormat = useCallback(
    (id: string, format: ImageFormat | VideoFormat) => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, format, status: 'pending', progress: null, progressStage: undefined, outputBlob: undefined, error: undefined } : i
        )
      )
    },
    []
  )

  const setAllFormats = useCallback((type: FileType, format: ImageFormat | VideoFormat) => {
    setItems((prev) =>
      prev.map((i) =>
        i.type === type ? { ...i, format, status: 'pending', progress: null, progressStage: undefined, outputBlob: undefined, error: undefined } : i
      )
    )
  }, [])

  const setQuality = useCallback((id: string, quality: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quality, status: 'pending', progress: null, progressStage: undefined, outputBlob: undefined, error: undefined } : i))
    )
  }, [])

  const setStripMetadata = useCallback((id: string, stripMetadata: boolean) => {
    setItems((prev) => prev.map((item) => item.id === id ? {
      ...item,
      stripMetadata,
      status: 'pending',
      progress: null,
      progressStage: undefined,
      outputBlob: undefined,
      error: undefined,
    } : item))
  }, [])

  const setAllConversionSettings = useCallback((quality: number, stripMetadata: boolean) => {
    setItems((prev) => prev.map((item) => ({
      ...item,
      quality,
      stripMetadata,
      status: 'pending',
      progress: null,
      progressStage: undefined,
      outputBlob: undefined,
      error: undefined,
    })))
  }, [])

  const setGifOptions = useCallback((id: string, updates: Partial<GifOptions>) => {
    setItems((prev) => prev.map((item) => (
      item.id === id
        ? {
          ...item,
          gifOptions: { ...item.gifOptions, ...updates },
          status: 'pending',
          progress: null,
          progressStage: undefined,
          outputBlob: undefined,
          error: undefined,
        }
        : item
    )))
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

      const controller = new AbortController()
      conversionControllers.current.set(id, controller)

      updateItem(id, {
        status: 'converting',
        progress: null,
        progressStage: 'Preparing',
        error: undefined,
      })

      try {
        if (item.type === 'image') {
          const blob = await convertImage(item.file, {
            format: item.format as ImageFormat,
            quality: item.quality,
            stripMetadata: item.stripMetadata,
          }, (progress, stage) => updateItem(id, {
            ...(controller.signal.aborted ? {} : { progress, progressStage: stage }),
          }))
          if (controller.signal.aborted) return
          updateItem(id, { status: 'done', progress: 1, progressStage: undefined, outputBlob: blob })
        } else {
          const blob = await convertVideo(
            item.file,
            {
              format: item.format as VideoFormat,
              quality: item.quality,
              stripMetadata: item.stripMetadata,
              gif: item.gifOptions,
            },
            (progress, stage) => updateItem(id, {
              ...(controller.signal.aborted ? {} : { progress, progressStage: stage }),
            })
          )
          if (controller.signal.aborted) return
          updateItem(id, { status: 'done', progress: 1, progressStage: undefined, outputBlob: blob })
        }
      } catch (e) {
        if (controller.signal.aborted) {
          updateItem(id, { status: 'pending', progress: null, progressStage: undefined, error: undefined })
          return
        }
        updateItem(id, {
          status: 'error',
          progress: null,
          progressStage: undefined,
          error: e instanceof Error ? e.message : 'Conversion failed',
        })
      } finally {
        if (conversionControllers.current.get(id) === controller) {
          conversionControllers.current.delete(id)
        }
      }
    },
    [items, updateItem]
  )

  const cancelConversion = useCallback((id: string) => {
    conversionControllers.current.get(id)?.abort()
    resetFFmpeg()
    updateItem(id, { status: 'pending', progress: null, progressStage: undefined, error: undefined })
  }, [updateItem])

  const convertAll = useCallback(async () => {
    const pending = items.filter((i) => i.status === 'pending')
    if (pending.length === 0) return
    for (const item of pending) await convertOne(item.id)
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

  const imageFormatOptions = IMAGE_OUTPUTS.map((o) => ({ value: o.value as string, label: o.label, popular: o.popular }))
  const videoFormatOptions = [...VIDEO_OUTPUTS, ...AUDIO_OUTPUTS].map((o) => ({ value: o.value, label: o.label, popular: o.popular }))
  const audioFormatOptions = AUDIO_OUTPUTS.map((o) => ({ value: o.value, label: o.label, popular: o.popular }))

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <FileDropzone onFiles={addFiles} />

      {items.length > 0 && (
        <Card data-testid="queue-panel" size="sm" className="py-0">
          <CardContent className="p-0">
            {items.length > 1 && (
              <ConverterQueueToolbar
                status={{ hasConverting, hasPending }}
                media={{ hasImages, hasVideos, hasAudios }}
                sharedImageFormat={sharedImageFormat}
                sharedVideoFormat={sharedVideoFormat}
                sharedAudioFormat={sharedAudioFormat}
                imageFormatOptions={imageFormatOptions}
                videoFormatOptions={videoFormatOptions}
                audioFormatOptions={audioFormatOptions}
                bulkQuality={bulkQuality}
                bulkStripMetadata={bulkStripMetadata}
                bulkQualityOpen={bulkQualityOpen}
                downloadMenuOpen={downloadMenuOpen}
                doneItems={doneItems}
                onClearAll={clearAll}
                onSetAllFormats={setAllFormats}
                onSetBulkQualityOpen={setBulkQualityOpen}
                onSetBulkQuality={setBulkQuality}
                onSetBulkStripMetadata={setBulkStripMetadata}
                onSetAllConversionSettings={setAllConversionSettings}
                onConvertAll={convertAll}
                onDownloadOne={downloadOne}
                onDownloadAsZip={downloadAsZip}
                onDownloadSeparately={downloadSeparately}
                onSetDownloadMenuOpen={setDownloadMenuOpen}
              />
            )}

            <div data-testid="queue-list" className="divide-y divide-border">
              {items.map((item) => (
                <ConverterQueueItem
                  key={item.id}
                  item={item}
                  formatOptions={item.type === 'image'
                    ? imageFormatOptions
                    : item.type === 'video'
                      ? videoFormatOptions
                      : audioFormatOptions}
                  hasConverting={hasConverting}
                  settingsId={settingsId}
                  contextMenu={contextMenu}
                  onContextMenu={(id, x, y) => setContextMenu({ id, x, y })}
                  onSetFormat={setFormat}
                  onSetQuality={setQuality}
                  onSetStripMetadata={setStripMetadata}
                  onSetGifOptions={setGifOptions}
                  onConvert={convertOne}
                  onCancel={cancelConversion}
                  onDownload={downloadOne}
                  onRemove={removeItem}
                  onSetSettingsId={setSettingsId}
                  onCloseContextMenu={() => setContextMenu(null)}
                />
              ))}
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
