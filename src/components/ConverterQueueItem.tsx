import { Popover } from '@base-ui/react/popover'
import { FormatPicker } from './FormatPicker'
import { GifSettings, QualitySlider } from './ConverterQueueSettings'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuItem } from '@/components/ui/context-menu'
import {
  Download,
  Image,
  Loader2,
  Music,
  Play,
  Settings2,
  Trash2,
  Video,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ImageFormat } from '@/converters/image'
import type { GifOptions, VideoFormat } from '@/converters/video'
import type { ContextMenuState, FormatOption, QueueItem } from './converter-queue-types'

interface ConverterQueueItemProps {
  item: QueueItem
  formatOptions: FormatOption[]
  hasConverting: boolean
  settingsId: string | null
  contextMenu: ContextMenuState | null
  onContextMenu: (id: string, x: number, y: number) => void
  onSetFormat: (id: string, format: ImageFormat | VideoFormat) => void
  onSetQuality: (id: string, quality: number) => void
  onSetGifOptions: (id: string, updates: Partial<GifOptions>) => void
  onConvert: (id: string) => void | Promise<void>
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

export function ConverterQueueItem({
  item,
  formatOptions,
  hasConverting,
  settingsId,
  contextMenu,
  onContextMenu,
  onSetFormat,
  onSetQuality,
  onSetGifOptions,
  onConvert,
  onDownload,
  onRemove,
  onSetSettingsId,
  onCloseContextMenu,
}: ConverterQueueItemProps) {
  const progressPercent = item.progress === null
    ? null
    : Math.min(100, Math.max(0, Math.round(item.progress * 100)))
  const isAnimatedGif = item.type === 'video' && item.format === 'gif'
  const icon = item.type === 'image'
    ? <Image className="size-5" />
    : item.type === 'video'
      ? <Video className="size-5" />
      : <Music className="size-5" />

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
          <div data-testid="file-type-icon" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
            {icon}
          </div>
          <div data-testid="file-details" className="min-w-0 text-left">
            <p className="truncate text-left text-sm font-medium text-foreground" title={item.file.name}>
              {item.file.name}
            </p>
            <p className="w-full truncate text-left text-xs leading-5 text-muted-foreground">
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
                <Popover.Popup className={cn(
                  'z-50 rounded-xl border border-border bg-popover p-3 shadow-lg outline-none',
                  isAnimatedGif ? 'w-72' : 'w-56'
                )}>
                  {isAnimatedGif ? (
                    <GifSettings
                      value={item.gifOptions}
                      onChange={(updates) => onSetGifOptions(item.id, updates)}
                      disabled={item.status === 'converting'}
                    />
                  ) : (
                    <QualitySlider
                      value={item.quality}
                      onChange={(quality) => onSetQuality(item.id, quality)}
                      disabled={item.status === 'converting'}
                    />
                  )}
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>

          <div className="flex items-center gap-2">
            {item.status === 'done' ? (
              <Button variant="outline" onClick={() => onDownload(item)}>
                <Download className="mr-1.5 size-4" />
                Download
              </Button>
            ) : item.status === 'converting' ? (
              <Button disabled>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Converting
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
          <ContextMenuItem onClick={() => { }} disabled>
            <Loader2 className="size-4" />
            Converting
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={() => { onConvert(item.id); onCloseContextMenu() }}>
            <Play className="size-4" />
            Convert
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => { onSetSettingsId(item.id); onCloseContextMenu() }}>
          <Settings2 className="size-4" />
          Output settings
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
