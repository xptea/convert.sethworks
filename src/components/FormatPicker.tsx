import { useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FormatOption {
  value: string
  label: string
}

interface FormatPickerProps {
  value?: string
  placeholder?: string
  options: FormatOption[]
  onChange: (value: string) => void
  disabled?: boolean
  triggerClassName?: string
}

export function FormatPicker({
  value,
  placeholder,
  options,
  onChange,
  disabled,
  triggerClassName,
}: FormatPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = options.find((o) => o.value === value)
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))

  function select(next: string) {
    onChange(next)
    setQuery('')
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50',
          triggerClassName
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder ?? 'Select format'}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={4}>
          <Popover.Popup
            className="z-50 w-80 rounded-xl border border-border bg-popover p-3 shadow-lg ring-1 ring-foreground/10 outline-none"
          >
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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
