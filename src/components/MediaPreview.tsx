import { useEffect, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Eye, Image, Music, Video, X } from 'lucide-react'
import type { FileType } from './converter-queue-types'
import { cn } from '@/lib/utils'

export function MediaPreview({
  blob,
  type,
  label,
  className,
  controls = false,
  contain = false,
  autoPlay = false,
}: {
  blob: Blob
  type: FileType
  label: string
  className?: string
  controls?: boolean
  contain?: boolean
  autoPlay?: boolean
}) {
  const [url, setUrl] = useState('')
  const [stillUrl, setStillUrl] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const next = URL.createObjectURL(blob)
    setUrl(next)
    setFailed(false)
    return () => URL.revokeObjectURL(next)
  }, [blob])

  useEffect(() => {
    if (type !== 'image' || blob.type !== 'image/gif') {
      setStillUrl('')
      return
    }

    let cancelled = false
    let nextStillUrl = ''

    void createImageBitmap(blob).then((frame) => {
      if (cancelled) {
        frame.close()
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = frame.width
      canvas.height = frame.height
      canvas.getContext('2d')?.drawImage(frame, 0, 0)
      frame.close()
      canvas.toBlob((still) => {
        if (!still || cancelled) return
        nextStillUrl = URL.createObjectURL(still)
        setStillUrl(nextStillUrl)
      }, 'image/png')
    }).catch(() => setFailed(true))

    return () => {
      cancelled = true
      if (nextStillUrl) URL.revokeObjectURL(nextStillUrl)
    }
  }, [blob, type])

  const fallback = type === 'image'
    ? <Image className="size-5" />
    : type === 'video'
      ? <Video className="size-5" />
      : <Music className="size-5" />

  return (
    <div
      className={cn('flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary text-foreground', className)}
      title={label}
    >
      {!url || failed || (type === 'audio' && !controls) ? fallback : type === 'image' ? (
        blob.type === 'image/gif' && !stillUrl
          ? fallback
          : <img src={stillUrl || url} alt={label} className={cn('h-full w-full', contain ? 'object-contain' : 'object-cover')} onError={() => setFailed(true)} />
      ) : type === 'audio' ? (
        <audio src={url} aria-label={label} controls className="w-full" onError={() => setFailed(true)} />
      ) : (
        <video
          src={url}
          aria-label={label}
          controls={controls}
          autoPlay={autoPlay}
          muted
          playsInline
          preload="auto"
          className={cn('h-full w-full', contain ? 'object-contain' : 'object-cover')}
          onLoadedData={(event) => {
            if (autoPlay) void event.currentTarget.play().catch(() => undefined)
          }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

export function MediaPreviewDialog({
  source,
  output,
  type,
  fileName,
}: {
  source: Blob
  output?: Blob
  type: FileType
  fileName: string
}) {
  const outputType: FileType = output?.type.startsWith('image/')
    ? 'image'
    : output?.type.startsWith('audio/')
      ? 'audio'
      : output?.type.startsWith('video/')
        ? 'video'
        : type

  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label={`Open preview for ${fileName}`}
        title={`Preview ${fileName}`}
        className="group relative block shrink-0 overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <MediaPreview blob={source} type={type} label={`Preview of ${fileName}`} className="h-10 w-10" />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg border border-white/15 bg-black/30 text-white opacity-0 shadow-inner backdrop-blur-[2px] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Eye className="size-4 drop-shadow" aria-hidden="true" />
        </span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <Dialog.Popup className="max-h-full w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-popover p-4 shadow-2xl outline-none sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-4 text-left">
              <div className="min-w-0">
                <Dialog.Title className="truncate text-base font-semibold text-foreground">Media preview</Dialog.Title>
                <Dialog.Description className="mt-1 truncate text-xs text-muted-foreground">{fileName}</Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Close preview"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>

            <div className={cn('grid gap-4', output && 'md:grid-cols-2')}>
              <div className="space-y-2">
                <MediaPreview
                  blob={source}
                  type={type}
                  label={`Original ${fileName}`}
                  controls
                  autoPlay
                  contain
                  className="h-[min(60vh,32rem)] w-full bg-black/40"
                />
                <p className="text-center text-xs font-medium text-muted-foreground">Original</p>
              </div>

              {output && (
                <div className="space-y-2">
                  <MediaPreview
                    blob={output}
                    type={outputType}
                    label={`Converted ${fileName}`}
                    controls
                    autoPlay
                    contain
                    className="h-[min(60vh,32rem)] w-full bg-black/40"
                  />
                  <p className="text-center text-xs font-medium text-muted-foreground">Converted</p>
                </div>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
