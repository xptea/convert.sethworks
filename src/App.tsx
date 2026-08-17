import { ConverterQueue } from '@/components/ConverterQueue'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteNav } from '@/components/SiteNav'

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-background px-4">
      <SiteNav current="converter" />
      <main className="flex flex-1 items-center justify-center py-10 sm:py-14">
        <div className="w-full max-w-3xl space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">
              Local Convert
            </h1>
            <p className="mx-auto max-w-lg text-balance text-muted-foreground">
              Convert images, video, and audio between dozens of popular formats.
            </p>
          </div>

          <ConverterQueue />

          <p className="text-xs text-muted-foreground">
            Your files stay on this device.{' '}
            <a href="/about/" className="text-foreground underline decoration-border underline-offset-4">
              Learn how local conversion works.
            </a>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

export default App
