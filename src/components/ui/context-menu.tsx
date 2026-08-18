import * as React from 'react'
import { cn } from '@/lib/utils'

interface ContextMenuProps {
  open: boolean
  x: number
  y: number
  onClose: () => void
  children: React.ReactNode
}

export function ContextMenu({ open, x, y, onClose, children }: ContextMenuProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const onCloseEvent = React.useEffectEvent(onClose)

  React.useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onCloseEvent()
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseEvent()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  if (!open) return null

  const winWidth = window.innerWidth
  const winHeight = window.innerHeight
  const menuWidth = 180
  const menuHeight = 120

  let left = x
  let top = y
  if (left + menuWidth > winWidth) left = winWidth - menuWidth - 8
  if (top + menuHeight > winHeight) top = winHeight - menuHeight - 8

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[10rem] rounded-lg border border-border bg-popover p-1 shadow-lg outline-none"
      style={{ left, top }}
    >
      {children}
    </div>
  )
}

interface ContextMenuItemProps {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}

export function ContextMenuItem({ children, onClick, disabled, destructive }: ContextMenuItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium outline-none transition-colors',
        disabled
          ? 'pointer-events-none text-muted-foreground opacity-60'
          : destructive
            ? 'text-destructive hover:bg-destructive/10'
            : 'text-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {children}
    </button>
  )
}
