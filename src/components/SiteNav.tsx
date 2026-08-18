import { cn } from '@/lib/utils'

const linkClass = (active: boolean) => cn(
  'rounded-lg px-3 py-1.5 text-sm transition-colors',
  active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
)

export function SiteNav({ current }: { current: 'converter' | 'about' }) {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between py-4">
      <a href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
        <img
          src="/logo.webp"
          alt=""
          width="32"
          height="32"
          className="size-8 shrink-0"
          aria-hidden="true"
        />
        <span>convert.sethworks.xyz</span>
      </a>
      <nav aria-label="Primary navigation" className="flex items-center gap-1">
        <a href="/" aria-current={current === 'converter' ? 'page' : undefined} className={linkClass(current === 'converter')}>
          Converter
        </a>
        <a href="/about/" aria-current={current === 'about' ? 'page' : undefined} className={linkClass(current === 'about')}>
          About
        </a>
      </nav>
    </header>
  )
}
