import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FormatOption {
  value: string
  label: string
}

interface FormatPickerProps {
  value: string
  options: FormatOption[]
  onChange: (value: string) => void
  disabled?: boolean
  triggerClassName?: string
}

export function FormatPicker({
  value,
  options,
  onChange,
  disabled,
  triggerClassName,
}: FormatPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value) ?? options[0]
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function select(next: string) {
    onChange(next)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={panelRef} className="relative inline-block w-full">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn('w-full justify-between gap-2', triggerClassName)}
      >
        <span>{selected?.label ?? value}</span>
        <span className="text-xs text-muted-foreground">{open ? 'Close' : 'Change'}</span>
      </Button>

      {open && (
        <div className="z-10 mt-2 w-full rounded-xl border border-border bg-popover p-3 shadow-lg ring-1 ring-foreground/10">
          <div className="relative mb-3">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search format"
              className="pl-9"
            />
          </div>

          <div className="grid max-h-60 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {filtered.map((o) => (
              <Button
                key={o.value}
                type="button"
                variant={o.value === value ? 'default' : 'secondary'}
                onClick={() => select(o.value)}
                className={cn(
                  'h-10 w-full text-sm font-medium transition-all',
                  o.value === value && 'ring-2 ring-ring ring-offset-1 ring-offset-background'
                )}
              >
                {o.label}
              </Button>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No formats found</p>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" /> Close
          </button>
        </div>
      )}
    </div>
  )
}
