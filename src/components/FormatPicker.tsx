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
          'flex h-8 items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50',
          triggerClassName
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder ?? 'Select format'}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'none' }}
        >
          <Popover.Popup
            className="z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover px-3 pt-4 pb-2 shadow-lg outline-none"
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

            <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto py-1 pr-3 [&::-webkit-scrollbar]:w-1.5">
              {filtered.map((o) => (
                <Button
                  key={o.value}
                  type="button"
                  variant={o.value === value ? 'default' : 'secondary'}
                  onClick={() => select(o.value)}
                  className="h-9 w-full px-2 text-xs font-medium transition-all focus-visible:ring-0 truncate"
                  title={o.label}
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
