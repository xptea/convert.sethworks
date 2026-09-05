import { useState, useRef, useCallback, useEffect, type DragEvent, type ChangeEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { getSupportedFileType, SUPPORTED_FILE_ACCEPT } from '@/lib/file-support'
import { Image, Video, Music, Upload } from 'lucide-react'

interface FileDropzoneProps {
  onFiles: (files: File[]) => void
}

export function FileDropzone({ onFiles }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (fileList: FileList | File[] | null) => {
      if (!fileList) return
      const files = Array.from(fileList)
      if (files.length === 0) return
      const supported = files.filter((file) => getSupportedFileType(file) !== undefined)
      const rejected = files.filter((file) => getSupportedFileType(file) === undefined)

      if (rejected.length > 0) {
        const names = rejected.slice(0, 3).map((file) => file.name).join(', ')
        const remaining = rejected.length - 3
        setRejectionMessage(
          `${rejected.length} unsupported file${rejected.length === 1 ? '' : 's'} skipped: ${names}${remaining > 0 ? ` and ${remaining} more` : ''}.`
        )
      } else {
        setRejectionMessage(null)
      }

      if (supported.length > 0) onFiles(supported)
    },
    [onFiles]
  )

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files)
      if (inputRef.current) inputRef.current.value = ''
    },
    [handleFiles]
  )

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    inputRef.current?.click()
  }, [])

  useEffect(() => {
    const onWindowDragOver = (e: globalThis.DragEvent) => {
      e.preventDefault()
      setIsDragging(true)
    }
    const onWindowDragLeave = (e: globalThis.DragEvent) => {
      if (e.relatedTarget === null) {
        setIsDragging(false)
      }
    }
    const onWindowDrop = (e: globalThis.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFiles(e.dataTransfer?.files ?? null)
    }
    const onWindowPaste = (event: ClipboardEvent) => {
      const clipboardData = event.clipboardData
      if (!clipboardData) return

      // If clipboard contains HTML with an embedded data URL (such as a converted GIF or WebP copied from the app),
      // extract the original full-fidelity file and filename instead of falling back to a synthetic PNG.
      const html = clipboardData.getData('text/html')
      if (html) {
        const match = html.match(/<img[^>]+src=["'](data:(image\/[^;]+);base64,([^"']+))["'](?:[^>]*alt=["']([^"']*)["'])?/i)
        if (match) {
          const [, , mimeType, base64Data, altName] = match
          if (mimeType && mimeType !== 'image/png') {
            try {
              const binary = atob(base64Data)
              const bytes = new Uint8Array(binary.length)
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i)
              }
              const ext = mimeType.split('/')[1]?.replace(/^[^+]+\+/, '') || 'gif'
              const fileName = altName
                ? altName.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
                : `pasted-image.${ext}`
              const file = new File([bytes], fileName, { type: mimeType })
              event.preventDefault()
              handleFiles([file])
              return
            } catch {
              // fallback to standard file extraction below
            }
          }
        }
      }

      const files = Array.from(clipboardData.items ?? [])
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null)
      if (files.length === 0) return
      event.preventDefault()
      handleFiles(files)
    }

    window.addEventListener('dragover', onWindowDragOver as EventListener)
    window.addEventListener('dragleave', onWindowDragLeave as EventListener)
    window.addEventListener('drop', onWindowDrop as EventListener)
    window.addEventListener('paste', onWindowPaste)
    return () => {
      window.removeEventListener('dragover', onWindowDragOver as EventListener)
      window.removeEventListener('dragleave', onWindowDragLeave as EventListener)
      window.removeEventListener('drop', onWindowDrop as EventListener)
      window.removeEventListener('paste', onWindowPaste)
    }
  }, [handleFiles])

  return (
    <div
      data-testid="file-dropzone"
      role="button"
      tabIndex={0}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      onKeyDown={onKeyDown}
      className={cn(
        'group relative mx-auto flex w-full max-w-xl cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-border bg-muted/40 p-12 text-center transition-all duration-200 ease-out',
        isDragging
          ? 'scale-105 border-white/60 bg-white/10 shadow-[0_0_40px_rgba(255,255,255,0.15)]'
          : 'hover:border-white/40 hover:bg-white/5'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={SUPPORTED_FILE_ACCEPT}
        multiple
        className="hidden"
        onChange={onChange}
      />

      <div
        className={cn(
          'flex h-20 w-20 items-center justify-center rounded-2xl bg-secondary text-muted-foreground transition-transform duration-200',
          isDragging ? 'scale-110 bg-transparent text-white' : 'group-hover:scale-110'
        )}
      >
        <Upload className="size-10" />
      </div>

      <div>
        <p className="text-lg font-semibold text-foreground">
          Drop files here or click to browse
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop or paste images, videos, and audio in 100+ formats
        </p>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Image className="size-4" /> Image
        </span>
        <span className="flex items-center gap-1.5">
          <Video className="size-4" /> Video
        </span>
        <span className="flex items-center gap-1.5">
          <Music className="size-4" /> Audio
        </span>
      </div>

      {rejectionMessage && (
        <p role="alert" className="max-w-md rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {rejectionMessage}
        </p>
      )}
    </div>
  )
}
