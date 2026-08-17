import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react'
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
  testId?: string
}

function FormatScrollArea({ children, resetKey }: { children: ReactNode; resetKey: string }) {
  const id = useId()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startY: number; startScrollTop: number } | null>(null)
  const [thumb, setThumb] = useState({ visible: false, top: 4, height: 32 })

  const updateThumb = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const { clientHeight, scrollHeight, scrollTop } = scroller
    const maxScroll = scrollHeight - clientHeight
    if (maxScroll <= 1) {
      setThumb({ visible: false, top: 4, height: Math.max(0, clientHeight - 8) })
      return
    }

    const trackHeight = Math.max(0, clientHeight - 8)
    const height = Math.max(32, (clientHeight / scrollHeight) * trackHeight)
    const available = Math.max(0, trackHeight - height)
    setThumb({ visible: true, top: 4 + (scrollTop / maxScroll) * available, height })
  }, [])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    scroller.scrollTop = 0
    const frame = requestAnimationFrame(updateThumb)
    const observer = new ResizeObserver(updateThumb)
    observer.observe(scroller)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [resetKey, updateThumb])

  function onThumbPointerDown(event: PointerEvent<HTMLDivElement>) {
    const scroller = scrollerRef.current
    if (!scroller) return
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: scroller.scrollTop,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onThumbPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const scroller = scrollerRef.current
    if (!drag || drag.pointerId !== event.pointerId || !scroller) return

    const maxScroll = scroller.scrollHeight - scroller.clientHeight
    const available = Math.max(1, scroller.clientHeight - 8 - thumb.height)
    scroller.scrollTop = drag.startScrollTop + (event.clientY - drag.startY) * (maxScroll / available)
  }

  function endThumbDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function onTrackPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    const scroller = scrollerRef.current
    if (!scroller) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    scroller.scrollTop = ratio * (scroller.scrollHeight - scroller.clientHeight)
  }

  return (
    <div className="relative">
      <div
        id={id}
        ref={scrollerRef}
        data-testid="format-scroll-area"
        onScroll={updateThumb}
        onWheel={(event) => {
          if (event.currentTarget.scrollHeight <= event.currentTarget.clientHeight) return
          event.preventDefault()
          event.stopPropagation()
          event.currentTarget.scrollTop += event.deltaY
        }}
        className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto px-2 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      {thumb.visible && (
        <div
          data-testid="format-scroll-track"
          className="absolute top-1 right-0.5 bottom-1 z-10 w-1.5 cursor-pointer rounded-full bg-white/5"
          onPointerDown={onTrackPointerDown}
        >
          <div
            role="scrollbar"
            aria-controls={id}
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(
              (scrollerRef.current?.scrollTop || 0) /
                Math.max(1, (scrollerRef.current?.scrollHeight || 1) - (scrollerRef.current?.clientHeight || 0)) *
                100
            )}
            className="absolute left-0 w-1.5 touch-none cursor-grab rounded-full bg-muted-foreground/80 transition-colors hover:bg-foreground/80 active:cursor-grabbing"
            style={{ top: thumb.top - 4, height: thumb.height }}
            onPointerDown={onThumbPointerDown}
            onPointerMove={onThumbPointerMove}
            onPointerUp={endThumbDrag}
            onPointerCancel={endThumbDrag}
          />
        </div>
      )}
    </div>
  )
}

export function FormatPicker({
  value,
  placeholder,
  options,
  onChange,
  disabled,
  triggerClassName,
  testId,
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
        data-testid={testId}
        disabled={disabled}
        title={selected?.label ?? placeholder ?? 'Select format'}
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
            data-testid={testId ? `${testId}-menu` : undefined}
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

            <FormatScrollArea resetKey={`${open}:${query}:${filtered.length}`}>
              {filtered.map((o) => (
                <Button
                  key={o.value}
                  type="button"
                  aria-pressed={o.value === value}
                  variant={o.value === value ? 'default' : 'secondary'}
                  onClick={() => select(o.value)}
                  className="h-9 min-w-0 w-full truncate px-2 text-xs font-medium transition-all focus-visible:ring-0"
                  title={o.label}
                >
                  {o.label}
                </Button>
              ))}
            </FormatScrollArea>

            {filtered.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No formats found</p>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
