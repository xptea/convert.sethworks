import { Popover } from '@base-ui/react/popover'
import type { ImageFormat } from '@/converters/image'
import type { VideoFormat } from '@/converters/video'
import { FormatPicker } from './FormatPicker'
import { MetadataSetting, QualitySlider } from './ConverterQueueSettings'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  FileArchive,
  Files,
  Download,
  Loader2,
  Play,
  Settings2,
  Trash2,
} from 'lucide-react'
import type { FileType, FormatOption, QueueItem } from './converter-queue-types'
import { cn } from '@/lib/utils'

interface ConverterQueueToolbarProps {
  status: {
    hasConverting: boolean
    hasPending: boolean
  }
  media: {
    hasImages: boolean
    hasVideos: boolean
    hasAudios: boolean
  }
  sharedImageFormat?: string
  sharedVideoFormat?: string
  sharedAudioFormat?: string
  imageFormatOptions: FormatOption[]
  videoFormatOptions: FormatOption[]
  audioFormatOptions: FormatOption[]
  bulkQuality: number
  bulkStripMetadata: boolean
  bulkQualityOpen: boolean
  downloadMenuOpen: boolean
  doneItems: QueueItem[]
  onClearAll: () => void
  onSetAllFormats: (type: FileType, format: ImageFormat | VideoFormat) => void
  onSetBulkQualityOpen: (open: boolean) => void
  onSetBulkQuality: (quality: number) => void
  onSetBulkStripMetadata: (stripMetadata: boolean) => void
  onSetAllConversionSettings: (quality: number, stripMetadata: boolean) => void
  onConvertAll: () => void | Promise<void>
  onDownloadOne: (item: QueueItem) => void
  onDownloadAsZip: () => void | Promise<void>
  onDownloadSeparately: () => void
  onSetDownloadMenuOpen: (open: boolean) => void
}

export function ConverterQueueToolbar({
  status,
  media,
  sharedImageFormat,
  sharedVideoFormat,
  sharedAudioFormat,
  imageFormatOptions,
  videoFormatOptions,
  audioFormatOptions,
  bulkQuality,
  bulkStripMetadata,
  bulkQualityOpen,
  downloadMenuOpen,
  doneItems,
  onClearAll,
  onSetAllFormats,
  onSetBulkQualityOpen,
  onSetBulkQuality,
  onSetBulkStripMetadata,
  onSetAllConversionSettings,
  onConvertAll,
  onDownloadOne,
  onDownloadAsZip,
  onDownloadSeparately,
  onSetDownloadMenuOpen,
}: ConverterQueueToolbarProps) {
  const { hasConverting, hasPending } = status
  const { hasImages, hasVideos, hasAudios } = media

  return (
    <div data-testid="batch-toolbar" className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/25 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          disabled={hasConverting}
          title={hasConverting ? 'Wait for conversions to finish before clearing the queue' : 'Remove every file from the queue'}
        >
          <Trash2 className="size-3.5" />
          Clear all
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {hasImages && (
          <FormatPicker
            testId="set-all-images"
            value={sharedImageFormat}
            placeholder="Set all images"
            options={imageFormatOptions}
            onChange={(value) => onSetAllFormats('image', value as ImageFormat)}
          />
        )}
        {hasVideos && (
          <FormatPicker
            testId="set-all-videos"
            value={sharedVideoFormat}
            placeholder="Set all videos"
            options={videoFormatOptions}
            onChange={(value) => onSetAllFormats('video', value as VideoFormat)}
          />
        )}
        {hasAudios && (
          <FormatPicker
            testId="set-all-audio"
            value={sharedAudioFormat}
            placeholder="Set all audio"
            options={audioFormatOptions}
            onChange={(value) => onSetAllFormats('audio', value as VideoFormat)}
          />
        )}

        <Popover.Root open={bulkQualityOpen} onOpenChange={onSetBulkQualityOpen}>
          <Popover.Trigger
            aria-label="Set all conversion settings"
            title="Set all conversion settings"
            disabled={hasConverting}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Settings2 className="size-4" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner
              side="bottom"
              align="end"
              sideOffset={6}
              collisionPadding={8}
              collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'none' }}
            >
              <Popover.Popup className="z-50 w-72 space-y-3 rounded-xl border border-border bg-popover p-3 shadow-lg outline-none">
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">Conversion settings</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Apply these defaults to every file.</p>
                </div>
                <QualitySlider value={bulkQuality} onChange={onSetBulkQuality} disabled={hasConverting} />
                <MetadataSetting
                  checked={bulkStripMetadata}
                  onChange={onSetBulkStripMetadata}
                  disabled={hasConverting}
                />
                <Button
                  className="w-full"
                  onClick={() => {
                    onSetAllConversionSettings(bulkQuality, bulkStripMetadata)
                    onSetBulkQualityOpen(false)
                  }}
                >
                  Apply to all files
                </Button>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>

        <Button onClick={onConvertAll} disabled={!hasPending || hasConverting}>
          {hasConverting ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Play className="mr-1.5 size-4" />
          )}
          {hasConverting ? 'Converting all' : 'Convert all'}
        </Button>
        {doneItems.length === 1 && (
          <Button variant="secondary" onClick={() => onDownloadOne(doneItems[0])}>
            <Download className="mr-1.5 size-4" />
            Download
          </Button>
        )}
        {doneItems.length > 1 && (
          <div className="flex items-center">
            <Button
              variant="secondary"
              onClick={onDownloadAsZip}
              className="rounded-r-none border-r border-border pr-3"
              title="Download all files as a ZIP"
            >
              <FileArchive className="mr-1.5 size-4" />
              Download all
            </Button>
            <Popover.Root open={downloadMenuOpen} onOpenChange={onSetDownloadMenuOpen}>
              <Popover.Trigger
                aria-label="Choose how to download all files"
                title="Download options"
                className="inline-flex h-8 items-center justify-center rounded-r-lg bg-secondary px-2 text-secondary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ChevronDown className={cn('size-4 transition-transform', downloadMenuOpen && 'rotate-180')} />
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
                        onSetDownloadMenuOpen(false)
                        void onDownloadAsZip()
                      }}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
                    >
                      <FileArchive className="mt-0.5 size-4 shrink-0" />
                      <span>
                        <span className="block text-sm font-medium text-foreground">Download as ZIP</span>
                        <span className="block text-xs text-muted-foreground">Default Â· one compressed download</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSetDownloadMenuOpen(false)
                        onDownloadSeparately()
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
  )
}
