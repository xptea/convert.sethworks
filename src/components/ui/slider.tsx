import * as React from 'react'
import { cn } from '@/lib/utils'

export function Slider({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type="range"
      className={cn(
        'h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
