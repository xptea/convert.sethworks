import * as React from 'react'
import { cn } from '@/lib/utils'

export function Slider({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type="range"
      className={cn(
        'h-2 w-full cursor-pointer appearance-none rounded-full bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:active:cursor-grabbing',
        className
      )}
      {...props}
    />
  )
}
