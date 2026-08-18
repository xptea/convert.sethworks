import { useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { FormatPicker } from './FormatPicker'
import { GifSettings, MetadataSetting, QualitySlider } from './ConverterQueueSettings'
import { MediaPreviewDialog } from './MediaPreview'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import {
  Check,
  Copy,
  Download,
  Play,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ImageFormat } from '@/converters/image'
import type { GifOptions, VideoFormat } from '@/converters/video'
import type { ContextMenuState, FormatOption, QueueItem } from './converter-queue-types'
import { copyImageBlob } from '@/lib/download'

interface ConverterQueueItemProps {
  item: QueueItem
  formatOptions: FormatOption[]
  hasConverting: boolean
  settingsId: string | null
  contextMenu: ContextMenuState | null
  onContextMenu: (id: string, x: number, y: number) => void
  onSetFormat: (id: string, format: ImageFormat | VideoFormat) => void
  onSetQuality: (id: string, quality: number) => void
  onSetStripMetadata: (id: string, stripMetadata: boolean) => void
  onSetGifOptions: (id: string, updates: Partial<GifOptions>) => void
  onConvert: (id: string) => void | Promise<void>
  onCancel: (id: string) => void
  onDownload: (item: QueueItem) => void
  onRemove: (id: string) => void
  onSetSettingsId: (id: string | null) => void
  onCloseContextMenu: () => void
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

function formatDuration(seconds?: number) {
  if (!seconds) return undefined
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export function ConverterQueueItem({
  item,
  formatOptions,
  hasConverting,
  settingsId,
  contextMenu,
  onContextMenu,
  onSetFormat,
  onSetQuality,
  onSetStripMetadata,
  onSetGifOptions,
  onConvert,
  onCancel,
  onDownload,
  onRemove,
  onSetSettingsId,
  onCloseContextMenu,
}: ConverterQueueItemProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const progressPercent = item.progress === null
    ? null
    : Math.min(100, Math.max(0, Math.round(item.progress * 100)))
  const isAnimatedGif = item.type === 'video' && item.format === 'gif'
  const detailParts = [
    formatBytes(item.file.size),
    item.mediaInfo?.width && item.mediaInfo.height ? `${item.mediaInfo.width}×${item.mediaInfo.height}` : undefined,
    formatDuration(item.mediaInfo?.duration),
  ].filter(Boolean)

  async function copyOutput() {
    if (!item.outputBlob) return
    try {
      await copyImageBlob(item.outputBlob)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1800)
    } catch {
      setCopyState('error')
      window.setTimeout(() => setCopyState('idle'), 2500)
    }
  }

  return (
    <div
      data-testid="queue-item"
      className={cn(
        'relative flex flex-col gap-2 p-3 transition-colors',
        item.status === 'converting' ? 'bg-primary/5' : 'bg-transparent'
      )}
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu(item.id, event.clientX, event.clientY)
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div data-testid="file-type-icon" className="shrink-0 text-foreground">
            <MediaPreviewDialog
              source={item.file}
              output={item.outputBlob}
              type={item.type}
              fileName={item.file.name}
            />
          </div>
          <div data-testid="file-details" className="min-w-0 text-left">
            <p className="truncate text-left text-sm font-medium text-foreground" title={item.file.name}>
              {item.file.name}
            </p>
            <p className="w-full truncate text-left text-xs leading-5 text-muted-foreground">
              {item.status === 'done' && item.outputBlob ? (
                <span className="inline-flex max-w-full items-center gap-1.5">
                  <SizeComparison original={item.file.size} converted={item.outputBlob.size} />
                  {detailParts.slice(1).length > 0 && (
                    <span className="truncate whitespace-nowrap">· {detailParts.slice(1).join(' · ')}</span>
                  )}
                </span>
              ) : (
                <span className="whitespace-nowrap">{detailParts.join(' · ')}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-row flex-wrap items-center gap-2">
          <FormatPicker
            testId={`item-format-${item.id}`}
            value={item.format}
            options={formatOptions}
            onChange={(value) => onSetFormat(item.id, value as ImageFormat | VideoFormat)}
            disabled={item.status === 'converting'}
          />

          <Popover.Root
            open={settingsId === item.id}
            onOpenChange={(open) => onSetSettingsId(open ? item.id : null)}
          >
            <Popover.Trigger
              aria-label={`Conversion settings for ${item.file.name}`}
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
                <Popover.Popup className={cn(
                  'z-50 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-border bg-popover p-3 shadow-lg outline-none',
                  'w-80 space-y-4'
                )}>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Conversion settings</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Quality, privacy, and format-specific controls.</p>
                  </div>

                  <QualitySlider
                    value={item.quality}
                    onChange={(quality) => onSetQuality(item.id, quality)}
                    disabled={item.status === 'converting'}
                  />

                  {isAnimatedGif && (
                    <GifSettings
                      value={item.gifOptions}
                      onChange={(updates) => onSetGifOptions(item.id, updates)}
                      disabled={item.status === 'converting'}
                    />
                  )}

                  <MetadataSetting
                    checked={item.stripMetadata}
                    onChange={(checked) => onSetStripMetadata(item.id, checked)}
                    disabled={item.status === 'converting'}
                  />
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>

          <div className="flex items-center gap-2">
            {item.status === 'done' ? (
              <>
                {item.type === 'image' && (
                  <Button
                    variant="outline"
                    onClick={() => void copyOutput()}
                    aria-label={`Copy converted ${item.file.name}`}
                    title={copyState === 'error' ? 'This browser could not copy the image' : 'Copy converted image'}
                  >
                    {copyState === 'copied' ? <Check className="size-4" /> : <Copy className="size-4" />}
                    <span className="sr-only">{copyState === 'copied' ? 'Copied' : 'Copy'}</span>
                  </Button>
                )}
                <Button variant="outline" onClick={() => onDownload(item)}>
                  <Download className="mr-1.5 size-4" />
                  Download
                </Button>
              </>
            ) : item.status === 'converting' ? (
              <Button variant="outline" onClick={() => onCancel(item.id)}>
                <X className="mr-1.5 size-4" />
                Cancel
              </Button>
            ) : (
              <Button onClick={() => onConvert(item.id)} disabled={hasConverting}>
                <Play className="mr-1.5 size-4" />
                Convert
              </Button>
            )}
          </div>
        </div>
      </div>

      {item.status === 'converting' && (
        <div
          role="progressbar"
          aria-label={`Conversion progress for ${item.file.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent ?? undefined}
          aria-valuetext={progressPercent === null
            ? (item.progressStage ?? 'Working')
            : `${item.progressStage ?? 'Encoding'}: ${progressPercent}%`}
          aria-busy="true"
          className="space-y-1.5 pt-1"
        >
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="truncate">{item.progressStage ?? 'Working'}</span>
            <span className="shrink-0 tabular-nums text-foreground">
              {progressPercent === null ? 'Working' : `${progressPercent}%`}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            {progressPercent === null ? (
              <div className="h-full w-1/3 rounded-full bg-primary animate-indeterminate-progress" />
            ) : (
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            )}
          </div>
        </div>
      )}

      {item.status === 'error' && item.error && (
        <p className="w-full text-sm text-destructive">{item.error}</p>
      )}

      <ContextMenu
        open={contextMenu?.id === item.id}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        onClose={onCloseContextMenu}
      >
        {item.status === 'done' ? (
          <ContextMenuItem onClick={() => { onDownload(item); onCloseContextMenu() }}>
            <Download className="size-4" />
            Download
          </ContextMenuItem>
        ) : item.status === 'converting' ? (
          <ContextMenuItem onClick={() => { onCancel(item.id); onCloseContextMenu() }}>
            <X className="size-4" />
            Cancel conversion
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={() => { onConvert(item.id); onCloseContextMenu() }}>
            <Play className="size-4" />
            Convert
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => { onSetSettingsId(item.id); onCloseContextMenu() }}>
          <Settings2 className="size-4" />
          Conversion settings
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => { onRemove(item.id); onCloseContextMenu() }}
          destructive
        >
          <Trash2 className="size-4" />
          Delete
        </ContextMenuItem>
      </ContextMenu>
    </div>
  )
}
