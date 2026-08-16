import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react'
import { cn } from '@/lib/utils'

interface DropzoneProps {
  accept: string
  onFile: (file: File) => void
  label: string
  supportedText: string
}

export function Dropzone({ accept, onFile, label, supportedText }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return
      onFile(file)
    },
    [onFile]
  )

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      handleFile(file)
    },
    [handleFile]
  )

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      handleFile(file)
      if (inputRef.current) inputRef.current.value = ''
    },
    [handleFile]
  )

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'cursor-pointer rounded-xl border-2 border-dashed bg-muted/50 p-8 text-center transition-colors hover:bg-muted',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-border'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onChange}
      />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{supportedText}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        or click to browse
      </p>
    </div>
  )
}
